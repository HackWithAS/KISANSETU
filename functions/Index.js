/* Kisan Setu — Cloud Functions (Admin SDK)
   ------------------------------------------------------------------
   These are the only two operations in the whole product that need a
   service-account credential, which is why they live here instead of in
   app.js: creating a center's login account, and resetting a password
   after phone-OTP verification. Everything else the frontend does goes
   straight through the client Firebase SDK under firestore.rules.

   Deploy:
     npm install --prefix functions
     firebase deploy --only functions

   Then set FUNCTIONS_BASE_URL near the top of app.js to the printed
   HTTPS base URL (both endpoints are hosted from that same base, as
   `${FUNCTIONS_BASE_URL}/createCenterAccount` and
   `${FUNCTIONS_BASE_URL}/resetPasswordWithPhone`).
*/

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const auth = getAuth();
const db = getFirestore();

const ALLOWED_ORIGINS = [
  // Add the deployed site origin(s) here, e.g. "https://kisan-setu-fd406.web.app"
];

function withCors(res) {
  const origin = ALLOWED_ORIGINS[0] || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function verifyCaller(req) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    return await auth.verifyIdToken(match[1]);
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------------
   POST /createCenterAccount
   Body: { centerId, adminId, initialPassword, adminName }
   Caller must be an authenticated Government account (checked against
   users/{uid}.role == "gov" in Firestore, never trusted from the client).
   Creates the center's Auth account and its users/{uid} doc with
   mustChangePassword: true, so the center is forced to set its own
   password on first login (per app.js's forcePassword screen).
------------------------------------------------------------------- */
exports.createCenterAccount = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });

  const callerDoc = await db.collection("users").doc(decoded.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "gov") {
    return res.status(403).json({ message: "not-authorized" });
  }

  const { centerId, adminId, initialPassword, adminName } = req.body || {};
  if (!centerId || !adminId || !initialPassword) {
    return res.status(400).json({ message: "missing-fields" });
  }

  const centerSnap = await db.collection("centers").doc(centerId).get();
  if (!centerSnap.exists) return res.status(404).json({ message: "center-not-found" });

  const email = `${centerId.trim().toLowerCase()}.${adminId.trim().toLowerCase()}@c.kisansetu.app`;

  try {
    const userRecord = await auth.createUser({
      email, password: initialPassword, displayName: adminName || centerId,
    });
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid, role: "center", centerId, adminId, name: adminName || centerId,
      language: "hi", theme: "light", status: "active", mustChangePassword: true,
      createdAt: new Date(),
    });
    // The center document's own id doubles as its login uid throughout
    // app.js (doc(db,"centers", store.user.uid)), so it must match.
    await db.collection("centers").doc(centerId).set(
      { authUid: userRecord.uid }, { merge: true }
    );
    return res.status(200).json({ ok: true, uid: userRecord.uid });
  } catch (err) {
    return res.status(500).json({ message: err.message || "create-failed" });
  }
});

/* ------------------------------------------------------------------
   POST /resetPasswordWithPhone
   Body: { idToken, newPassword }
   idToken comes from the short-lived Firebase Auth session created by
   signInWithPhoneNumber/confirm() on the client (see forgotResetPassword
   in app.js) — that session's UID is NOT the farmer/center account, it's
   a phone-only identity, so this function looks up which real account
   registered that phone number and resets that account's password.
------------------------------------------------------------------- */
exports.resetPasswordWithPhone = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });

  const { idToken, newPassword } = req.body || {};
  if (!idToken || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "missing-fields" });
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ message: "invalid-token" });
  }
  const phoneNumber = decoded.phone_number;
  if (!phoneNumber) return res.status(400).json({ message: "no-phone-on-token" });
  const localMobile = phoneNumber.replace(/^\+91/, "");

  try {
    const farmerMatch = await db.collection("farmers").where("mobile", "==", localMobile).limit(1).get();
    let targetUid = null;
    if (!farmerMatch.empty) {
      targetUid = farmerMatch.docs[0].id;
    } else {
      const centerMatch = await db.collection("centers").where("registeredMobile", "==", localMobile).limit(1).get();
      if (!centerMatch.empty) targetUid = centerMatch.docs[0].data().authUid || null;
    }
    if (!targetUid) return res.status(404).json({ message: "account-not-found" });

    await auth.updateUser(targetUid, { password: newPassword });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message || "reset-failed" });
  }
});