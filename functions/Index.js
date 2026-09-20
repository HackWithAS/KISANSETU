/* Kisan Setu — Firebase Cloud Functions (Admin SDK)
   Privileged operations stay on the server. The browser never receives
   Admin credentials and never decides ownership of financial or role data.
*/

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const auth = getAuth();
const db = getFirestore();

const APP_CHECK_ENFORCE = process.env.APP_CHECK_ENFORCE === "true";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5500",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5500",
  "https://kishan-setu-fd406.web.app",
  "https://kishan-setu-fd406.firebaseapp.com",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function withCors(req, res) {
  const origin = req.get("Origin") || "";
  if (isAllowedOrigin(origin)) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function verifyAppCheck(req) {
  if (!APP_CHECK_ENFORCE) return true;
  const token = req.get("X-Firebase-AppCheck");
  if (!token) return false;
  try {
    const { getAppCheck } = require("firebase-admin/app-check");
    await getAppCheck().verifyToken(token);
    return true;
  } catch (_) {
    return false;
  }
}

async function verifyCaller(req) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    return await auth.verifyIdToken(match[1], true);
  } catch (_) {
    return null;
  }
}

async function loadUser(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

function pick(body, keys) {
  const out = {};
  for (const k of keys) {
    if (body && Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

function isNonEmptyString(v, maxLen = 200) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

function isPositiveNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function rateLimit(key, maxAttempts, windowSeconds) {
  const ref = db.collection("rateLimits").doc(hashKey(key));
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = snap.exists ? snap.data() : null;
      if (!data || typeof data.windowStart !== "number" || now - data.windowStart >= windowSeconds * 1000) {
        tx.set(ref, {
          windowStart: now,
          expiresAt: new Date(now + windowSeconds * 1000),
          count: 1,
        });
        return true;
      }
      if (data.count >= maxAttempts) return false;
      tx.update(ref, { count: FieldValue.increment(1) });
      return true;
    });
  } catch (_) {
    // Fail closed for privileged operations.
    return false;
  }
}

function genericServerError(res) {
  return res.status(500).json({ message: "server-error" });
}

/* POST /registerCenter */
exports.registerCenter = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });
  const caller = await loadUser(decoded.uid);
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

  if (!isNonEmptyString(body.centerName, 160)
      || !isNonEmptyString(body.centerCode, 8)
      || !/^[A-Z0-9]{2,8}$/.test(String(body.centerCode).trim().toUpperCase())
      || !isNonEmptyString(body.adminName, 120)
      || !/^[6-9][0-9]{9}$/.test(String(body.mobile || ""))
      || !isNonEmptyString(body.stateCode, 40)
      || !isNonEmptyString(body.districtCode, 40)) {
    return res.status(400).json({ message: "invalid-fields" });
  }

  const capacity = Number(body.capacity);
  const counters = Number(body.counters);
  if (!Number.isFinite(capacity) || capacity < 0 || capacity > 1000000000) {
    return res.status(400).json({ message: "invalid-capacity" });
  }
  if (!Number.isInteger(counters) || counters < 1 || counters > 8) {
    return res.status(400).json({ message: "invalid-counters" });
  }

  const crops = Array.isArray(body.crops)
    ? body.crops.filter((c) => isNonEmptyString(c, 60)).map((c) => c.trim()).slice(0, 50)
    : [];
  if (crops.length === 0) return res.status(400).json({ message: "no-crops" });

  const centerId = `C${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  const centerCode = body.centerCode.trim().toUpperCase();
  const initialPassword = `${crypto.randomBytes(12).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}9!a`;
  const email = `${centerId.toLowerCase()}.${centerCode.toLowerCase()}@c.kisansetu.app`;

  let userRecord = null;
  try {
    userRecord = await auth.createUser({
      email,
      password: initialPassword,
      displayName: body.adminName.trim(),
    });

    const centerRef = db.collection("centers").doc(centerId);
    const userRef = db.collection("users").doc(userRecord.uid);
    const batch = db.batch();

    batch.set(centerRef, {
      centerId,
      centerName: body.centerName.trim(),
      centerCode,
      address: isNonEmptyString(body.address, 300) ? body.address.trim() : null,
      state: body.stateName || null,
      stateCode: String(body.stateCode).trim(),
      district: body.districtName || null,
      districtCode: String(body.districtCode).trim(),
      block: body.blockName || null,
      blockCode: body.blockCode || null,
      village: body.villageName || null,
      villageCode: body.villageCode || null,
      capacity,
      counters,
      acceptedCrops: crops,
      status: "closed",
      govStatus: "inactive",
      queueLength: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(userRef, {
      uid: userRecord.uid,
      role: "center",
      centerId,
      adminId: centerCode,
      name: body.adminName.trim(),
      mobile: String(body.mobile).trim(),
      language: "hi",
      theme: "light",
      status: "active",
      mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(),
      provisionedByUid: decoded.uid,
    });

    await batch.commit();
    return res.status(200).json({
      ok: true,
      centerId,
      adminId: centerCode,
      initialPassword,
    });
  } catch (err) {
    if (userRecord) {
      try { await auth.deleteUser(userRecord.uid); } catch (_) {}
    }
    return genericServerError(res);
  }
});

/* POST /govSetCenterStatus
   Government controls the legal activation state. The center's own
   operational open/closed state remains separate and cannot override this.
*/
exports.govSetCenterStatus = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });
  const caller = await loadUser(decoded.uid);
  if (!caller || caller.role !== "gov" || caller.status !== "active") {
    return res.status(403).json({ message: "not-authorized" });
  }
  if (!(await rateLimit(`govSetCenterStatus:${decoded.uid}`, 60, 3600))) {
    return res.status(429).json({ message: "too-many-requests" });
  }

  const { centerId, govStatus } = pick(req.body, ["centerId", "govStatus"]);
  if (!isNonEmptyString(centerId, 40) || !["active", "inactive"].includes(govStatus)) {
    return res.status(400).json({ message: "invalid-fields" });
  }

  const ref = db.collection("centers").doc(centerId.trim());
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ message: "center-not-found" });

  try {
    const update = {
      govStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (govStatus === "inactive") update.status = "closed";
    await ref.update(update);
    return res.status(200).json({ ok: true, govStatus });
  } catch (_) {
    return genericServerError(res);
  }
});

/* POST /bookToken */
exports.bookToken = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });
  const caller = await loadUser(decoded.uid);
  if (!caller || caller.role !== "farmer" || caller.status !== "active") {
    return res.status(403).json({ message: "not-authorized" });
  }
  if (!(await rateLimit(`bookToken:${decoded.uid}`, 5, 600))) {
    return res.status(429).json({ message: "too-many-requests" });
  }

  const { centerId } = pick(req.body, ["centerId"]);
  if (!isNonEmptyString(centerId, 40)) return res.status(400).json({ message: "invalid-center" });

  const userRef = db.collection("users").doc(decoded.uid);
  const farmerRef = db.collection("farmers").doc(decoded.uid);
  const centerRef = db.collection("centers").doc(centerId.trim());
  const tokenRef = db.collection("tokens").doc();
  const notifRef = db.collection("notifications").doc();

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const farmerSnap = await tx.get(farmerRef);
      const centerSnap = await tx.get(centerRef);
      if (!userSnap.exists || !farmerSnap.exists || !centerSnap.exists) throw new Error("not-authorized");
      const user = userSnap.data();
      const farmer = farmerSnap.data();
      const center = centerSnap.data();
      if (user.role !== "farmer" || user.status !== "active") throw new Error("not-authorized");
      if (user.activeTokenId) throw new Error("active-token-exists");
      if (farmer.districtCode !== center.districtCode) throw new Error("center-not-available");
      if (center.govStatus !== "active" || center.status !== "open") throw new Error("center-not-available");

      const currentQueue = Number.isInteger(center.queueLength) && center.queueLength >= 0 ? center.queueLength : 0;
      const now = FieldValue.serverTimestamp();
      tx.set(tokenRef, {
        farmerId: decoded.uid,
        farmerName: user.name,
        centerId: centerId.trim(),
        status: "waiting",
        queuePosition: currentQueue + 1,
        createdAt: now,
        updatedAt: now,
      });
      tx.update(userRef, { activeTokenId: tokenRef.id });
      tx.update(centerRef, { queueLength: currentQueue + 1, updatedAt: now });
      tx.set(notifRef, {
        userId: decoded.uid,
        text: `टोकन बुक किया गया — ${center.centerName || centerId}`,
        createdAt: now,
        read: false,
      });
    });
    return res.status(200).json({ ok: true, tokenId: tokenRef.id });
  } catch (err) {
    const known = ["active-token-exists", "center-not-available", "not-authorized"];
    if (known.includes(err.message)) return res.status(409).json({ message: err.message });
    return genericServerError(res);
  }
});

/* POST /cancelToken */
exports.cancelToken = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });
  const caller = await loadUser(decoded.uid);
  if (!caller || caller.role !== "farmer" || caller.status !== "active") return res.status(403).json({ message: "not-authorized" });

  const { tokenId } = pick(req.body, ["tokenId"]);
  if (!isNonEmptyString(tokenId, 200)) return res.status(400).json({ message: "invalid-token" });

  const tokenRef = db.collection("tokens").doc(tokenId.trim());
  const userRef = db.collection("users").doc(decoded.uid);
  try {
    await db.runTransaction(async (tx) => {
      const tokenSnap = await tx.get(tokenRef);
      const userSnap = await tx.get(userRef);
      if (!tokenSnap.exists || !userSnap.exists) throw new Error("not-authorized");
      const token = tokenSnap.data();
      const user = userSnap.data();
      if (token.farmerId !== decoded.uid || token.status !== "waiting" || user.activeTokenId !== tokenId.trim()) {
        throw new Error("not-authorized");
      }
      const centerRef = db.collection("centers").doc(token.centerId);
      const centerSnap = await tx.get(centerRef);
      const center = centerSnap.exists ? centerSnap.data() : {};
      const nextQueue = Math.max(0, (Number(center.queueLength) || 0) - 1);
      const now = FieldValue.serverTimestamp();
      tx.update(tokenRef, { status: "cancelled", updatedAt: now });
      tx.update(userRef, { activeTokenId: FieldValue.delete() });
      if (centerSnap.exists) tx.update(centerRef, { queueLength: nextQueue, updatedAt: now });
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, { userId: decoded.uid, text: "टोकन रद्द कर दिया गया", createdAt: now, read: false });
    });
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res.status(400).json({ message: "token-update-failed" });
  }
});

/* POST /markNoShow */
exports.markNoShow = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });
  const caller = await loadUser(decoded.uid);
  if (!caller || caller.role !== "center" || caller.status !== "active" || !caller.centerId) return res.status(403).json({ message: "not-authorized" });

  const { tokenId } = pick(req.body, ["tokenId"]);
  if (!isNonEmptyString(tokenId, 200)) return res.status(400).json({ message: "invalid-token" });

  const tokenRef = db.collection("tokens").doc(tokenId.trim());
  try {
    await db.runTransaction(async (tx) => {
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists) throw new Error("token-update-failed");
      const token = tokenSnap.data();
      if (token.centerId !== caller.centerId || token.status !== "waiting") throw new Error("token-update-failed");
      const userRef = db.collection("users").doc(token.farmerId);
      const centerRef = db.collection("centers").doc(caller.centerId);
      const userSnap = await tx.get(userRef);
      const centerSnap = await tx.get(centerRef);
      const center = centerSnap.exists ? centerSnap.data() : {};
      const now = FieldValue.serverTimestamp();
      tx.update(tokenRef, { status: "noshow", updatedAt: now });
      if (userSnap.exists && userSnap.data().activeTokenId === tokenId.trim()) {
        tx.update(userRef, { activeTokenId: FieldValue.delete() });
      }
      if (centerSnap.exists) {
        const nextQueue = Math.max(0, (Number(center.queueLength) || 0) - 1);
        tx.update(centerRef, { queueLength: nextQueue, updatedAt: now });
      }
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, { userId: token.farmerId, text: "टोकन अनुपस्थित के रूप में दर्ज किया गया", createdAt: now, read: false });
    });
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res.status(400).json({ message: "token-update-failed" });
  }
});

/* POST /createPurchase */
exports.createPurchase = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const decoded = await verifyCaller(req);
  if (!decoded) return res.status(401).json({ message: "unauthenticated" });
  const caller = await loadUser(decoded.uid);
  if (!caller || caller.role !== "center" || caller.status !== "active" || !caller.centerId) return res.status(403).json({ message: "not-authorized" });
  if (!(await rateLimit(`createPurchase:${decoded.uid}`, 120, 3600))) return res.status(429).json({ message: "too-many-requests" });

  const { tokenId, crop, weight, rate, grade } = pick(req.body, ["tokenId", "crop", "weight", "rate", "grade"]);
  if (!isNonEmptyString(tokenId, 200) || !isNonEmptyString(crop, 80)) return res.status(400).json({ message: "missing-fields" });
  const weightNum = Number(weight);
  const rateNum = Number(rate);
  if (!isPositiveNumber(weightNum) || !isPositiveNumber(rateNum) || weightNum > 1000000 || rateNum > 1000000) {
    return res.status(400).json({ message: "invalid-amount" });
  }
  if (grade !== undefined && grade !== null && !isNonEmptyString(String(grade), 40)) return res.status(400).json({ message: "invalid-grade" });

  const tokenRef = db.collection("tokens").doc(tokenId.trim());
  try {
    const purchaseId = await db.runTransaction(async (tx) => {
      const centerRef = db.collection("centers").doc(caller.centerId);
      const tokenSnap = await tx.get(tokenRef);
      const centerSnap = await tx.get(centerRef);
      if (!tokenSnap.exists || !centerSnap.exists) throw new Error("purchase-failed");
      const token = tokenSnap.data();
      const center = centerSnap.data();
      if (token.centerId !== caller.centerId || token.status !== "waiting" || center.govStatus !== "active") throw new Error("purchase-failed");

      const farmerUserRef = db.collection("users").doc(token.farmerId);
      const farmerSnap = await tx.get(farmerUserRef);
      if (!farmerSnap.exists || farmerSnap.data().role !== "farmer" || farmerSnap.data().status !== "active") throw new Error("purchase-failed");
      const farmerName = farmerSnap.data().name || token.farmerName || null;
      const centerName = center.centerName || caller.centerId;
      const cleanCrop = crop.trim();
      if (Array.isArray(center.acceptedCrops) && center.acceptedCrops.length && !center.acceptedCrops.includes(cleanCrop)) {
        throw new Error("purchase-failed");
      }

      const amount = Math.round(weightNum * rateNum * 100) / 100;
      if (!Number.isSafeInteger(Math.round(amount * 100)) || amount > 1000000000000) throw new Error("purchase-failed");

      const now = FieldValue.serverTimestamp();
      const purchaseRef = db.collection("purchases").doc();
      tx.set(purchaseRef, {
        farmerId: token.farmerId,
        farmerName,
        centerId: caller.centerId,
        centerName,
        tokenId: tokenRef.id,
        crop: cleanCrop,
        quantity: weightNum,
        rate: rateNum,
        grade: grade ? String(grade).trim() : null,
        amount,
        paymentStatus: "pending",
        purchaseDate: now,
        actorUid: decoded.uid,
        actorRole: "center",
      });
      tx.update(tokenRef, { status: "done", updatedAt: now });
      if (farmerSnap.data().activeTokenId === tokenRef.id) tx.update(farmerUserRef, { activeTokenId: FieldValue.delete() });
      const nextQueue = Math.max(0, (Number(center.queueLength) || 0) - 1);
      tx.update(centerRef, { queueLength: nextQueue, updatedAt: now });
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        userId: token.farmerId,
        read: false,
        createdAt: now,
        text: `${cleanCrop} — ${amount} दर्ज हुआ, भुगतान लंबित`,
      });
      return purchaseRef.id;
    });
    return res.status(200).json({ ok: true, purchaseId });
  } catch (_) {
    return res.status(400).json({ message: "purchase-failed" });
  }
});

/* POST /resetPasswordWithPhone */
exports.resetPasswordWithPhone = onRequest(async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ message: "method-not-allowed" });
  if (!(await verifyAppCheck(req))) return res.status(401).json({ message: "app-check-failed" });

  const { idToken, newPassword } = pick(req.body, ["idToken", "newPassword"]);
  if (!isNonEmptyString(idToken, 4000) || !isNonEmptyString(newPassword, 200) || newPassword.length < 8) {
    return res.status(400).json({ message: "invalid-password" });
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch (_) {
    return res.status(401).json({ message: "invalid-token" });
  }
  if (decoded.firebase?.sign_in_provider !== "phone") return res.status(401).json({ message: "invalid-token" });
  const authTime = Number(decoded.auth_time || 0);
  if (!authTime || Math.floor(Date.now() / 1000) - authTime > 10 * 60) return res.status(401).json({ message: "expired-token" });

  const phoneNumber = decoded.phone_number;
  if (!phoneNumber) return res.status(400).json({ message: "invalid-token" });
  const localMobile = phoneNumber.replace(/^\+91/, "");
  if (!/^[6-9][0-9]{9}$/.test(localMobile)) return res.status(400).json({ message: "invalid-phone" });

  if (!(await rateLimit(`resetPassword:${localMobile}`, 5, 900))) return res.status(429).json({ message: "too-many-requests" });

  try {
    const [farmerMatches, centerMatches] = await Promise.all([
      db.collection("farmers").where("mobile", "==", localMobile).get(),
      db.collection("users").where("mobile", "==", localMobile).get(),
    ]);

    const targetUids = [];
    farmerMatches.forEach((d) => targetUids.push(d.id));
    centerMatches.forEach((d) => {
      const data = d.data();
      if (data.role === "center" && data.status === "active") targetUids.push(d.id);
    });
    const uniqueUids = [...new Set(targetUids)];
    if (uniqueUids.length !== 1) return res.status(400).json({ message: "account-recovery-unavailable" });

    const targetUid = uniqueUids[0];
    await auth.updateUser(targetUid, { password: newPassword });
    await auth.revokeRefreshTokens(targetUid);
    await db.collection("users").doc(targetUid).set({
      updatedAt: FieldValue.serverTimestamp(),
      mustChangePassword: false,
    }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (_) {
    return genericServerError(res);
  }
});
