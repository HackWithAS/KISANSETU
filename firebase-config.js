import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRQ78_YixFOE16SMNM7JX2m_h9CNSydf4",
  authDomain: "kishan-setu-fd406.firebaseapp.com",
  projectId: "kishan-setu-fd406",
  storageBucket: "kishan-setu-fd406.firebasestorage.app",
  messagingSenderId: "346789234985",
  appId: "1:346789234985:web:91960655a69dc23c534f38",
  measurementId: "G-M5FVQP4T1S"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let analytics = null;
isSupported().then(ok => { if (ok) analytics = getAnalytics(firebaseApp); }).catch(() => {});
export { analytics };

// Optional App Check: define window.KS_APP_CHECK_SITE_KEY in the page before
// firebase-config.js is loaded in production. Development continues without it.
const appCheckSiteKey = window.KS_APP_CHECK_SITE_KEY || "";
let appCheck = null;
if (appCheckSiteKey) {
  try {
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (_) {
    appCheck = null;
  }
}

export async function getAppCheckHeaders() {
  if (!appCheck) return {};
  try {
    const result = await getToken(appCheck, false);
    return result?.token ? { "X-Firebase-AppCheck": result.token } : {};
  } catch (_) {
    return {};
  }
}

/* Secondary Firebase App instance, used ONLY when Government creates a new
   Center's login account (Spark-plan client flow, no Cloud Function).
   createUserWithEmailAndPassword() always signs the *created* user into
   whichever Auth instance you pass it — calling it on the primary `auth`
   would silently replace Government's own session. Calling it on this
   separate named app instance creates the account without touching the
   primary session at all; Government stays signed in on `auth` throughout.
   Firestore itself is one project-wide service, so `db` (bound to the
   primary app) is still used for every document write below — those
   writes run under Government's own primary auth context and are
   evaluated by firestore.rules exactly like any other client write. */
let secondaryApp = null;
export function getSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, "ks-secondary");
  }
  return getAuth(secondaryApp);
}

// This is the public Firebase Web SDK configuration. It contains no Admin SDK
// or service-account credential. Authorization is enforced by Auth, rules,
// and server-side Cloud Functions.