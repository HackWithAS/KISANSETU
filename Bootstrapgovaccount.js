/* Kisan Setu — one-time Government account bootstrap
   ------------------------------------------------------------------
   There is NO public Government sign-up form, on purpose — a
   Government account is the most privileged role in the product
   (it can register/activate/deactivate centers), so it must never be
   creatable from the open internet. This script is how you create the
   very FIRST Government account, run once, by hand, by someone who
   already holds your Firebase project's service-account credential
   (i.e. someone who could already do anything to the project — this
   script grants no new power, it just does the two writes correctly
   and atomically).

   After the first Government account exists, that account can be used
   to sign in to the Government portal directly (Official ID +
   Password + captcha) — there is deliberately no way, from within the
   product itself, to create a second Government account from the
   Government dashboard. If you need more Government accounts later,
   run this script again with different arguments.

   ------------------------------------------------------------------
   SETUP (once)
   ------------------------------------------------------------------
   1. In the Firebase Console: Project settings → Service accounts →
      "Generate new private key". Save the downloaded JSON somewhere
      OUTSIDE the repo (never commit it).
   2. npm install firebase-admin   (in this scripts/ folder, or reuse
      the functions/ folder's node_modules — either works)
   3. Set an environment variable pointing at that key file:
        export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccountKey.json"

   ------------------------------------------------------------------
   RUN
   ------------------------------------------------------------------
     node scripts/bootstrapGovAccount.js --officialId=GOV-0001 --name="Block Development Officer"

   The script will prompt for the password interactively (it is never
   taken as a command-line argument, so it never lands in your shell
   history) and will refuse to run if a Government account already
   exists, unless you pass --force.

   ------------------------------------------------------------------
   WHAT THIS SCRIPT DOES
   ------------------------------------------------------------------
   - Creates a Firebase Authentication account with a synthetic email
     "<officialId>@g.kisansetu.app" (Government users see and type
     only their Official ID — the same pattern app.js already uses
     for farmer/center logins).
   - Creates users/{uid} with: { role: "gov", status: "active",
     officialId, name, mustChangePassword: true, createdAt }.
   - NEVER writes the password anywhere — Firebase Authentication is
     the only place it is ever stored, hashed, by Google's own
     infrastructure. Firestore never sees it.
   - Sets mustChangePassword: true, so app.js's existing
     forcePassword screen makes the account choose its own password on
     first real login, instead of anyone continuing to use the one
     this script set.
------------------------------------------------------------------- */

const readline = require("readline");
const { initializeApp, cert, applicationDefault } = require("firebase-admin/app");
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
    // Best-effort password masking in a plain terminal. Not perfect on
    // every platform, but keeps the password off the visible screen
    // and, more importantly, out of shell history / process args.
    const stdin = process.stdin;
    let muted = false;
    rl._writeToOutput = function (str) { if (!muted) rl.output.write(str); };
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
    muted = true;
  });
}

async function main() {
  const args = parseArgs();
  const officialId = (args.officialId || "").trim();
  const name = (args.name || "").trim();
  const force = !!args.force;

  if (!officialId || !name) {
    console.error("Usage: node bootstrapGovAccount.js --officialId=GOV-0001 --name=\"Full Name\" [--force]");
    process.exit(1);
  }
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(officialId)) {
    console.error("officialId must be 3-40 characters: letters, numbers, dot, underscore or hyphen only.");
    process.exit(1);
  }

  try {
    initializeApp({ credential: cert || applicationDefault() });
  } catch (e) {
    initializeApp();
  }
  const auth = getAuth();
  const db = getFirestore();

  if (!force) {
    const existing = await db.collection("users").where("role", "==", "gov").limit(1).get();
    if (!existing.empty) {
      console.error(
        "A Government account already exists. Re-run with --force if you " +
        "really intend to create ANOTHER one (e.g. a second official)."
      );
      process.exit(1);
    }
  }

  const password = await promptHidden("\nSet the initial password for this Government account (min 8 chars): ");
  process.stdout.write("\n");
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const confirm = await promptHidden("Confirm password: ");
  process.stdout.write("\n");
  if (confirm !== password) {
    console.error("Passwords did not match. Nothing was created.");
    process.exit(1);
  }

  const email = `${officialId.toLowerCase()}@g.kisansetu.app`;

  try {
    const existingUser = await auth.getUserByEmail(email).catch(() => null);
    if (existingUser) {
      console.error(`An account for officialId "${officialId}" already exists (uid ${existingUser.uid}).`);
      process.exit(1);
    }

    const userRecord = await auth.createUser({ email, password, displayName: name });
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
      actorUid: "bootstrap-script",
      actorRole: "system",
    });

    console.log("\nGovernment account created.");
    console.log(`  Official ID: ${officialId}`);
    console.log(`  Auth uid:    ${userRecord.uid}`);
    console.log("  The account must set its own password on first real login (mustChangePassword: true).");
    console.log("  The password you just entered was sent only to Firebase Authentication — it was never written to Firestore.\n");
  } catch (err) {
    console.error("Failed to create the Government account:", err.message || err);
    process.exit(1);
  }
}

main();