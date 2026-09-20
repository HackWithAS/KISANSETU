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

// This is the public Firebase Web SDK configuration. It contains no Admin SDK
// or service-account credential. Authorization is enforced by Auth, rules,
// and server-side Cloud Functions.
