/* Kisan Setu — one-time Government account bootstrap.
   Run locally with Application Default Credentials / GOOGLE_APPLICATION_CREDENTIALS.
*/

const readline = require("readline");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (raw.startsWith("--")) args[raw.slice(2)] = true;
  }
  return args;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = true;
    rl._writeToOutput = (str) => { if (!muted) rl.output.write(str); };
    rl.question(question, (answer) => { muted = false; rl.close(); resolve(answer); });
  });
}

async function main() {
  const args = parseArgs();
  const officialId = (args.officialId || "").trim();
  const name = (args.name || "").trim();

  if (!officialId || !name || !/^[A-Za-z0-9._-]{3,40}$/.test(officialId)) {
    console.error('Usage: node Bootstrapgovaccount.js --officialId=GOV-0001 --name="Full Name"');
    process.exit(1);
  }

  try {
    initializeApp({ credential: applicationDefault() });
  } catch (err) {
    console.error("Firebase Admin initialization failed. Set GOOGLE_APPLICATION_CREDENTIALS or run in a supported Google environment.");
    process.exit(1);
  }

  const auth = getAuth();
  const db = getFirestore();
  const existing = await db.collection("users").where("role", "==", "gov").limit(1).get();
  if (!existing.empty && !args.force) {
    console.error("A Government account already exists. Use --force only when you intentionally need another official account.");
    process.exit(1);
  }

  const password = await promptHidden("Set initial Government password (min 8 chars): ");
  process.stdout.write("\n");
  if (!password || password.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1); }
  const confirm = await promptHidden("Confirm password: ");
  process.stdout.write("\n");
  if (confirm !== password) { console.error("Passwords did not match. Nothing was created."); process.exit(1); }

  const email = `${officialId.toLowerCase()}@g.kisansetu.app`;
  let userRecord = null;
  try {
    const existingUser = await auth.getUserByEmail(email).catch(() => null);
    if (existingUser) { console.error("That Official ID already has an Auth account."); process.exit(1); }

    userRecord = await auth.createUser({ email, password, displayName: name });
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: "gov",
      status: "active",
      officialId,
      name,
      language: "hi",
      theme: "light",
      mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log("\nGovernment account created.");
    console.log(`Official ID: ${officialId}`);
    console.log(`Auth UID: ${userRecord.uid}`);
    console.log("The initial password is stored only in Firebase Authentication. Change it on first login.\n");
  } catch (err) {
    if (userRecord) { try { await auth.deleteUser(userRecord.uid); } catch (_) {} }
    console.error("Failed to create Government account.");
    process.exit(1);
  }
}

main();
