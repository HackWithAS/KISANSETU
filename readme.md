# Kisan Setu

A redesigned, Firebase-backed frontend for the procurement-center queue
system, replacing the old simulated/demo version.

## Files

- `index.html`, `style.css`, `app.js` — the site itself (`app.js` is loaded
  as an ES module, so it must be served over `http(s)://`, not opened as a
  local `file://` path — run any static server, e.g. `npx serve .`).
- `firebase-config.js` — your project's public web config and SDK init.
- `firestore.rules` — role-based Security Rules; deploy with
  `firebase deploy --only firestore:rules`.
- `functions/index.js` — the two operations that genuinely need the Admin
  SDK (see below); deploy with `firebase deploy --only functions`, then set
  `FUNCTIONS_BASE_URL` near the top of `app.js` to the deployed URL.

## What changed from the old version

**The login/typing bug is fixed at the architecture level, not patched.**
The old app called one global `render()` on a `setInterval` tick that
replaced the entire `#app` HTML every 2.5 seconds — including while someone
was mid-keystroke on the login form, which is why typing and focus kept
breaking. This version:
- never re-renders on a timer;
- renders a screen once when the person navigates (login → signup →
  dashboard, or switching tabs);
- for live data (queue, token status, notifications, nearby centers), a
  Firestore `onSnapshot` listener patches only its own small container
  (`#farmer-queue`, `#center-queue`, etc.) — the header, forms, and
  everything else on the page are untouched;
- `prefers-reduced-motion` is respected, and the only animations left are
  short (~200–300ms) entrance/state-change transitions, never infinite
  loops.

All `Math.random`, hard-coded farmer names, demo centers, and the fake
queue/payment simulation have been removed. Every screen that has no data
yet shows an explicit empty state instead of placeholder content.

## What is fully working against your Firebase project

- Farmer sign-up (creates a real Firebase Auth account + Firestore profile).
- Farmer / Center / Government login, each with its own fields, backed by
  real `signInWithEmailAndPassword` calls (farmer and center usernames are
  mapped to a synthetic email internally, e.g. `ramesh@f.kisansetu.app`,
  so people never see or type an email).
- Nearby centers, token booking, live token status, purchase history and
  notifications for farmers — all read from and written to Firestore.
- Center queue management (serve / no-show), open/closed toggle, counter
  count, and password change.
- Government overview, centers table with activate/deactivate, the
  register-new-center form, and alerts derived from real center data.
- Hindi/English UI throughout via a single translation table, persisted
  language and light/dark theme (light is always the default).
- Firestore Security Rules enforcing that a farmer can only read their own
  records, a center only manages its own queue, and only government
  accounts can create or deactivate centers.

## What needs the two Cloud Functions before it fully works

Two things cannot be done safely from browser code, because they require
the Admin SDK (a service-account credential that must never ship to a
browser):
1. **Creating a center's login** when government registers a new center.
2. **Resetting a password after phone-OTP verification** (forgot password
   for farmers/centers) — Firebase's client SDK can verify a phone number,
   but only the Admin SDK can then set another account's password.

`functions/index.js` has working reference implementations of both. Until
you deploy them and set `FUNCTIONS_BASE_URL` in `app.js`, the frontend
still creates the center's Firestore record and shows the generated
activation code, and the forgot-password screen still verifies the OTP —
they just tell the person the last step needs the backend deployed, rather
than silently pretending to succeed.

## First run: Firestore indexes

A few queries combine a `where` and an `orderBy` on different fields
(farmer history, notifications, the center queue). The first time each
runs, the browser console will show a Firestore error with a direct link
to create the matching composite index — click it once per query and it
will work from then on.

## Known gaps / good next steps

- The state → district → block → village pickers are free-text fields, not
  a real government administrative dataset — plug in an official list when
  you have one.
- The captcha is a simple accessible arithmetic challenge. Section 18 asks
  for Firebase App Check/reCAPTCHA instead where possible — swap it in
  `captchaHtml()`/`checkCaptcha()` once you have a site key.
- SMS for token confirmations and payment updates, and the government
  analytics/ranking views from the original brief, aren't built yet — the
  data model (`purchases`, `tokens`, `centers`) is already shaped to
  support them.
  