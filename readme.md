# Kisan Setu

Firebase-backed procurement-center queue application for farmers, procurement centers, and Government operators.

## Project files

- `index.html`, `style.css`, `app.js` — frontend
- `firebase-config.js` — public Firebase Web SDK configuration
- `Firestore.rules` — Firestore authorization rules
- `firestore.indexes.json` — composite indexes
- `firebase.json` / `.firebaserc` — Firebase CLI configuration
- `functions/index.js` — privileged server operations
- `functions/package.json` — Functions runtime/dependencies
- `Bootstrapgovaccount.js` — one-time Government account bootstrap
- `data/*` — crop and location reference data

## Roles

- Farmer: own profile, tokens, purchase history, notifications; can browse centers in their district.
- Center: own queue and center operations; cannot create purchases directly in Firestore.
- Government: all center management and Government-side center registration/activation.

There is no public Government signup and no public Center signup.

## Center identity

`centerId` is the business identifier. It is different from the Firebase Auth UID. The center account's `users/{authUid}.centerId` field is the authoritative link.

## Local run

Serve the root over HTTP/HTTPS rather than opening `index.html` directly:

```bash
npx serve .
```

The frontend defaults to the Functions base URL for this Firebase project. Set `window.KS_FUNCTIONS_BASE_URL` before loading `app.js` when a different deployed endpoint is required.

## Install and deploy Functions

```bash
npm install --prefix functions
firebase deploy --only functions
```

Functions target Node 22.

## Deploy Firestore rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Government bootstrap

Run `Bootstrapgovaccount.js` from a trusted machine with Application Default Credentials configured. The script creates a Government Auth user and a matching `users/{uid}` document. Passwords are never stored in Firestore.

## App Check

Set `window.KS_APP_CHECK_SITE_KEY` to a real reCAPTCHA v3 site key only after registering the web app in Firebase App Check. Verify the client/Functions flow first, then enable enforcement in Firebase Console and set `APP_CHECK_ENFORCE=true` for Functions.

## Data status

`data/locations.json` is a development reference sample, not a full India dataset. Do not treat it as production location coverage until it is replaced by verified LGD-derived data.
