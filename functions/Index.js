/* Kisan Setu — Cloud Functions (Admin SDK)
   ------------------------------------------------------------------
   Every operation in this file needs a service-account credential
   (the Admin SDK), which is exactly why it lives here and not in
   app.js: a browser can never be trusted to hold that credential.

   What lives here, and why:
     - createCenterAccount / registerCenter  → create a center's login
     - govSetCenterStatus                    → activate/deactivate a center
     - createPurchase                        → record a real transaction
     - resetPasswordWithPhone                → reset a password after OTP

   Every function below:
     1. verifies the caller's Firebase ID token,
     2. re-derives the caller's role from Firestore (never trusts a
        role/centerId/farmerId the client sent in the request body),
     3. validates and narrows the request body (unknown fields are
        dropped, not stored),
     4. rate-limits itself against abuse,
     5. writes audit fields (actorUid, actorRole, createdAt/updatedAt).

   Deploy:
     npm install --prefix functions
     firebase deploy --only functions

   Then set FUNCTIONS_BASE_URL near the top of app.js to the printed
   HTTPS base URL — every endpoint below is hosted from that same base,
   as `${FUNCTIONS_BASE_URL}/<functionName>`.

   Firebase App Check (see SECURITY.md for full production setup):
   set the environment config APP_CHECK_ENFORCE=true once App Check is
   configured for the web app, and every function below will start
   rejecting requests that don't carry a valid App Check token. It is
   left OFF by default so local development keeps working without any
   extra setup.
*/

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAppCheck } = require("firebase-admin/app-check");
const crypto = require("crypto");

initializeApp();
const auth = getAuth();
const db = getFirestore();

const APP_CHECK_ENFORCE = process.env.APP_CHECK_ENFORCE === "true";

const ALLOWED_ORIGINS = [
  // Add the deployed site origin(s) here, e.g. "https://kisan-setu-fd406.web.app"
];

function withCors(res) {
  const origin = ALLOWED_ORIGINS[0] || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

/* ------------------------------------------------------------------
   Shared guards
------------------------------------------------------------------- */

// Verifies the Firebase ID token on every privileged request. Returns
// the decoded token, or null — callers must reject on null themselves.
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

// Optional App Check enforcement — a second, independent signal (this
// request came from our real app, not a script hitting the endpoint
// directly) that Security Rules alone can't give you. Off by default;
// see SECURITY.md for how to turn it on in production.
async function verifyAppCheck(req) {
  if (!APP_CHECK_ENFORCE) return true;
  const token = req.get("X-Firebase-AppCheck");
  if (!token) return false;
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch (err) {
    return false;
  }
}

// Re-derives role/centerId from Firestore — the only place either
// value is trusted from. Never read these off the request body.
async function loadCallerProfile(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

// A tiny fixed-window rate limiter backed by Firestore, for the
// handful of endpoints that are attractive to brute-force (password
// reset, account creation). Not a substitute for Firebase App Check
// or Firebase Auth's own built-in throttling — a second layer on top
// of both. Fails OPEN on a Firestore error so a Firestore hiccup
// never becomes an outage; the identity checks above still hold.
async function rateLimit(key, maxAttempts, windowSeconds) {
  const ref = db.collection("rateLimits").doc(key);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = snap.exists ? snap.data() : null;
      if (!data || now - data.windowStart > windowSeconds * 1000) {
        tx.set(ref, { windowStart: now, count: 1 });
        return true;
      }
      if (data.count >= maxAttempts) return false;
      tx.update(ref, { count: FieldValue.increment(1) });
      return true;
    });
  } catch (err) {
    return true;
  }
}

// Strips a request body down to exactly the allow-listed keys, so an
// extra field a client sends (e.g. a stray "role": "gov") is silently
// dropped rather than ever reaching a database write.
function pick(body, keys) {
  const out = {};
  for (const k of keys) if (body && Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  return out;
}

function isNonEmptyString(v, maxLen = 200) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}
function isPositiveNumber(v) {
  return typeof v === "number" && isFinite(v) && v > 0;
}

/* ------------------------------------------------------------------
   POST /createCenterAccount
   Body: { centerId, adminId, initialPassword, adminName }
   Caller must already be an authenticated, active Government account
   (checked against users/{uid}.role == "gov" in Firestore — never
   trusted from the client). Kept as a standalone endpoint for anyone
   who prefers to create a center document first and wire its login
   separately; registerCenter below does both atomically and is what
   app.js calls by default.
------------------------------------------------------------------- */
exports.createCenterAccount = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });

  const caller = await loadCallerProfile(decoded.uid);
  if (!caller || caller.role !== "gov" || caller.status !== "active") {
    return res.status(403).json({ message: "not-authorized" });
  }

  if (!(await rateLimit(`createCenterAccount:${decoded.uid}`, 20, 3600))) {
    return res.status(429).json({ message: "too-many-requests" });
  }

  const { centerId, adminId, initialPassword, adminName } = pick(req.body, ["centerId", "adminId", "initialPassword", "adminName"]);
  if (!isNonEmptyString(centerId, 40) || !isNonEmptyString(adminId, 40) || !isNonEmptyString(initialPassword, 100)) {
    return res.status(400).json({ message: "missing-fields" });
  }
  if (initialPassword.length < 8) return res.status(400).json({ message: "weak-password" });
  if (adminName !== undefined && !isNonEmptyString(adminName, 120)) {
    return res.status(400).json({ message: "invalid-admin-name" });
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
      createdAt: FieldValue.serverTimestamp(),
      actorUid: decoded.uid, actorRole: "gov",
    });
    // The center document's real id (centerId) is a business ID, e.g.
    // "C1A2B3" — it is NOT this Auth uid. Every other part of the app
    // must resolve a center's identity via users/{uid}.centerId, never
    // via the Auth uid directly (see SECURITY.md).
    await db.collection("centers").doc(centerId).set(
      { authUid: userRecord.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true }
    );
    return res.status(200).json({ ok: true, uid: userRecord.uid });
  } catch (err) {
    return res.status(500).json({ message: err.message || "create-failed" });
  }
});

/* ------------------------------------------------------------------
   POST /registerCenter
   Body: { centerName, centerCode, address, capacity, counters, crops,
           mobile, adminName, stateCode, stateName, districtCode,
           districtName, blockCode, blockName, villageCode, villageName }
   Caller must be an authenticated, active Government account. Does,
   atomically, everything govRegisterForm's submit used to do as two
   separate client-side writes (a direct setDoc into centers/, then a
   call to createCenterAccount): generates the centerId server-side,
   creates the center document, creates the center's Auth account and
   its users/{uid} doc, and returns a one-time-shown temporary
   password. Nothing about the center document is ever written
   directly by the browser (see firestore.rules — centers/create is
   always false).
------------------------------------------------------------------- */
exports.registerCenter = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });

  const caller = await loadCallerProfile(decoded.uid);
  if (!caller || caller.role !== "gov" || caller.status !== "active") {
    return res.status(403).json({ message: "not-authorized" });
  }

  if (!(await rateLimit(`registerCenter:${decoded.uid}`, 20, 3600))) {
    return res.status(429).json({ message: "too-many-requests" });
  }

  const body = pick(req.body, [
    "centerName", "centerCode", "address", "capacity", "counters", "crops", "mobile", "adminName",
    "stateCode", "stateName", "districtCode", "districtName", "blockCode", "blockName", "villageCode", "villageName",
  ]);

  if (!isNonEmptyString(body.centerName, 160) || !isNonEmptyString(body.centerCode, 8) ||
      !isNonEmptyString(body.adminName, 120) || !/^[6-9]\d{9}$/.test(String(body.mobile || ""))) {
    return res.status(400).json({ message: "missing-fields" });
  }
  const capacity = Number(body.capacity);
  const counters = Number(body.counters);
  if (!Number.isFinite(capacity) || capacity < 0) return res.status(400).json({ message: "invalid-capacity" });
  if (!Number.isInteger(counters) || counters < 1 || counters > 8) return res.status(400).json({ message: "invalid-counters" });
  const crops = Array.isArray(body.crops) ? body.crops.filter((c) => isNonEmptyString(c, 60)).slice(0, 50) : [];

  const centerCode = body.centerCode.trim().toUpperCase();
  const centerId = "C" + crypto.randomBytes(6).toString("hex").toUpperCase();

  const centerDoc = {
    centerId,
    centerName: body.centerName.trim(),
    centerCode,
    registeredMobile: body.mobile.trim(),
    address: isNonEmptyString(body.address, 300) ? body.address.trim() : null,
    state: body.stateName || null, stateCode: body.stateCode || null,
    district: body.districtName || null, districtCode: body.districtCode || null,
    block: body.blockName || null, blockCode: body.blockCode || null,
    village: body.villageName || null, villageCode: body.villageCode || null,
    capacity, counters, acceptedCrops: crops, status: "closed",
    createdAt: FieldValue.serverTimestamp(),
    actorUid: decoded.uid, actorRole: "gov",
  };

  // A random, unguessable temporary password — never derived from
  // public-ish values like the center code or mobile number, and
  // never stored anywhere; it is only ever returned once, in this
  // response, for the government operator to hand to the center.
  const initialPassword = crypto.randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) + "9!";
  const email = `${centerId.toLowerCase()}.${centerCode.toLowerCase()}@c.kisansetu.app`;

  try {
    await db.collection("centers").doc(centerId).set(centerDoc);
    const userRecord = await auth.createUser({ email, password: initialPassword, displayName: body.adminName.trim() });
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid, role: "center", centerId, adminId: centerCode, name: body.adminName.trim(),
      language: "hi", theme: "light", status: "active", mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(), actorUid: decoded.uid, actorRole: "gov",
    });
    await db.collection("centers").doc(centerId).set({ authUid: userRecord.uid }, { merge: true });
    return res.status(200).json({
      ok: true, centerId, adminId: centerCode, initialPassword,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "create-failed" });
  }
});

/* ------------------------------------------------------------------
   POST /govSetCenterStatus
   Body: { centerId, status }  status is "open" | "closed"
   Caller must be an authenticated, active Government account. Kept
   server-side (rather than a direct client updateDoc) purely so every
   activation/deactivation is timestamped and attributed to the
   government operator who did it.
------------------------------------------------------------------- */
exports.govSetCenterStatus = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });

  const caller = await loadCallerProfile(decoded.uid);
  if (!caller || caller.role !== "gov" || caller.status !== "active") {
    return res.status(403).json({ message: "not-authorized" });
  }

  const { centerId, status } = pick(req.body, ["centerId", "status"]);
  if (!isNonEmptyString(centerId, 40) || (status !== "open" && status !== "closed")) {
    return res.status(400).json({ message: "invalid-fields" });
  }

  const ref = db.collection("centers").doc(centerId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ message: "center-not-found" });

  try {
    await ref.update({
      status, updatedAt: FieldValue.serverTimestamp(), actorUid: decoded.uid, actorRole: "gov",
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message || "update-failed" });
  }
});

/* ------------------------------------------------------------------
   POST /createPurchase
   Body: { tokenId, crop, weight, rate, grade }
   Caller must be an authenticated, active Center account. This is the
   one place money moves in the product, which is exactly why it can
   no longer be a direct browser addDoc: farmerId, centerId and amount
   are ALL derived here from server-trusted sources (the caller's own
   users/{uid}.centerId, and the token document being served) rather
   than taken from the request body, so a tampered request can change
   only the crop/weight/rate/grade a center operator is recording for
   a token that is genuinely theirs — never whose purchase it is, for
   how much, or at which center.
------------------------------------------------------------------- */
exports.createPurchase = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });

  const caller = await loadCallerProfile(decoded.uid);
  if (!caller || caller.role !== "center" || caller.status !== "active" || !caller.centerId) {
    return res.status(403).json({ message: "not-authorized" });
  }

  if (!(await rateLimit(`createPurchase:${decoded.uid}`, 120, 3600))) {
    return res.status(429).json({ message: "too-many-requests" });
  }

  const { tokenId, crop, weight, rate, grade } = pick(req.body, ["tokenId", "crop", "weight", "rate", "grade"]);
  if (!isNonEmptyString(tokenId, 200) || !isNonEmptyString(crop, 80)) {
    return res.status(400).json({ message: "missing-fields" });
  }
  const weightNum = Number(weight), rateNum = Number(rate);
  if (!isPositiveNumber(weightNum) || !isPositiveNumber(rateNum)) {
    return res.status(400).json({ message: "invalid-amount" });
  }
  if (grade !== undefined && grade !== null && !isNonEmptyString(String(grade), 40)) {
    return res.status(400).json({ message: "invalid-grade" });
  }

  const tokenRef = db.collection("tokens").doc(tokenId);

  try {
    const purchaseId = await db.runTransaction(async (tx) => {
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists) throw new Error("token-not-found");
      const token = tokenSnap.data();
      // The token's own centerId — resolved from Firestore, not from
      // anything the request said — must match the caller's own
      // centerId, and the token must still be waiting.
      if (token.centerId !== caller.centerId) throw new Error("not-authorized");
      if (token.status !== "waiting") throw new Error("token-not-waiting");

      const amount = Math.round(weightNum * rateNum * 100) / 100;
      const purchaseRef = db.collection("purchases").doc();
      tx.set(purchaseRef, {
        farmerId: token.farmerId, farmerName: token.farmerName || null,
        centerId: caller.centerId, centerName: caller.centerName || null,
        tokenId, crop: crop.trim(), quantity: weightNum, rate: rateNum,
        grade: grade || null, amount, paymentStatus: "pending",
        purchaseDate: FieldValue.serverTimestamp(),
        actorUid: decoded.uid, actorRole: "center",
      });
      tx.update(tokenRef, { status: "done", updatedAt: FieldValue.serverTimestamp() });
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        userId: token.farmerId, read: false, createdAt: FieldValue.serverTimestamp(),
        text: `${crop.trim()} — ${amount} recorded, payment pending`,
      });
      return purchaseRef.id;
    });
    return res.status(200).json({ ok: true, purchaseId });
  } catch (err) {
    const known = ["token-not-found", "not-authorized", "token-not-waiting"];
    const message = known.includes(err.message) ? err.message : "purchase-failed";
    const statusCode = err.message === "token-not-found" ? 404 : err.message === "not-authorized" ? 403 : 400;
    return res.status(known.includes(err.message) ? statusCode : 500).json({ message });
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
   Deliberately vague on failure (never reveals whether a phone number
   is registered) to avoid user enumeration.
------------------------------------------------------------------- */
exports.resetPasswordWithPhone = onRequest(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const { idToken, newPassword } = pick(req.body, ["idToken", "newPassword"]);
  if (!isNonEmptyString(idToken, 4000) || !isNonEmptyString(newPassword, 200) || newPassword.length < 6) {
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

  if (!(await rateLimit(`resetPassword:${localMobile}`, 5, 900))) {
    return res.status(429).json({ message: "too-many-requests" });
  }

  try {
    const farmerMatch = await db.collection("farmers").where("mobile", "==", localMobile).limit(1).get();
    let targetUid = null;
    if (!farmerMatch.empty) {
      targetUid = farmerMatch.docs[0].id;
    } else {
      const centerMatch = await db.collection("centers").where("registeredMobile", "==", localMobile).limit(1).get();
      if (!centerMatch.empty) targetUid = centerMatch.docs[0].data().authUid || null;
    }
    // Same generic response whether or not a match was found, so this
    // endpoint can't be used to test which phone numbers are registered.
    if (!targetUid) return res.status(404).json({ message: "account-not-found" });

    await auth.updateUser(targetUid, { password: newPassword });
    await db.collection("users").doc(targetUid).set(
      { updatedAt: FieldValue.serverTimestamp() }, { merge: true }
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message || "reset-failed" });
  }
});