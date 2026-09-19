/*
  Reference implementation only — deploy this to Firebase Cloud Functions,
  never in the browser. It uses the Admin SDK, which requires a service
  account and must run on a server. The frontend calls these two endpoints
  by name from FUNCTIONS_BASE_URL in app.js; until this is deployed, both
  flows fail gracefully and tell the user what to do.

  Setup:
    npm install firebase-admin firebase-functions
    firebase deploy --only functions
*/
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// Called by government accounts after they create a center's Firestore
// profile. Creates the matching Firebase Auth account with the initial
// activation password and marks it for a forced password change.
exports.createCenterAccount = onRequest(async (req, res) => {
  cors(res);
  if (req.method !== "POST") return res.status(405).end();
  const { centerId, adminId, initialPassword, adminName } = req.body || {};
  if (!centerId || !adminId || !initialPassword) return res.status(400).json({ message: "missing-fields" });
  try {
    const email = `${centerId.toLowerCase()}.${adminId.toLowerCase()}@c.kisansetu.app`;
    const user = await admin.auth().createUser({ email, password: initialPassword, displayName: adminName || adminId });
    await admin.firestore().collection("users").doc(user.uid).set({
      uid: user.uid, role: "center", name: adminName || adminId, username: adminId,
      language: "hi", theme: "light", status: "active", mustChangePassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await admin.firestore().collection("centerAdmins").doc(user.uid).set({ centerId, adminId });
    await admin.firestore().collection("centers").doc(centerId).update({ adminIds: admin.firestore.FieldValue.arrayUnion(user.uid) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Called after a farmer or center admin verifies their phone number by
// Firebase Phone Auth on the forgot-password screen. Looks up which
// account owns that phone number and resets its password.
exports.resetPasswordWithPhone = onRequest(async (req, res) => {
  cors(res);
  if (req.method !== "POST") return res.status(405).end();
  const { idToken, newPassword } = req.body || {};
  if (!idToken || !newPassword || newPassword.length < 6) return res.status(400).json({ message: "invalid-request" });
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) return res.status(400).json({ message: "no-phone-on-token" });
    const mobile = phoneNumber.replace("+91", "");

    const farmerQuery = await admin.firestore().collection("farmers").where("mobile", "==", mobile).limit(1).get();
    const centerQuery = farmerQuery.empty
      ? await admin.firestore().collection("centers").where("registeredMobile", "==", mobile).limit(1).get()
      : null;

    let targetUid = null;
    if (!farmerQuery.empty) targetUid = farmerQuery.docs[0].id;
    else if (centerQuery && !centerQuery.empty) {
      const adminsSnap = await admin.firestore().collection("centerAdmins")
        .where("centerId", "==", centerQuery.docs[0].id).limit(1).get();
      if (!adminsSnap.empty) targetUid = adminsSnap.docs[0].id;
    }
    if (!targetUid) return res.status(404).json({ message: "no-account-for-number" });

    await admin.auth().updateUser(targetUid, { password: newPassword });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});