# Kisan Setu — Security Model

## Authorization boundary

Firebase Authentication identifies the caller. Firestore Security Rules enforce client access. Cloud Functions use the Admin SDK for privileged, cross-document operations.

Client code is never trusted for `role`, `centerId`, `farmerId`, purchase amount ownership, or government permissions.

## Access scope

| Collection | Farmer | Center | Government | Client writes |
|---|---|---|---|---|
| `users/{uid}` | own doc | own doc | own doc | self profile/preferences only |
| `farmers/{uid}` | own doc | none | none | create only during signup |
| `centers/{centerId}` | same-district read | own read; status/counters only | all centers | center status/counters only |
| `tokens/{id}` | own read | own-center read | none | no client create/update/delete |
| `purchases/{id}` | own read | none | none | no client writes |
| `notifications/{id}` | own read | own read | none | no client writes |
| `rateLimits/{key}` | none | none | none | no client access |

## Center identity

A center has two identifiers:

- Firebase Auth UID: the login account identity.
- Business `centerId`: the procurement center identity.

The center's `users/{authUid}.centerId` links those identities. The browser never uses the Auth UID as a center ID.

## Government status

`centers/{centerId}.govStatus` is controlled only by the Government Cloud Function.

`centers/{centerId}.status` is the center's operational Open/Closed state and may be changed by that center only while `govStatus == "active"`.

A Government deactivation sets `govStatus` to `inactive` and forces `status` to `closed`.

## Privileged functions

`functions/index.js` contains:

- `registerCenter`
- `govSetCenterStatus`
- `bookToken`
- `cancelToken`
- `markNoShow`
- `createPurchase`
- `resetPasswordWithPhone`

Every function verifies the Firebase ID token, re-derives the caller role from Firestore, validates input, and applies rate limiting where appropriate.

## Purchase security

The browser cannot create or modify purchase documents. `createPurchase` derives the farmer and center from the waiting token and verified center account, computes `amount` on the server, marks the token `done`, updates queue state, and creates the farmer notification in one transaction.

## Password recovery

Phone OTP is used only to prove possession of the recovery number. The temporary phone-auth session is signed out before the reset step. The server accepts only a recent phone-auth ID token, resolves exactly one eligible account, updates the password, and revokes refresh tokens.

## App Check

The client has optional reCAPTCHA v3 App Check support. Keep enforcement disabled during local setup until a real site key is configured. After the site key is configured and verified, enable App Check in Firebase Console and set `APP_CHECK_ENFORCE=true` for the Functions runtime.

App Check is defense-in-depth. Firestore Rules and server authorization remain mandatory.

## Deployment inputs

- `Firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `.firebaserc`
- `functions/package.json`
- `functions/index.js`

Never commit service-account JSON or private keys. The Government bootstrap script must be run only from a trusted administrative machine using Application Default Credentials.
