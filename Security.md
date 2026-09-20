# Kisan Setu — Security Hardening Report

Scope of this pass: `firestore.rules` (new), `functions/index.js` (extended),
`scripts/bootstrapGovAccount.js` (new), and targeted fixes in `app.js`. No UI
was redesigned and no feature was removed — center dashboards, government
registration, farmer booking, etc. all work the same way from the person's
point of view; what changed is *where* the trust decisions happen.

## 1. What was found and fixed

**A real bug, not just a hardening gap:** every center-side Firestore call
(`tokens` queue query, the `centers/{id}` document, purchase records) was
keyed on `store.user.uid` — the center account's **Auth uid**. But
`registerCenter`/`createCenterAccount` generates the center's real business
ID (`centerId`, e.g. `C1A2B3`) separately from the Auth uid it creates, and
only links them through `users/{uid}.centerId`. Using the Auth uid as if it
were the centerId meant a center's own queue/capacity/purchase code was
querying the wrong documents. This is exactly the failure mode item 2 of
your brief warns about ("Auth UID is NOT the center ID"), and it's now fixed
everywhere in `app.js` to resolve `store.profile.centerId` from Firestore
instead.

**Login context wasn't enforced:** a real Government account's credentials,
typed into the Farmer or Center tab, would sign in successfully and land on
the Government dashboard regardless of which tab was used, because
`app.js` picked the screen from `profile.role`, not from which login form
was submitted. `onAuthStateChanged` now compares the tab the person signed
in from against the account's real role and immediately signs them back out
(with a generic error, so it never reveals that "this official ID belongs
to a different role") on any mismatch.

**Purchases, center registration, and center activation/deactivation were
client-writable.** A center's browser tab built the entire purchase record
(`farmerId`, `centerId`, `amount`) itself and wrote it with `addDoc` —
nothing stopped a modified request from claiming a different farmer,
different center, or a fabricated amount. Government's browser tab wrote
the new `centers/{id}` document directly. Both are now Cloud Functions
(`createPurchase`, `registerCenter`) that re-derive every sensitive field
from Firestore/the caller's verified identity, never from the request body.

## 2. What is private now, and how

Enforced in `firestore.rules` (the actual boundary — App Check and UI
checks are both defense-in-depth on top of this, never a substitute for it):

| Data | Who can read | Who can write |
|---|---|---|
| `users/{uid}` | the account itself; government (any doc) | self-signup (farmer only, role locked); center/gov docs only via Cloud Functions/bootstrap script (Admin SDK) |
| `farmers/{uid}` | the farmer themself; government | the farmer themself |
| `centers/{centerId}` | any signed-in user (no personal data in it) | `status`/`counters` only, by that center itself; everything else via Cloud Functions |
| `tokens/{id}` | the farmer who owns it; the center it's filed against; government | farmer creates/cancels their own; center marks its own no-show; "done" now goes through `createPurchase` |
| `purchases/{id}` | the farmer; the owning center; government | **no client writes at all** — `createPurchase` only |
| `notifications/{id}` | only the addressed user | that user, for their own notification only |

Every one of these is enforced by re-deriving the caller's role/centerId
from their **own** `users/{uid}` document inside the rule itself
(`get(...).data`) — never from a client-claimed value — so a modified
DevTools request or a raw REST call against Firestore is denied exactly the
same way the normal app UI would be.

## 3. What's intentionally public

- `firebase-config.js`'s contents (API key, project ID, etc.) — this is the
  public Firebase Web SDK config. It identifies your project; it does not
  authorize anything. It was already correctly free of any Admin
  SDK/service-account material, and still is.
- `data/crops.json` and `data/locations.json` — reference/master data with
  no farmer or center personal information in them.
- `centers/{id}` documents — name, location, status, accepted crops, queue
  length. No PII; needed by every role to browse/book.

## 4. What requires Cloud Functions (all in `functions/index.js`)

- `registerCenter` — creates a center + its login account atomically, gov-only.
- `createCenterAccount` — lower-level variant, kept for compatibility.
- `govSetCenterStatus` — activate/deactivate a center, with audit fields.
- `createPurchase` — the only way a purchase record can be created; derives
  farmerId/centerId/amount server-side from the token being served.
- `resetPasswordWithPhone` — unchanged in spirit, now rate-limited and with
  a generic not-found response (no phone-number enumeration).

Deploy with `firebase deploy --only functions`, then set
`FUNCTIONS_BASE_URL` near the top of `app.js` to the printed HTTPS base URL.

## 5. What requires Firebase Console configuration

- **Deploy the rules:** `firebase deploy --only firestore:rules`.
- **Composite indexes:** unchanged from before — the first run of each
  `where` + `orderBy` query will print a console link to create it once.
- **Firebase App Check (production):**
  1. Console → App Check → register the web app with reCAPTCHA
     Enterprise (or v3).
  2. Add the App Check SDK to `index.html`/`app.js` and initialize it with
     your site key before any Firestore/Functions calls.
  3. Console → App Check → Firestore & Cloud Functions → **Enforce**.
  4. Set `APP_CHECK_ENFORCE=true` in your Functions environment
     (`firebase functions:config:set` or, for 2nd-gen, an `.env` file read
     via `process.env`) so the functions in this repo start checking the
     `X-Firebase-AppCheck` header too.
  Left OFF by default here so local development keeps working without any
  extra setup, per your requirement — but App Check is not a replacement
  for the Firestore rules above; both are active in production.
- **Firebase Authentication:** its built-in brute-force/anomaly protection
  for password sign-in and phone OTP is on by default for all projects —
  no configuration needed, but worth knowing it's the first line of
  defense against login-spraying, with the Firestore-based limiter below
  as a second layer on the custom endpoints.

## 6. Rate limiting / abuse protection

- `resetPasswordWithPhone`: max 5 attempts / 15 minutes per phone number
  (Firestore-backed fixed window, `rateLimits/{key}`, write-only from
  Cloud Functions — no client ever touches this collection).
- `registerCenter` / `createCenterAccount`: max 20 / hour per government
  caller (these are rare, deliberate actions; this just caps runaway
  scripts/mistakes).
- `createPurchase`: max 120 / hour per center (well above real usage,
  low enough to blunt a compromised center account being used to spam
  fake purchase attempts).
- Login itself (`signInWithEmailAndPassword`, `signInWithPhoneNumber`) is
  throttled by Firebase Authentication itself, not by this app's code.
- None of these retry on failure from the client — every catch block shows
  an error and stops, no automatic retry loop anywhere.

## 7. Government account bootstrap (no public sign-up, on purpose)

There is still no "Government Sign Up" anywhere in the UI — the login
screen's Government tab only ever shows Official ID + Password + captcha,
exactly as before, and `handleGoogleLogin`/farmer self-signup can now never
land on the Government (or Center) dashboard even if someone typed a real
Government account's credentials into the wrong tab (see §1).

**To create the first Government account:**

```bash
# one time, outside the repo:
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccountKey.json"
node scripts/bootstrapGovAccount.js --officialId=GOV-0001 --name="Block Development Officer"
```

The script prompts for the password interactively (never a CLI argument,
so it's never in shell history), refuses to run a second time unless you
pass `--force` (so it can't quietly be used as an ongoing side-door), and:

- creates a Firebase Authentication account at `gov-0001@g.kisansetu.app`,
- writes `users/{uid}` with `role: "gov"`, `status: "active"`,
  `officialId: "GOV-0001"`, `mustChangePassword: true`,
- **never writes the password to Firestore** — only Firebase Authentication
  ever sees it.

After that, the account signs in normally through the Government tab, and
because `mustChangePassword` is `true`, `app.js`'s existing forced
password-change screen makes it set its own password before reaching the
dashboard. If you'd rather do this by hand instead of running the script,
the equivalent manual steps are: Console → Authentication → Add user
(email `<officialid>@g.kisansetu.app`) → copy the generated uid → Console →
Firestore → `users/<uid>` → add the same four fields above.

## 8. Remaining limitations / good next steps

- `govOverview`'s "total farmers" and "total purchases today" KPIs are
  still placeholders (`—`) in the UI. Per item 3 of your brief, they should
  **not** be implemented by listing the full `farmers`/`purchases`
  collections client-side — `firestore.rules` now explicitly denies
  listing `farmers` at all. The right fix is a scheduled/callable Cloud
  Function that runs a Firestore aggregation query (`count()`) with the
  Admin SDK and writes just the numbers to a small `stats/overview`
  document the government dashboard can read.
- `payments`/`paymentStatus` transitions (marking a purchase "paid") have
  no write path yet, client or server — that's unchanged from before this
  pass; when it's built it should be a Cloud Function for the same reason
  `createPurchase` is.
- The captcha is still the accessible arithmetic challenge; swapping it
  for reCAPTCHA/App Check per item 17 of the original README is still a
  good idea and is independent of this pass.
- App Check is wired into every Cloud Function here but ships **disabled**
  (`APP_CHECK_ENFORCE` unset) until you complete the Console setup in §5 —
  until then, the Firestore rules and the functions' own token/role checks
  are what's actually protecting the app, which is enough on their own,
  but App Check closes the remaining gap of "a script that isn't the real
  web app, holding a stolen but valid ID token."

Nothing above is described as secure unless the rule or server code you
can read in this repo is what's actually enforcing it — none of this
relies on the frontend hiding anything.