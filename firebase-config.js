import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

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

export let analytics = null;
isSupported().then(ok => { if (ok) analytics = getAnalytics(firebaseApp); }).catch(() => {});

// This config is the public web client config, safe to ship in frontend code.
// Access control is enforced by Firestore Security Rules (firestore.rules) and
// Firebase Auth, never by anything in this file. No service-account or Admin
// SDK credential belongs in browser JavaScript — see functions/index.js for
// the operations that require the Admin SDK on a server.