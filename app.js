import { auth, db, getAppCheckHeaders, getSecondaryAuth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  RecaptchaVerifier, signInWithPhoneNumber, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy,
  limit, onSnapshot, serverTimestamp, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as locationAdapter from "./data/locationAdapter.js";
import * as cropsAdapter from "./data/cropsAdapter.js";

/* A server endpoint is required for every operation that needs the Admin
   SDK or must not trust anything the browser says about itself: creating
   a center's login, registering a center, activating/deactivating a
   center, recording a purchase, and resetting a password after phone
   verification. See functions/index.js and SECURITY.md. */
const FUNCTIONS_BASE_URL = window.KS_FUNCTIONS_BASE_URL || "https://us-central1-kishan-setu-fd406.cloudfunctions.net";

/* Both data adapters fetch their JSON once, in parallel, right away.
   Local static files resolve near-instantly, but if a screen that needs
   them (signup step 2/3, the Google first-time profile, center
   registration) is somehow reached before they land, it renders a brief
   loading note and repaints itself the moment this resolves — never a
   silent empty state pretending the data doesn't exist. */
Promise.all([locationAdapter.ready(), cropsAdapter.ready()]).then(() => {
  const onDataScreen = store.screen === "signup" || store.screen === "googleComplete"
    || (store.screen === "gov" && store.govTab === "register");
  if (onDataScreen) paintScreen();
}).catch(() => {});

/* ============================== icons ============================== */
const ICONS = {
  sprout: '<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c-4 0-6-2.5-6-6.5C9 5.5 12 8 12 12Z"/><path d="M12 12c4 0 6-2.5 6-6.5C15 5.5 12 8 12 12Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
  settings: '<circle cx="12" cy="12" r="2.8"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19.5a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 8.58 4.9l.06.06a1.7 1.7 0 0 0 1.87.34h.1a1.7 1.7 0 0 0 1-1.55V3.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55h.1a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.1a1.7 1.7 0 0 0 1.55 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1Z"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
  ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.5-1.3 1-1.3 1.9"/><path d="M12 17h.01"/>',
  mapPin: '<path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3.4 3-5 5.5-5s4.7 1.6 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 13.5c1.9.3 3.3 1.7 4 4"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
  chart: '<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2 20h20"/>',
  alert: '<path d="M12 3l10 18H2Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  google: '<path d="M21.6 12.2c0-.7-.06-1.4-.19-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.75 3-4.3 3-7.3Z"/><path d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.75-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.85 9.4 6.1 12 6.1Z"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  minus: '<path d="M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
};
function ic(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

/* ============================== i18n ============================== */
const I18N = {
  hi: {
    brand: "Kisan Setu", tagline: "किसानों और खरीद केंद्रों के बीच आसान सेतु",
    role_farmer: "किसान", role_center: "केंद्र", role_gov: "शासन",
    sign_in: "साइन इन करें", sign_up: "नया पंजीकरण",
    username: "उपयोगकर्ता नाम", mobile: "मोबाइल नंबर", password: "पासवर्ड", confirm_password: "पासवर्ड की पुष्टि करें",
    center_id: "केंद्र आईडी", admin_id: "एडमिन आईडी", official_id: "अधिकारी आईडी",
    forgot_password: "पासवर्ड भूल गए?", no_account: "नया उपयोगकर्ता?", have_account: "पहले से खाता है?",
    about: "हमारे बारे में", help: "सूचना", captcha: "सत्यापन कोड", captcha_refresh: "नया कोड",
    show_password: "पासवर्ड दिखाएँ", hide_password: "पासवर्ड छिपाएँ",
    login_error: "गलत उपयोगकर्ता नाम या पासवर्ड", network_error: "इंटरनेट कनेक्शन उपलब्ध नहीं है।",
    wrong_password: "गलत पासवर्ड", wrong_username: "उपयोगकर्ता नाम गलत है", too_many_attempts: "बहुत अधिक प्रयास, कुछ समय बाद पुनः प्रयास करें",
    session_expired: "कृपया दोबारा लॉगिन करें।", otp_invalid: "OTP गलत है या समाप्त हो गया है।",
    field_required: "यह फ़ील्ड आवश्यक है", captcha_wrong: "सत्यापन कोड गलत है", code_taken: "यह कोड पहले से उपयोग में है, कोई और चुनें",
    passwords_no_match: "पासवर्ड मेल नहीं खाते", weak_password: "पासवर्ड कम से कम 8 अक्षर का होना चाहिए",
    step: "चरण", next: "आगे", back: "पीछे", submit: "जमा करें", save: "सहेजें", cancel: "रद्द करें", confirm: "पुष्टि करें",
    full_name: "पूरा नाम", state: "राज्य", district: "ज़िला", block: "ब्लॉक", village: "गाँव",
    select_state: "राज्य चुनें", select_district: "ज़िला चुनें", select_block: "ब्लॉक चुनें", select_village: "गाँव चुनें",
    location_data_pending: "इस ज़िले/ब्लॉक के लिए डेटा अभी जोड़ा जाना बाकी है", loading: "लोड हो रहा है…",
    main_crops: "मुख्य फ़सलें", main_crops_hint: "एक या अधिक फ़सलें चुनें", accept_terms: "मैं नियम व शर्तें स्वीकार करता/करती हूँ",
    signup_step1: "मूल जानकारी", signup_step2: "स्थान", signup_step3: "मुख्य फ़सलें", signup_step4: "सत्यापन",
    continue_with_google: "Google से जारी रखें", or_divider: "या",
    complete_profile: "प्रोफ़ाइल पूरी करें", complete_profile_hint: "आपका Google खाता जुड़ गया है — जारी रखने के लिए कुछ और जानकारी दें",
    otp_sent: "OTP भेजा गया", enter_otp: "6 अंकों का OTP दर्ज करें", resend_otp: "OTP फिर भेजें",
    new_password: "नया पासवर्ड", password_changed: "पासवर्ड सफलतापूर्वक बदल दिया गया", initial_password: "शुरुआती पासवर्ड",
    forgot_identify: "उपयोगकर्ता नाम या मोबाइल नंबर दर्ज करें",
    nav_home: "केंद्र", nav_token: "टोकन", nav_history: "इतिहास", nav_notif: "सूचनाएँ", nav_help: "सहायता",
    nav_dashboard: "डैशबोर्ड", nav_queue: "कतार", nav_purchases: "खरीद", nav_capacity: "क्षमता", nav_settings: "सेटिंग",
    nav_overview: "अवलोकन", nav_centers: "केंद्र", nav_register: "नया केंद्र", nav_analytics: "विश्लेषण", nav_alerts: "चेतावनी",
    profile: "प्रोफ़ाइल", language: "भाषा", theme: "थीम", logout: "लॉगआउट", change_password: "पासवर्ड बदलें",
    nearby_centers: "आपके आसपास के केंद्र", sort_nearest: "सबसे नज़दीक", sort_wait: "सबसे कम प्रतीक्षा", sort_token: "टोकन उपलब्धता",
    km_away: "किमी दूर", queue_len: "कतार", est_wait: "अनुमानित प्रतीक्षा", counters_active: "सक्रिय काउंटर",
    open_now: "खुला", closed_now: "बंद", today_capacity: "आज की क्षमता", crops_accepted: "स्वीकृत फ़सलें",
    last_updated: "अंतिम अपडेट", book_token: "टोकन बुक करें", no_centers_found: "कोई केंद्र नहीं मिला",
    no_centers_desc: "आपके क्षेत्र में अभी कोई सक्रिय केंद्र दर्ज नहीं है।",
    my_token: "मेरा टोकन", no_active_token: "कोई सक्रिय टोकन नहीं", no_active_token_desc: "नज़दीकी केंद्रों में से एक टोकन बुक करें।",
    active_token_exists: "आपके पास पहले से एक सक्रिय टोकन है।",
    token_status_waiting: "प्रतीक्षा में", token_status_done: "पूर्ण", token_status_noshow: "अनुपस्थित",
    slot: "समय", queue_position: "कतार में स्थान", cancel_token: "टोकन रद्द करें", cancel_token_confirm_title: "टोकन रद्द करें?",
    cancel_token_confirm_body: "रद्द करने के बाद यह टोकन वापस नहीं लिया जा सकता।",
    yes_cancel: "हाँ, रद्द करें", no_keep: "नहीं, रहने दें",
    purchase_history: "पिछली खरीद", no_history: "अभी कोई खरीद दर्ज नहीं है", no_history_desc: "आपकी पिछली खरीद यहाँ दिखेगी।",
    crop: "फ़सल", quantity: "मात्रा", rate: "दर", total: "कुल राशि", grade: "ग्रेड", payment_status: "भुगतान स्थिति",
    paid: "भुगतान हुआ", pending: "लंबित", processing: "प्रक्रिया में",
    notifications: "सूचनाएँ", no_notifications: "कोई सूचना नहीं", no_notifications_desc: "नई सूचनाएँ यहाँ दिखेंगी।",
    about_title: "Kisan Setu क्या है", about_body: "Kisan Setu किसानों को नज़दीकी खरीद केंद्रों से जोड़ने, टोकन और कतार प्रबंधन, खरीद इतिहास और भुगतान की स्थिति देखने में मदद करता है। केंद्र संचालक अपनी कतार और क्षमता प्रबंधित करते हैं, और शासन सभी केंद्रों की निगरानी करता है।",
    help_title: "सहायता", faq_book: "टोकन कैसे बुक करें?", faq_book_a: "नज़दीकी केंद्र चुनें और उपलब्ध समय पर टोकन बुक करें।",
    faq_reach: "केंद्र तक कैसे पहुँचें?", faq_reach_a: "केंद्र की सूची में दूरी और पता दिया गया है।",
    faq_cancel: "टोकन कैसे रद्द करें?", faq_cancel_a: "'मेरा टोकन' खोलें और 'टोकन रद्द करें' दबाएँ।",
    faq_payment: "भुगतान की स्थिति कैसे देखें?", faq_payment_a: "'पिछली खरीद' में हर रिकॉर्ड की भुगतान स्थिति दिखती है।",
    faq_reset: "पासवर्ड कैसे रीसेट करें?", faq_reset_a: "लॉगिन पेज पर 'पासवर्ड भूल गए?' से OTP के ज़रिए रीसेट करें।",
    contact_help: "संपर्क / सहायता", contact_note: "आपके केंद्र का हेल्प नंबर व्यवस्थापन सेटिंग से जोड़ा जाएगा।",
    queue_title: "आज की कतार", no_queue: "कतार खाली है", no_queue_desc: "अभी कोई किसान प्रतीक्षा में नहीं है।",
    mark_served: "पूर्ण करें", mark_noshow: "अनुपस्थित", weight: "वज़न (क्विंटल)",
    center_status: "केंद्र स्थिति", counters: "काउंटर", capacity_today: "आज की क्षमता",
    register_new_center: "नया केंद्र पंजीकृत करें", center_name: "केंद्र का नाम", center_code: "केंद्र कोड (लैटिन)",
    center_capacity: "क्षमता (क्विंटल/दिन)", num_counters: "काउंटर की संख्या", crops_list: "स्वीकृत फ़सलें",
    village_address: "गाँव / पता", village_address_hint: "गली, लैंडमार्क आदि (वैकल्पिक)",
    admin_details: "एडमिन विवरण", admin_name: "एडमिन का नाम", create_center: "केंद्र बनाएँ",
    center_created: "केंद्र बनाया गया", initial_credentials: "प्रारंभिक लॉगिन विवरण",
    overview_title: "अवलोकन", total_centers: "कुल केंद्र", open_centers: "खुले केंद्र", total_farmers: "पंजीकृत किसान", total_purchases_today: "आज की खरीद",
    alerts_title: "चेतावनियाँ", no_alerts: "सब ठीक चल रहा है", activate: "सक्रिय करें", deactivate: "निष्क्रिय करें", gov_active: "सरकार द्वारा सक्रिय", gov_inactive: "सरकार द्वारा निष्क्रिय",
    force_password_change: "पहली बार लॉगिन — नया पासवर्ड बनाएँ", set_password: "पासवर्ड सेट करें",
    saved: "सहेजा गया", loading: "लोड हो रहा है…", toggle_theme: "थीम बदलें",
    gov_password_note: "शासन खाते का पासवर्ड केवल आधिकारिक प्रशासनिक प्रक्रिया से बदला जा सकता है।",
  },
  en: {
    brand: "Kisan Setu", tagline: "Connecting farmers and procurement centers, simply.",
    role_farmer: "Farmer", role_center: "Center", role_gov: "Government",
    sign_in: "Sign In", sign_up: "Sign Up",
    username: "Username", mobile: "Mobile number", password: "Password", confirm_password: "Confirm password",
    center_id: "Center ID", admin_id: "Admin ID", official_id: "Official ID",
    forgot_password: "Forgot password?", no_account: "New here?", have_account: "Already have an account?",
    about: "About", help: "Help", captcha: "Verification code", captcha_refresh: "New code",
    show_password: "Show password", hide_password: "Hide password",
    login_error: "Incorrect username or password", network_error: "No internet connection.",
    wrong_password: "Incorrect password", wrong_username: "Incorrect username", too_many_attempts: "Too many attempts, try again later",
    session_expired: "Please sign in again.", otp_invalid: "OTP is incorrect or has expired.",
    field_required: "This field is required", captcha_wrong: "Verification code is incorrect", code_taken: "This code is already in use, choose another",
    passwords_no_match: "Passwords do not match", weak_password: "Password must be at least 8 characters",
    step: "Step", next: "Next", back: "Back", submit: "Submit", save: "Save", cancel: "Cancel", confirm: "Confirm",
    full_name: "Full name", state: "State", district: "District", block: "Block", village: "Village",
    select_state: "Select state", select_district: "Select district", select_block: "Select block", select_village: "Select village",
    location_data_pending: "Data for this district/block hasn't been added yet", loading: "Loading…",
    main_crops: "Main crops", main_crops_hint: "Choose one or more crops", accept_terms: "I accept the terms and conditions",
    signup_step1: "Basic details", signup_step2: "Location", signup_step3: "Main crops", signup_step4: "Verification",
    continue_with_google: "Continue with Google", or_divider: "or",
    complete_profile: "Complete your profile", complete_profile_hint: "Your Google account is connected — a few more details to continue",
    otp_sent: "OTP sent", enter_otp: "Enter the 6-digit OTP", resend_otp: "Resend OTP",
    new_password: "New password", password_changed: "Password changed successfully", initial_password: "Initial password",
    forgot_identify: "Enter your username or mobile number",
    nav_home: "Centers", nav_token: "Token", nav_history: "History", nav_notif: "Notifications", nav_help: "Help",
    nav_dashboard: "Dashboard", nav_queue: "Queue", nav_purchases: "Purchases", nav_capacity: "Capacity", nav_settings: "Settings",
    nav_overview: "Overview", nav_centers: "Centers", nav_register: "Register center", nav_analytics: "Analytics", nav_alerts: "Alerts",
    profile: "Profile", language: "Language", theme: "Theme", logout: "Log out", change_password: "Change password",
    nearby_centers: "Centers near you", sort_nearest: "Nearest", sort_wait: "Lowest wait", sort_token: "Token availability",
    km_away: "km away", queue_len: "Queue", est_wait: "Est. wait", counters_active: "Counters active",
    open_now: "Open", closed_now: "Closed", today_capacity: "Today's capacity", crops_accepted: "Crops accepted",
    last_updated: "Last updated", book_token: "Book token", no_centers_found: "No centers found",
    no_centers_desc: "No active center is on record in your area yet.",
    my_token: "My token", no_active_token: "No active token", no_active_token_desc: "Book a token from one of the nearby centers.",
    active_token_exists: "You already have an active token.",
    token_status_waiting: "Waiting", token_status_done: "Done", token_status_noshow: "No-show",
    slot: "Slot", queue_position: "Queue position", cancel_token: "Cancel token", cancel_token_confirm_title: "Cancel this token?",
    cancel_token_confirm_body: "Once cancelled, this token cannot be restored.",
    yes_cancel: "Yes, cancel", no_keep: "No, keep it",
    purchase_history: "Purchase history", no_history: "No purchases on record", no_history_desc: "Your past purchases will appear here.",
    crop: "Crop", quantity: "Quantity", rate: "Rate", total: "Total amount", grade: "Grade", payment_status: "Payment status",
    paid: "Paid", pending: "Pending", processing: "Processing",
    notifications: "Notifications", no_notifications: "No notifications", no_notifications_desc: "New notifications will appear here.",
    about_title: "What is Kisan Setu", about_body: "Kisan Setu connects farmers with nearby procurement centers, manages tokens and queues, and shows purchase history and payment status. Center staff manage their own queue and capacity, and government accounts monitor all centers.",
    help_title: "Help", faq_book: "How do I book a token?", faq_book_a: "Pick a nearby center and book a token in an available slot.",
    faq_reach: "How do I reach a center?", faq_reach_a: "Distance and address are shown against each center.",
    faq_cancel: "How do I cancel a token?", faq_cancel_a: "Open 'My token' and choose 'Cancel token'.",
    faq_payment: "How do I check payment status?", faq_payment_a: "Payment status is shown against every record in Purchase history.",
    faq_reset: "How do I reset my password?", faq_reset_a: "Use 'Forgot password?' on the login page to reset via OTP.",
    contact_help: "Contact / support", contact_note: "Your center's help number will be added from configuration.",
    queue_title: "Today's queue", no_queue: "Queue is empty", no_queue_desc: "No farmer is waiting right now.",
    mark_served: "Mark served", mark_noshow: "No-show", weight: "Weight (quintal)",
    center_status: "Center status", counters: "Counters", capacity_today: "Today's capacity",
    register_new_center: "Register new center", center_name: "Center name", center_code: "Center code (Latin)",
    center_capacity: "Capacity (quintal/day)", num_counters: "Number of counters", crops_list: "Crops accepted",
    village_address: "Village / address", village_address_hint: "Street, landmark, etc. (optional)",
    admin_details: "Admin details", admin_name: "Admin name", create_center: "Create center",
    center_created: "Center created", initial_credentials: "Initial login details",
    overview_title: "Overview", total_centers: "Total centers", open_centers: "Centers open", total_farmers: "Registered farmers", total_purchases_today: "Purchases today",
    alerts_title: "Alerts", no_alerts: "Everything looks normal", activate: "Activate", deactivate: "Deactivate", gov_active: "Government active", gov_inactive: "Government inactive",
    force_password_change: "First login — set a new password", set_password: "Set password",
    saved: "Saved", loading: "Loading…", toggle_theme: "Toggle theme",
    gov_password_note: "A government account's password can only be changed through the official administrative process.",
  },
};
function t(key) { return (I18N[store.lang] && I18N[store.lang][key]) || I18N.hi[key] || key; }

/* ============================== state ============================== */
const store = {
  lang: localStorage.getItem("ks_lang") || "hi",
  theme: localStorage.getItem("ks_theme") || "light",
  screen: "loading",
  authTab: "farmer",
  user: null,
  profile: null,
  toast: null,
  modal: null,
  accountOpen: false,
  farmerTab: "home",
  centerTab: "queue",
  govTab: "overview",
  signupStep: 1,
  signupData: { crops: [] },
  googleProfile: null,
  googleStep: 1,
  googleData: { crops: [] },
  centerRegisterData: { crops: [] },
  forgotStep: "identify",
  forgotData: {},
  captcha: { a: 1, b: 1 },
  sortBy: "nearest",
  draft: null,
  forcePasswordChange: false,
  _unsub: {},
  _confirmResult: null,
};

function newCaptcha() {
  store.captcha = { a: 2 + Math.floor(Math.random() * 8), b: 1 + Math.floor(Math.random() * 8) };
}
function checkCaptcha(v) { return String(store.captcha.a + store.captcha.b) === String(v || "").trim(); }
/* Regenerates the captcha challenge in place, inside the given form, without
   touching anything else — never call paintLoginForm()/rebuild the form
   here, or every field the person typed (and any error just shown) gets
   wiped along with it. */
function refreshCaptchaWidget(form) {
  newCaptcha();
  const box = form.querySelector(".captcha-box");
  if (!box) return;
  const challenge = box.querySelector(".captcha-challenge");
  if (challenge) challenge.textContent = `${store.captcha.a} + ${store.captcha.b} = ?`;
  const input = form.querySelector('input[name="captcha"]');
  if (input) input.value = "";
}

function applyTheme() { document.documentElement.setAttribute("data-theme", store.theme); }
function setTheme(th) {
  store.theme = th; localStorage.setItem("ks_theme", th); applyTheme();
  if (store.profile) updateDoc(doc(db, "users", store.user.uid), { theme: th }).catch(() => {});
  if (store.screen === "login" || store.screen === "signup" || store.screen === "forgot") { paintScreen(); return; }
  detachAllListeners(); mount();
}
function setLang(l) {
  store.lang = l; localStorage.setItem("ks_lang", l);
  document.documentElement.lang = l === "hi" ? "hi" : "en";
  if (store.profile) updateDoc(doc(db, "users", store.user.uid), { language: l }).catch(() => {});
  if (store.screen === "login" || store.screen === "signup" || store.screen === "forgot") { paintScreen(); return; }
  detachAllListeners(); mount();
}

function showToast(msg) {
  store.toast = msg;
  paint("toast-slot", `<div class="toast" role="status">${msg}</div>`);
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { store.toast = null; paint("toast-slot", ""); }, 2800);
}
function openModal(cfg) { store.modal = cfg; paintModal(); }
function closeModal() { store.modal = null; paintModal(); }
function paintModal() {
  const root = document.getElementById("modal-root");
  if (!store.modal) { root.innerHTML = ""; return; }
  const m = store.modal;
  root.innerHTML = `<div class="modal-backdrop" data-close="1"><div class="modal" role="dialog" aria-modal="true">
    <h3>${m.title}</h3><p class="muted">${m.body}</p>
    <div class="modal-actions">
      <button class="btn ${m.danger ? "" : "ghost"}" id="modal-cancel">${m.cancelText || t("cancel")}</button>
      <button class="btn ${m.danger ? "danger" : ""}" id="modal-confirm">${m.confirmText || t("confirm")}</button>
    </div></div></div>`;
  root.querySelector(".modal-backdrop").addEventListener("click", (e) => { if (e.target.dataset.close) closeModal(); });
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-confirm").addEventListener("click", () => {
    const data = m.getData ? m.getData(root) : undefined;
    closeModal(); m.onConfirm && m.onConfirm(data);
  });
}

function paint(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtINR(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

/* ============================== auth helpers ============================== */
function farmerEmail(username) { return `${username.trim().toLowerCase()}@f.kisansetu.app`; }
function centerEmail(centerId, adminId) { return `${centerId.trim().toLowerCase()}.${adminId.trim().toLowerCase()}@c.kisansetu.app`; }
function govEmail(officialId) { return `${officialId.trim().toLowerCase()}@g.kisansetu.app`; }

async function callFunction(name, payload) {
  if (!FUNCTIONS_BASE_URL) throw new Error("functions-not-configured");
  // createCenterAccount and resetPasswordWithPhone both verify this token
  // server-side with the Admin SDK before doing anything privileged.
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const appCheckHeaders = await getAppCheckHeaders();
  const res = await fetch(`${FUNCTIONS_BASE_URL}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...appCheckHeaders, ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "request-failed");
  return res.json();
}

// Set right before each of the three sign-in calls below, and read once
// here. This is what makes "Government credentials only work on the
// Government login context" actually true: a real, valid account that
// signs in through the wrong tab is signed straight back out again,
// never shown that role's dashboard, because the role check happens
// here against Firestore — not against which tab the browser happened
// to submit.
let pendingLoginRole = null;
let profileProvisioningUid = null;

onAuthStateChanged(auth, async (user) => {
  // Phone OTP creates a temporary Auth session for password recovery.
  // Never route that session into a normal role dashboard.
  if (store.screen === "forgot") {
    store.user = user || null;
    return;
  }

  detachAllListeners();
  if (!user) { store.user = null; store.profile = null; store.screen = "login"; mount(); return; }

  // Prevent the Auth listener from racing the two Firestore profile writes
  // performed immediately after new-account creation.
  if (profileProvisioningUid === user.uid) {
    store.user = user;
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
      if (isGoogle && (pendingLoginRole === null || pendingLoginRole === "farmer")) {
        store.user = user;
        store.googleProfile = { uid: user.uid, name: user.displayName || "", email: user.email || "", photo: user.photoURL || "" };
        store.screen = "googleComplete";
        pendingLoginRole = null;
        mount();
        return;
      }
      pendingLoginRole = null;
      store.user = user; store.screen = "login"; mount(); return;
    }

    const profile = snap.data();
    if (pendingLoginRole && profile.role !== pendingLoginRole) {
      pendingLoginRole = null;
      await signOut(auth);
      store.screen = "login";
      store.crossRoleLoginError = true;
      mount();
      return;
    }

    pendingLoginRole = null;
    store.user = user; store.profile = profile;
    store.lang = store.profile.language || store.lang;
    store.theme = store.profile.theme || store.theme;
    applyTheme();
    store.forcePasswordChange = !!store.profile.mustChangePassword;
    store.screen = store.forcePasswordChange ? "forcePassword" : store.profile.role;
    mount();
  } catch (e) {
    pendingLoginRole = null;
    store.screen = "login"; mount();
  }
});

function detachAllListeners() { Object.values(store._unsub).forEach((fn) => fn && fn()); store._unsub = {}; }

/* ============================== login ============================== */
async function handleFarmerLogin(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  const captchaVal = form.captcha.value;
  clearFormErrors(form);
  let bad = false;
  if (!username) { setFieldError(form, "username", t("field_required")); bad = true; }
  if (!password) { setFieldError(form, "password", t("field_required")); bad = true; }
  if (!checkCaptcha(captchaVal)) { setFieldError(form, "captcha", t("captcha_wrong")); refreshCaptchaWidget(form); bad = true; }
  if (bad) return;
  setBtnLoading(form, true);
  try {
    pendingLoginRole = "farmer";
    await signInWithEmailAndPassword(auth, farmerEmail(username), password);
  } catch (err) {
    pendingLoginRole = null;
    setBtnLoading(form, false);
    showAuthError(form, authErrorMessage(err));
    refreshCaptchaWidget(form);
  }
}
function authErrorMessage(err) {
  switch (err.code) {
    case "auth/network-request-failed": return t("network_error");
    case "auth/user-not-found": return t("wrong_username");
    case "auth/wrong-password": return t("wrong_password");
    case "auth/too-many-requests": return t("too_many_attempts");
    default: return t("login_error");
  }
}

async function handleCenterLogin(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const centerId = form.centerId.value.trim(), adminId = form.adminId.value.trim(), password = form.password.value;
  let bad = false;
  if (!centerId) { setFieldError(form, "centerId", t("field_required")); bad = true; }
  if (!adminId) { setFieldError(form, "adminId", t("field_required")); bad = true; }
  if (!password) { setFieldError(form, "password", t("field_required")); bad = true; }
  if (bad) return;
  setBtnLoading(form, true);
  try {
    pendingLoginRole = "center";
    await signInWithEmailAndPassword(auth, centerEmail(centerId, adminId), password);
  } catch (err) {
    pendingLoginRole = null;
    setBtnLoading(form, false);
    showAuthError(form, authErrorMessage(err));
  }
}

async function handleGovLogin(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const officialId = form.officialId.value.trim(), password = form.password.value, captchaVal = form.captcha.value;
  let bad = false;
  if (!officialId) { setFieldError(form, "officialId", t("field_required")); bad = true; }
  if (!password) { setFieldError(form, "password", t("field_required")); bad = true; }
  if (!checkCaptcha(captchaVal)) { setFieldError(form, "captcha", t("captcha_wrong")); refreshCaptchaWidget(form); bad = true; }
  if (bad) return;
  setBtnLoading(form, true);
  try {
    pendingLoginRole = "gov";
    await signInWithEmailAndPassword(auth, govEmail(officialId), password);
  } catch (err) {
    pendingLoginRole = null;
    setBtnLoading(form, false);
    showAuthError(form, authErrorMessage(err));
    refreshCaptchaWidget(form);
  }
}

const googleProvider = new GoogleAuthProvider();
async function handleGoogleLogin() {
  try {
    pendingLoginRole = "farmer";
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged takes over from here: existing profile -> dashboard,
    // no profile yet -> "googleComplete" screen.
  } catch (err) {
    pendingLoginRole = null;
    if (err.code !== "auth/popup-closed-by-user") showToast(t("network_error"));
  }
}

async function handleForcePasswordChange(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const p1 = form.newPassword.value, p2 = form.confirmPassword.value;
  let bad = false;
  if (p1.length < 8) { setFieldError(form, "newPassword", t("weak_password")); bad = true; }
  if (p1 !== p2) { setFieldError(form, "confirmPassword", t("passwords_no_match")); bad = true; }
  if (bad) return;
  setBtnLoading(form, true);
  try {
    await updatePassword(auth.currentUser, p1);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { mustChangePassword: false });
    store.forcePasswordChange = false;
    store.profile.mustChangePassword = false;
    store.screen = store.profile.role;
    mount();
  } catch (err) {
    setBtnLoading(form, false);
    showAuthError(form, t("session_expired"));
  }
}

function logout() { signOut(auth); }

/* ---- location selector (India -> State -> District -> Block -> Village) ----
   Backed entirely by data/locationAdapter.js, which wraps data/locations.json
   (a Government-LGD-sourced contract file). Where that dataset has no
   entries yet for a given state/district/block, the step shows an inline
   notice instead of inventing options, and does not require that field. */
function districtsFor(stateCode) { return locationAdapter.getDistricts(stateCode); }
function blocksFor(districtCode) { return locationAdapter.getBlocks(districtCode); }
function villagesFor(blockCode) { return locationAdapter.getVillages(blockCode); }
function nameFromList(list, code) {
  const row = list.find((r) => r.code === code);
  return row ? (store.lang === "hi" ? row.nameHi : row.name) : "";
}
function locationSelectHtml(name, label, options, value, disabled) {
  const opts = options.map((o) => `<option value="${esc(o.code)}" ${o.code === value ? "selected" : ""}>${esc(store.lang === "hi" ? o.nameHi : o.name)}</option>`).join("");
  return `<div class="field"><label for="loc-${name}">${label}</label>
    <select id="loc-${name}" name="${name}" ${disabled ? "disabled" : "required"} data-loc-level="${name}">
      <option value="">${t("select_" + name)}</option>${opts}
    </select></div>`;
}
function locationStepHtml(d) {
  if (!locationAdapter.isReady()) return `<p class="tiny muted">${t("loading")}</p>`;
  const states = locationAdapter.getStates();
  const districts = districtsFor(d.stateCode);
  const blocks = districts.length ? blocksFor(d.districtCode) : [];
  const villages = blocks.length ? villagesFor(d.blockCode) : [];
  let html = locationSelectHtml("state", t("state"), states, d.stateCode, false);
  if (!d.stateCode) return html;
  html += districts.length
    ? locationSelectHtml("district", t("district"), districts, d.districtCode, false)
    : `<p class="tiny muted mt-1">${t("location_data_pending")}</p>`;
  if (districts.length && d.districtCode) {
    html += blocks.length
      ? locationSelectHtml("block", t("block"), blocks, d.blockCode, false)
      : `<p class="tiny muted mt-1">${t("location_data_pending")}</p>`;
  }
  if (blocks.length && d.blockCode) {
    html += villages.length
      ? locationSelectHtml("village", t("village"), villages, d.villageCode, false)
      : `<p class="tiny muted mt-1">${t("location_data_pending")}</p>`;
  }
  return html;
}
function wireLocationSelects(root, onChange) {
  root.querySelectorAll("[data-loc-level]").forEach((sel) => {
    sel.addEventListener("change", () => onChange(sel.dataset.locLevel, sel.value));
  });
}

/* ---- main crops multi-select, grouped by category from crops.json ---- */
function cropsStepHtml(selected) {
  if (!cropsAdapter.isReady()) return `<p class="tiny muted">${t("loading")}</p>`;
  const groups = cropsAdapter.getCropsByCategory();
  return `<p class="tiny muted mb-1">${t("main_crops_hint")}</p>
    ${groups.map((g) => `
      <p class="crop-group-title">${esc(g.category || "")}</p>
      <div class="crop-grid">${g.crops.map((c) => `
        <label class="crop-chip"><input type="checkbox" name="crops" value="${esc(c.code)}" ${selected.includes(c.code) ? "checked" : ""}>
          <span>${esc(store.lang === "hi" ? c.nameHi : c.name)}</span></label>`).join("")}</div>`).join("")}`;
}

/* ---- farmer signup ---- */
function updateSignupField(k, v) { store.signupData[k] = v; }
function signupNext(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const d = store.signupData;
  if (store.signupStep === 1) {
    d.fullName = form.fullName.value.trim(); d.mobile = form.mobile.value.trim();
    d.username = form.username.value.trim(); d.password = form.password.value; d.confirmPassword = form.confirmPassword.value;
    let bad = false;
    if (!d.fullName) { setFieldError(form, "fullName", t("field_required")); bad = true; }
    if (!/^[6-9]\d{9}$/.test(d.mobile)) { setFieldError(form, "mobile", t("field_required")); bad = true; }
    if (!/^[a-z0-9._-]{3,30}$/.test(d.username.toLowerCase())) { setFieldError(form, "username", t("field_required")); bad = true; }
    if (d.password.length < 8) { setFieldError(form, "password", t("weak_password")); bad = true; }
    if (d.password !== d.confirmPassword) { setFieldError(form, "confirmPassword", t("passwords_no_match")); bad = true; }
    if (bad) return;
  } else if (store.signupStep === 2) {
    if (!d.stateCode) { setFieldError(form, "state", t("field_required")); return; }
    if (!d.districtCode) { setFieldError(form, "district", t("field_required")); return; }
  } else if (store.signupStep === 3) {
    d.crops = Array.from(form.querySelectorAll('input[name="crops"]:checked')).map((i) => i.value);
    if (!d.crops.length) { showAuthError(form, t("field_required")); return; }
  } else if (store.signupStep === 4) {
    const captchaVal = form.captcha.value, terms = form.terms.checked;
    let bad = false;
    if (!checkCaptcha(captchaVal)) { setFieldError(form, "captcha", t("captcha_wrong")); refreshCaptchaWidget(form); bad = true; }
    if (!terms) { showAuthError(form, t("field_required")); bad = true; }
    if (bad) return;
    return submitSignup(form);
  }
  store.signupStep++;
  paintScreen();
}
function signupBack() { store.signupStep = Math.max(1, store.signupStep - 1); paintScreen(); }

function locationPayload(d) {
  return {
    country: "India",
    state: nameFromList(locationAdapter.getStates(), d.stateCode) || null, stateCode: d.stateCode || null,
    district: nameFromList(districtsFor(d.stateCode), d.districtCode) || null, districtCode: d.districtCode || null,
    block: nameFromList(blocksFor(d.districtCode), d.blockCode) || null, blockCode: d.blockCode || null,
    village: nameFromList(villagesFor(d.blockCode), d.villageCode) || null, villageCode: d.villageCode || null,
    latitude: d.latitude || null, longitude: d.longitude || null,
  };
}

async function submitSignup(form) {
  const d = store.signupData;
  setBtnLoading(form, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, farmerEmail(d.username), d.password);
    profileProvisioningUid = cred.user.uid;
    const userData = {
      uid: cred.user.uid, role: "farmer", name: d.fullName, username: d.username.toLowerCase(),
      authProvider: "password", language: store.lang, theme: "light", status: "active", createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), userData);
    const loc = locationPayload(d);
    const farmerData = {
      name: d.fullName, username: d.username.toLowerCase(), mobile: d.mobile,
      ...loc, mainCrops: d.crops || [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "farmers", cred.user.uid), farmerData);
    profileProvisioningUid = null;
    store.user = cred.user; store.profile = userData;
    store.signupData = { crops: [] }; store.signupStep = 1;
    store.forcePasswordChange = false; store.screen = "farmer";
    mount();
  } catch (err) {
    profileProvisioningUid = null;
    setBtnLoading(form, false);
    showAuthError(form, err.code === "auth/email-already-in-use" ? t("login_error") : t("network_error"));
  }
}

/* ---- forgot password (phone OTP, then a server-side reset) ---- */
function ensureRecaptcha() {
  if (window._recaptchaVerifier) return window._recaptchaVerifier;
  window._recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-slot", { size: "invisible" });
  return window._recaptchaVerifier;
}
async function sendForgotOtp(mobile) {
  if (window._recaptchaVerifier) {
    try { window._recaptchaVerifier.clear(); } catch (_) {}
    window._recaptchaVerifier = null;
  }
  const verifier = ensureRecaptcha();
  store._confirmResult = await signInWithPhoneNumber(auth, "+91" + mobile, verifier);
  store.forgotStep = "otp";
  paintScreen();
}
async function forgotSendOtp(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const mobile = form.mobile.value.trim();
  if (!/^[6-9]\d{9}$/.test(mobile)) { setFieldError(form, "mobile", t("field_required")); return; }
  store.forgotData.mobile = mobile;
  setBtnLoading(form, true);
  try { await sendForgotOtp(mobile); }
  catch (_) { setBtnLoading(form, false); showAuthError(form, t("network_error")); }
}
async function forgotVerifyOtp(otp) {
  try {
    const result = await store._confirmResult.confirm(otp);
    const idToken = await result.user.getIdToken();
    store.forgotData.idToken = idToken;
    await signOut(auth);
    store.forgotStep = "reset";
    paintScreen();
  } catch (err) {
    showToast(t("otp_invalid"));
  }
}
async function forgotResetPassword(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const p1 = form.newPassword.value, p2 = form.confirmPassword.value;
  let bad = false;
  if (p1.length < 8) { setFieldError(form, "newPassword", t("weak_password")); bad = true; }
  if (p1 !== p2) { setFieldError(form, "confirmPassword", t("passwords_no_match")); bad = true; }
  if (bad) return;
  setBtnLoading(form, true);
  try {
    await callFunction("resetPasswordWithPhone", { idToken: store.forgotData.idToken, newPassword: p1 });
    store.forgotStep = "done";
    paintScreen();
  } catch (err) {
    setBtnLoading(form, false);
    showAuthError(form, "यह सुविधा सर्वर सेटअप (functions/index.js) जोड़े जाने पर सक्रिय होगी।");
  }
}
function exitForgot() { store.screen = "login"; store.forgotStep = "identify"; store.forgotData = {}; paintScreen(); }

/* ============================== form helpers ============================== */
function clearFormErrors(form) {
  form.querySelectorAll(".field").forEach((f) => f.classList.remove("error"));
  form.querySelectorAll(".field-error").forEach((e) => e.remove());
  const banner = form.querySelector(".auth-error-banner"); if (banner) banner.remove();
}
function setFieldError(form, name, msg) {
  const input = form.elements[name]; if (!input) return;
  const field = input.closest(".field"); if (!field) return;
  field.classList.add("error");
  const p = document.createElement("p"); p.className = "field-error"; p.textContent = msg;
  field.appendChild(p);
}
function showAuthError(form, msg) {
  const div = document.createElement("div");
  div.className = "alert danger auth-error-banner"; div.innerHTML = `${ic("alert")}<span>${esc(msg)}</span>`;
  form.prepend(div);
}
function setBtnLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = loading; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = loading ? t("loading") : btn.dataset.label; }
}

/* ============================== auth screens ============================== */
function langToggleHtml() {
  return `<div class="lang-toggle" role="group" aria-label="${t("language")}">
    <button type="button" aria-pressed="${store.lang === "hi"}" data-lang="hi">हिंदी</button>
    <button type="button" aria-pressed="${store.lang === "en"}" data-lang="en">English</button>
  </div>`;
}

function captchaHtml() {
  return `<div class="field">
    <label for="captcha-input">${t("captcha")}</label>
    <div class="captcha-box">
      <span class="captcha-challenge" aria-hidden="true">${store.captcha.a} + ${store.captcha.b} = ?</span>
      <input id="captcha-input" name="captcha" inputmode="numeric" autocomplete="off" aria-label="${t("captcha")}" style="width:64px" required>
      <button type="button" class="icon-btn captcha-refresh" id="captcha-refresh" aria-label="${t("captcha_refresh")}">${ic("history", 16)}</button>
    </div>
  </div>`;
}

function loginFormHtml() {
  if (store.authTab === "farmer") {
    return `<form id="login-form" novalidate>
      <div class="field"><label for="lf-username">${t("username")}</label>
        <input id="lf-username" name="username" autocomplete="username" required></div>
      <div class="field"><label for="lf-password">${t("password")}</label>
        <div class="input-wrap">
          <button type="button" class="password-toggle" data-toggle="lf-password" aria-label="${t("show_password")}">${ic("eye", 16)}</button>
          <input id="lf-password" name="password" type="password" autocomplete="current-password" required>
        </div></div>
      ${captchaHtml()}
      <div class="auth-links-row"><span></span><button type="button" class="link-btn" id="go-forgot">${t("forgot_password")}</button></div>
      <button class="btn block mt-2" type="submit">${t("sign_in")}</button>
      <div class="auth-divider"><span>${t("or_divider")}</span></div>
      <button type="button" class="btn ghost block google-btn" id="go-google">${ic("google", 16)}${t("continue_with_google")}</button>
      <p class="auth-switch">${t("no_account")} <button type="button" class="link-btn" id="go-signup">${t("sign_up")}</button></p>
    </form>`;
  }
  if (store.authTab === "center") {
    return `<form id="login-form" novalidate>
      <div class="field"><label for="lf-centerid">${t("center_id")}</label><input id="lf-centerid" name="centerId" required></div>
      <div class="field"><label for="lf-adminid">${t("admin_id")}</label><input id="lf-adminid" name="adminId" required></div>
      <div class="field"><label for="lf-cpassword">${t("password")}</label>
        <div class="input-wrap">
          <button type="button" class="password-toggle" data-toggle="lf-cpassword" aria-label="${t("show_password")}">${ic("eye", 16)}</button>
          <input id="lf-cpassword" name="password" type="password" autocomplete="current-password" required>
        </div></div>
      <div class="auth-links-row"><span></span><button type="button" class="link-btn" id="go-forgot">${t("forgot_password")}</button></div>
      <button class="btn block mt-2" type="submit">${t("sign_in")}</button>
    </form>`;
  }
  return `<form id="login-form" novalidate>
    <div class="field"><label for="lf-officialid">${t("official_id")}</label><input id="lf-officialid" name="officialId" required></div>
    <div class="field"><label for="lf-gpassword">${t("password")}</label>
      <div class="input-wrap">
        <button type="button" class="password-toggle" data-toggle="lf-gpassword" aria-label="${t("show_password")}">${ic("eye", 16)}</button>
        <input id="lf-gpassword" name="password" type="password" autocomplete="current-password" required>
      </div></div>
    ${captchaHtml()}
    <button class="btn block mt-2" type="submit">${t("sign_in")}</button>
  </form>`;
}

function paintLoginForm() {
  paint("login-form-slot", loginFormHtml());
  wireLoginForm();
}
function wireLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;
  const handlers = { farmer: handleFarmerLogin, center: handleCenterLogin, gov: handleGovLogin };
  form.addEventListener("submit", handlers[store.authTab]);
  const goForgot = document.getElementById("go-forgot");
  if (goForgot) goForgot.addEventListener("click", () => { store.screen = "forgot"; store.forgotStep = "identify"; paintScreen(); });
  const goSignup = document.getElementById("go-signup");
  if (goSignup) goSignup.addEventListener("click", () => { store.screen = "signup"; store.signupStep = 1; paintScreen(); });
  const goGoogle = document.getElementById("go-google");
  if (goGoogle) goGoogle.addEventListener("click", handleGoogleLogin);
  const refresh = document.getElementById("captcha-refresh");
  if (refresh) refresh.addEventListener("click", () => refreshCaptchaWidget(form));
  wirePasswordToggles(form);
}
function wirePasswordToggles(scope) {
  scope.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.toggle);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.innerHTML = ic(showing ? "eye" : "eyeOff", 16);
      btn.setAttribute("aria-label", showing ? t("show_password") : t("hide_password"));
    });
  });
}

function screenLogin() {
  return `<div class="auth-shell">
    <div class="auth-visual">
      <div class="row" style="gap:10px"><div class="brand-mark"><div class="glyph">${ic("sprout", 20)}</div>
        <div class="brand-name brand-face" style="color:var(--cream)">${t("brand")}</div></div></div>
      <div>
        <h2>${t("tagline")}</h2>
        <p>${store.lang === "hi" ? "टोकन बुक करें, कतार देखें, और अपनी खरीद का पूरा रिकॉर्ड एक ही जगह पाएँ।" : "Book a token, track the queue, and keep your full purchase record in one place."}</p>
      </div>
      <div class="field-motif" aria-hidden="true">${fieldMotifSvg()}</div>
    </div>
    <div class="auth-panel">
      <div class="auth-card">
        <div class="auth-lang">${langToggleHtml()}</div>
        <div class="auth-brand"><div class="glyph">${ic("sprout", 20)}</div><div class="auth-brand-name brand-face">${t("brand")}</div></div>
        <p class="auth-tagline">${t("tagline")}</p>
        <div class="role-cards" role="tablist" aria-label="role">
          ${roleCard("farmer", "user", t("role_farmer"))}
          ${roleCard("center", "building", t("role_center"))}
          ${roleCard("gov", "users", t("role_gov"))}
        </div>
        <div id="login-form-slot">${loginFormHtml()}</div>
        <div class="auth-foot-links">
          <button type="button" id="go-about">${t("about")}</button>
          <button type="button" id="go-help">${t("help")}</button>
        </div>
      </div>
    </div>
  </div>
  <div id="recaptcha-slot"></div>`;
}
function roleCard(key, icon, label) {
  return `<button type="button" class="role-card" data-role-tab="${key}" aria-pressed="${store.authTab === key}">${ic(icon, 18)}<span>${label}</span></button>`;
}
function fieldMotifSvg() {
  return `<svg viewBox="0 0 320 200" width="100%" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,150 C60,120 120,170 180,140 S300,110 320,130 L320,200 L0,200 Z" fill="rgba(251,249,241,0.10)"/>
    <path d="M0,170 C70,150 130,185 200,160 S300,140 320,155 L320,200 L0,200 Z" fill="rgba(251,249,241,0.16)"/>
    ${[40, 90, 150, 210, 265].map((x, i) => `<g transform="translate(${x},${150 - (i % 2) * 8})">
      <path d="M0,40 L0,10" stroke="rgba(251,249,241,0.5)" stroke-width="2"/>
      <path d="M0,10 C-10,0 -14,-14 -6,-22" stroke="rgba(251,249,241,0.55)" stroke-width="2" fill="none"/>
      <path d="M0,16 C10,8 14,-4 8,-14" stroke="rgba(251,249,241,0.55)" stroke-width="2" fill="none"/>
    </g>`).join("")}
  </svg>`;
}

function screenSignup() {
  const d = store.signupData;
  const steps = [t("signup_step1"), t("signup_step2"), t("signup_step3"), t("signup_step4")];
  const stepHtml = `<div class="stepper" aria-hidden="true">${steps.map((_, i) => `<span class="step ${i + 1 < store.signupStep ? "done" : i + 1 === store.signupStep ? "active" : ""}"></span>`).join("")}</div>
    <p class="step-label">${t("step")} ${store.signupStep}/4 — ${steps[store.signupStep - 1]}</p>`;
  let fields = "";
  if (store.signupStep === 1) {
    fields = `<div class="field"><label for="su-fullname">${t("full_name")}</label><input id="su-fullname" name="fullName" autocomplete="name" value="${esc(d.fullName || "")}" required></div>
      <div class="field"><label for="su-mobile">${t("mobile")}</label><input id="su-mobile" name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" value="${esc(d.mobile || "")}" required></div>
      <div class="field"><label for="su-username">${t("username")}</label><input id="su-username" name="username" autocomplete="username" value="${esc(d.username || "")}" required></div>
      <div class="field"><label for="su-password">${t("password")}</label><input id="su-password" name="password" type="password" autocomplete="new-password" required></div>
      <div class="field"><label for="su-confirm">${t("confirm_password")}</label><input id="su-confirm" name="confirmPassword" type="password" autocomplete="new-password" required></div>`;
  } else if (store.signupStep === 2) {
    fields = `<div id="location-fields">${locationStepHtml(d)}</div>`;
  } else if (store.signupStep === 3) {
    fields = cropsStepHtml(d.crops || []);
  } else {
    fields = `${captchaHtml()}
      <label class="checkbox-row"><input type="checkbox" name="terms" required><span>${t("accept_terms")}</span></label>`;
  }
  return `<div class="auth-panel" style="min-height:100vh">
    <div class="auth-card">
      <div class="auth-lang">${langToggleHtml()}</div>
      <div class="auth-brand"><div class="glyph">${ic("sprout", 20)}</div><div class="auth-brand-name brand-face">${t("brand")}</div></div>
      ${stepHtml}
      <form id="signup-form" novalidate>
        ${fields}
        <div class="row gap-s mt-2">
          ${store.signupStep > 1 ? `<button type="button" class="btn ghost" id="signup-back">${t("back")}</button>` : ""}
          <button type="submit" class="btn ${store.signupStep === 4 ? "" : "alt"}" style="flex:1">${store.signupStep === 4 ? t("submit") : t("next")}</button>
        </div>
      </form>
      <p class="auth-switch">${t("have_account")} <button type="button" class="link-btn" id="signup-exit">${t("sign_in")}</button></p>
    </div>
  </div>`;
}

/* ---- Google first-time profile completion (mobile, location, crops) ----
   Google already supplies name, email, uid and photo; it never supplies a
   phone number, so that is always asked here, along with location and crops
   — the same fields a password-based farmer signup collects, minus the
   username/password which Google auth already replaces. */
function googleCompleteNext(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const d = store.googleData;
  if (store.googleStep === 1) {
    d.mobile = form.mobile.value.trim();
    if (!/^[6-9]\d{9}$/.test(d.mobile)) { setFieldError(form, "mobile", t("field_required")); return; }
  } else if (store.googleStep === 2) {
    if (!d.stateCode) { setFieldError(form, "state", t("field_required")); return; }
    if (!d.districtCode) { setFieldError(form, "district", t("field_required")); return; }
  } else if (store.googleStep === 3) {
    d.crops = Array.from(form.querySelectorAll('input[name="crops"]:checked')).map((i) => i.value);
    if (!d.crops.length) { showAuthError(form, t("field_required")); return; }
    return submitGoogleProfile(form);
  }
  store.googleStep++;
  paintScreen();
}
function googleCompleteBack() { store.googleStep = Math.max(1, store.googleStep - 1); paintScreen(); }

async function submitGoogleProfile(form) {
  const d = store.googleData, g = store.googleProfile;
  setBtnLoading(form, true);
  try {
    profileProvisioningUid = g.uid;
    const userData = {
      uid: g.uid, role: "farmer", name: g.name, email: g.email, photo: g.photo || null,
      authProvider: "google", language: store.lang, theme: store.theme, status: "active", createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", g.uid), userData);
    const loc = locationPayload(d);
    await setDoc(doc(db, "farmers", g.uid), {
      name: g.name, email: g.email, mobile: d.mobile,
      ...loc, mainCrops: d.crops || [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    profileProvisioningUid = null;
    store.user = auth.currentUser; store.profile = userData;
    store.googleProfile = null; store.googleStep = 1; store.googleData = { crops: [] };
    store.forcePasswordChange = false; store.screen = "farmer";
    mount();
  } catch (err) {
    profileProvisioningUid = null;
    setBtnLoading(form, false);
    showAuthError(form, t("network_error"));
  }
}

function screenGoogleComplete() {
  const d = store.googleData, g = store.googleProfile || {};
  const steps = [t("mobile"), t("signup_step2"), t("signup_step3")];
  const stepHtml = `<div class="stepper" aria-hidden="true">${steps.map((_, i) => `<span class="step ${i + 1 < store.googleStep ? "done" : i + 1 === store.googleStep ? "active" : ""}"></span>`).join("")}</div>`;
  let fields = "";
  if (store.googleStep === 1) {
    fields = `<div class="field"><label for="gc-mobile">${t("mobile")}</label><input id="gc-mobile" name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" value="${esc(d.mobile || "")}" required></div>`;
  } else if (store.googleStep === 2) {
    fields = `<div id="location-fields">${locationStepHtml(d)}</div>`;
  } else {
    fields = cropsStepHtml(d.crops || []);
  }
  return `<div class="auth-panel" style="min-height:100vh">
    <div class="auth-card">
      <div class="auth-brand"><div class="glyph">${ic("sprout", 20)}</div><div class="auth-brand-name brand-face">${t("brand")}</div></div>
      <h1 style="font-size:19px">${t("complete_profile")}</h1>
      <p class="muted mt-1 mb-1">${t("complete_profile_hint")}</p>
      ${stepHtml}
      <form id="google-complete-form" novalidate>
        ${fields}
        <div class="row gap-s mt-2">
          ${store.googleStep > 1 ? `<button type="button" class="btn ghost" id="google-back">${t("back")}</button>` : ""}
          <button type="submit" class="btn" style="flex:1">${store.googleStep === 3 ? t("submit") : t("next")}</button>
        </div>
      </form>
    </div>
  </div>`;
}

function screenForgot() {
  const step = store.forgotStep;
  let body = "";
  if (step === "identify") {
    body = `<p class="muted mt-1">${t("forgot_identify")}</p>
      <form id="forgot-id-form" novalidate>
        <div class="field"><label for="fg-mobile">${t("mobile")}</label><input id="fg-mobile" name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" required></div>
        <button type="submit" class="btn block mt-2">${t("submit")}</button>
      </form>`;
  } else if (step === "otp") {
    body = `<p class="muted mt-1">${t("otp_sent")} +91 ${esc(store.forgotData.mobile || "")}</p>
      <div class="otp-row" id="otp-boxes">${Array.from({ length: 6 }).map((_, i) => `<input inputmode="numeric" maxlength="1" data-otp-index="${i}">`).join("")}</div>
      <p class="otp-resend"><button type="button" class="link-btn" id="otp-resend">${t("resend_otp")}</button></p>`;
  } else if (step === "reset") {
    body = `<form id="reset-form" novalidate>
      <div class="field"><label for="reset-newpw">${t("new_password")}</label><input id="reset-newpw" name="newPassword" type="password" autocomplete="new-password" required></div>
      <div class="field"><label for="reset-confirmpw">${t("confirm_password")}</label><input id="reset-confirmpw" name="confirmPassword" type="password" autocomplete="new-password" required></div>
      <button type="submit" class="btn block mt-2">${t("save")}</button>
    </form>`;
  } else {
    body = `<div class="alert ok">${ic("checkCircle")}<span>${t("password_changed")}</span></div>
      <button class="btn block mt-2" id="forgot-done">${t("sign_in")}</button>`;
  }
  return `<div class="auth-panel" style="min-height:100vh">
    <div class="auth-card">
      <div class="auth-brand"><div class="glyph">${ic("sprout", 20)}</div><div class="auth-brand-name brand-face">${t("brand")}</div></div>
      <h1 style="font-size:19px">${t("forgot_password")}</h1>
      <div id="forgot-body">${body}</div>
      <p class="auth-switch"><button type="button" class="link-btn" id="forgot-exit">${t("sign_in")}</button></p>
    </div>
  </div>
  <div id="recaptcha-slot"></div>`;
}

function screenForcePassword() {
  return `<div class="auth-panel" style="min-height:100vh">
    <div class="auth-card">
      <div class="auth-brand"><div class="glyph">${ic("sprout", 20)}</div><div class="auth-brand-name brand-face">${t("brand")}</div></div>
      <h1 style="font-size:19px">${t("force_password_change")}</h1>
      <form id="force-pw-form" novalidate>
        <div class="field"><label for="fp-newpw">${t("new_password")}</label><input id="fp-newpw" name="newPassword" type="password" autocomplete="new-password" required></div>
        <div class="field"><label for="fp-confirmpw">${t("confirm_password")}</label><input id="fp-confirmpw" name="confirmPassword" type="password" autocomplete="new-password" required></div>
        <button type="submit" class="btn block mt-2">${t("set_password")}</button>
      </form>
    </div>
  </div>`;
}

/* ============================== app shell (post-login) ============================== */
function roleLabel() {
  const role = store.profile.role;
  if (role === "farmer") return store.profile.name;
  if (role === "center") return store.profile.centerName || t("role_center");
  return t("role_gov");
}
function navItemsFor(role) {
  if (role === "farmer") return [["home", "mapPin", t("nav_home")], ["token", "ticket", t("nav_token")], ["history", "history", t("nav_history")], ["notif", "bell", t("nav_notif")], ["help", "help", t("nav_help")]];
  if (role === "center") return [["queue", "users", t("nav_queue")], ["capacity", "settings", t("nav_capacity")], ["notif", "bell", t("nav_notif")], ["settings", "user", t("nav_settings")]];
  return [["overview", "chart", t("nav_overview")], ["centers", "building", t("nav_centers")], ["register", "plus", t("nav_register")], ["alerts", "alert", t("nav_alerts")], ["settings", "settings", t("nav_settings")]];
}
function currentTabKey() { return store.profile.role === "farmer" ? store.farmerTab : store.profile.role === "center" ? store.centerTab : store.govTab; }
function setTabKey(k) {
  if (store.profile.role === "farmer") store.farmerTab = k;
  else if (store.profile.role === "center") store.centerTab = k;
  else store.govTab = k;
  detachAllListeners();
  mount();
}

function appShellHtml(bodyHtml) {
  const items = navItemsFor(store.profile.role);
  const active = currentTabKey();
  return `<header class="topbar">
    <div class="brand-mark"><div class="glyph">${ic("sprout", 18)}</div>
      <div class="brand-name brand-face">${t("brand")}<small>${esc(roleLabel())}</small></div></div>
    <nav class="top-tabs">${items.map(([k, icon, label]) => `<button data-tab="${k}" aria-current="${active === k}">${ic(icon, 16)}${label}</button>`).join("")}</nav>
    <div class="spacer"></div>
    <div class="topbar-actions">
      ${langToggleHtml()}
      <button class="icon-btn" id="theme-toggle" aria-label="${t("toggle_theme")}">${ic(store.theme === "dark" ? "sun" : "moon", 17)}</button>
      <div class="account-menu">
        <button class="account-btn" id="account-btn"><span class="account-avatar">${esc((roleLabel() || "?").slice(0, 1))}</span>${ic("chevDown", 15)}</button>
        <div class="account-panel ${store.accountOpen ? "open" : ""}" id="account-panel">
          <button id="acct-settings">${ic("settings", 16)}${t("profile")}</button>
          <div class="divider"></div>
          <button class="danger" id="acct-logout">${ic("logout", 16)}${t("logout")}</button>
        </div>
      </div>
    </div>
  </header>
  <nav class="role-tabs">${items.map(([k, icon, label]) => `<button data-tab="${k}" aria-current="${active === k}">${ic(icon, 16)}${label}</button>`).join("")}</nav>
  <main id="main-content">${bodyHtml}</main>
  <nav class="bottom-nav">${items.slice(0, 5).map(([k, icon, label]) => `<button data-tab="${k}" aria-current="${active === k}">${ic(icon)}<span>${label}</span></button>`).join("")}</nav>`;
}

function wireShell() {
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => setTabKey(b.dataset.tab)));
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", () => setTheme(store.theme === "dark" ? "light" : "dark"));
  const acctBtn = document.getElementById("account-btn");
  if (acctBtn) acctBtn.addEventListener("click", () => { store.accountOpen = !store.accountOpen; document.getElementById("account-panel").classList.toggle("open", store.accountOpen); });
  const acctLogout = document.getElementById("acct-logout");
  if (acctLogout) acctLogout.addEventListener("click", logout);
  const acctSettings = document.getElementById("acct-settings");
  if (acctSettings) acctSettings.addEventListener("click", () => setTabKey("settings"));
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("account-panel"), btn = document.getElementById("account-btn");
    if (panel && store.accountOpen && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      store.accountOpen = false; panel.classList.remove("open");
    }
  }, { once: false });
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state">${ic(icon, 34)}<div class="empty-title">${title}</div><p class="tiny">${desc}</p></div>`;
}

/* ============================== farmer views ============================== */
function farmerBody() {
  const tab = store.farmerTab;
  if (tab === "home") return `<div id="farmer-home">${loadingBlock()}</div>`;
  if (tab === "token") return `<div id="farmer-token">${loadingBlock()}</div>`;
  if (tab === "history") return `<h2 class="section-title">${t("purchase_history")}</h2><div id="farmer-history">${loadingBlock()}</div>`;
  if (tab === "notif") return `<h2 class="section-title">${t("notifications")}</h2><div id="farmer-notif">${loadingBlock()}</div>`;
  if (tab === "help") return farmerHelp();
  if (tab === "settings") return farmerSettings();
  return "";
}
function loadingBlock() { return `<div class="card muted tiny">${t("loading")}</div>`; }

function farmerHelp() {
  const faqs = [["faq_book", "faq_book_a"], ["faq_reach", "faq_reach_a"], ["faq_cancel", "faq_cancel_a"], ["faq_payment", "faq_payment_a"], ["faq_reset", "faq_reset_a"]];
  return `<h2 class="section-title">${t("help_title")}</h2>
    <div class="card">${faqs.map(([q, a]) => `<div class="faq-item"><button class="faq-q">${t(q)}${ic("chevDown", 16)}</button><p class="faq-a">${t(a)}</p></div>`).join("")}</div>
    <h2 class="section-title">${t("contact_help")}</h2>
    <div class="card tiny muted">${t("contact_note")}</div>
    <h2 class="section-title">${t("about")}</h2>
    <div class="card about-block"><h3>${t("about_title")}</h3><p>${t("about_body")}</p></div>`;
}

function renderNearbyCenters(centers) {
  if (!centers.length) return emptyState("mapPin", t("no_centers_found"), t("no_centers_desc"));
  const sorted = [...centers].sort((a, b) => {
    if (store.sortBy === "wait") return (a.estWait ?? 999) - (b.estWait ?? 999);
    if (store.sortBy === "token") return (b.tokenAvailability ?? 0) - (a.tokenAvailability ?? 0);
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });
  return `<div class="sort-bar">
      <button data-sort="nearest" aria-pressed="${store.sortBy === "nearest"}">${t("sort_nearest")}</button>
      <button data-sort="wait" aria-pressed="${store.sortBy === "wait"}">${t("sort_wait")}</button>
      <button data-sort="token" aria-pressed="${store.sortBy === "token"}">${t("sort_token")}</button>
    </div>
    <div class="card">${sorted.slice(0, 5).map((c) => `<div class="center-item">
      <div>
        <div class="name">${esc(c.centerName)}</div>
        <div class="meta-line">
          ${c.distanceKm != null ? `<span>${c.distanceKm} ${t("km_away")}</span>` : ""}
          <span>${t("queue_len")}: ${c.queueLength ?? 0}</span>
          <span>${t("est_wait")}: ${c.estWait != null ? c.estWait + " min" : "—"}</span>
          <span class="badge ${c.govStatus !== "active" ? "red" : c.status === "open" ? "green" : "red"}">${c.govStatus !== "active" ? t("gov_inactive") : c.status === "open" ? t("open_now") : t("closed_now")}</span>
        </div>
      </div>
      <div class="actions"><button class="btn gold" data-book="${c.id}" ${c.govStatus !== "active" || c.status !== "open" ? "disabled" : ""}>${t("book_token")}</button></div>
    </div>`).join("")}</div>`;
}

function subscribeFarmerHome() {
  const f = store.profile;
  getDoc(doc(db, "farmers", store.user.uid)).then((snap) => {
    const farmer = snap.exists() ? snap.data() : {};
    const q1 = query(collection(db, "centers"), where("districtCode", "==", farmer.districtCode), limit(20));
    store._unsub.centers = onSnapshot(q1, (qs) => {
      const centers = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      paint("farmer-home", `<h2 class="section-title">${t("nearby_centers")}</h2>${renderNearbyCenters(centers)}`);
      document.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { store.sortBy = b.dataset.sort; subscribeFarmerHome(); }));
      document.querySelectorAll("[data-book]").forEach((b) => b.addEventListener("click", () => startBooking(b.dataset.book, centers.find((c) => c.id === b.dataset.book))));
    });
  });
}

/* Spark-plan token booking: the farmer's own browser tab writes the token
   document directly (no Cloud Function/Admin SDK on this plan).
   The document ID is fixed to the farmer's own Auth uid rather than a
   random ID. That single choice is what makes "only one active token per
   farmer" an atomic, server-enforced guarantee instead of a client-side
   hope: Firestore itself classifies a write to an existing document as an
   "update", never a "create", so a second booking attempt while a token
   is still "waiting" is evaluated against the tokens `allow update` rule,
   whose rebooking branch requires the existing token to already be
   resolved (not "waiting") — so no matter how many booking attempts race
   each other, at most one waiting token can ever exist for this farmer.
   The same rule lets the farmer book again once their previous token is
   cancelled (or later, done/no-show), which is what makes this a
   reusable per-farmer slot rather than a one-time-use document. The
   pre-check below (reading tokens/{uid}) only exists to show a friendly
   message instead of a raw permission error; it is not what provides the
   uniqueness guarantee, and the catch block still handles the case where
   the pre-check missed a concurrent write. */
function startBooking(centerId, center) {
  if (!center || center.govStatus !== "active" || center.status !== "open") return;
  openModal({
    title: t("book_token"), body: `${esc(center.centerName)} — ${t("est_wait")}: ${center.estWait ?? "—"} min`,
    confirmText: t("book_token"), cancelText: t("cancel"),
    onConfirm: async () => {
      if (!auth.currentUser) { showToast(t("network_error")); return; }
      const uid = auth.currentUser.uid;

      // Pre-check: read this farmer's own deterministic token slot
      // (tokens/{uid}). With the fixed rules this `get` always succeeds
      // for an active farmer on their own uid, whether or not the
      // document exists yet — so a failure here is a real, separate
      // problem (network/auth/rules), never evidence of an active token.
      let existingSnap;
      try {
        existingSnap = await getDoc(doc(db, "tokens", uid));
        // TEMP DIAGNOSTIC — remove once verified end-to-end (see note below).
        console.log("[bookToken] pre-check:", {
          exists: existingSnap.exists(),
          status: existingSnap.exists() ? existingSnap.data().status : null,
        });
      } catch (e) {
        console.error("[bookToken] pre-check failed:", e.code, e.message, e);
        showToast(t("network_error"));
        return;
      }
      // "Active token exists" is shown ONLY when the pre-check actually
      // found a document AND that document's status is "waiting" — never
      // inferred from an error of any kind.
      if (existingSnap.exists() && existingSnap.data().status === "waiting") {
        showToast(t("active_token_exists"));
        return;
      }

      try {
        // Re-read the center fresh so we don't trust a possibly-stale
        // listener snapshot; the rules re-check this again server-side
        // regardless.
        const centerSnap = await getDoc(doc(db, "centers", centerId));
        if (!centerSnap.exists() || centerSnap.data().govStatus !== "active" || centerSnap.data().status !== "open") {
          showToast(t("network_error"));
          return;
        }
        // The farmer's display name always comes from their own
        // users/{uid} document, never from anything typed on this screen.
        const userSnap = await getDoc(doc(db, "users", uid));
        const farmerName = userSnap.exists() ? userSnap.data().name : "";
        await setDoc(doc(db, "tokens", uid), {
          farmerId: uid,
          farmerName,
          centerId,
          status: "waiting",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        // TEMP DIAGNOSTIC — remove once verified end-to-end (see note below).
        console.log("[bookToken] token document written:", uid);

        // Verify the write actually landed before switching screens.
        const verifySnap = await getDoc(doc(db, "tokens", uid));
        console.log("[bookToken] verify after write:", {
          exists: verifySnap.exists(),
          data: verifySnap.exists() ? verifySnap.data() : null,
        });

        showToast(t("saved")); store.farmerTab = "token"; mount();
      } catch (e) {
        console.error("[bookToken] Firestore write failed:", e.code, e.message, e);
        // A failure reaching this point is NOT "active token exists" —
        // the pre-check above already ruled that out. It's a genuine
        // write-time rejection (e.g. center not open/active, farmerName
        // mismatch) and gets a generic error, not a false "already
        // booked" message.
        showToast(t("network_error"));
      }
    },
  });
}

function subscribeFarmerToken() {
  const q1 = query(collection(db, "tokens"), where("farmerId", "==", store.user.uid), where("status", "==", "waiting"), limit(1));
  store._unsub.myToken = onSnapshot(q1, async (qs) => {
    if (qs.empty) { paint("farmer-token", emptyState("ticket", t("no_active_token"), t("no_active_token_desc"))); return; }
    const tok = { id: qs.docs[0].id, ...qs.docs[0].data() };
    const centerSnap = await getDoc(doc(db, "centers", tok.centerId));
    const center = centerSnap.exists() ? centerSnap.data() : {};
    paint("farmer-token", `<h2 class="section-title">${t("my_token")}</h2>
      <div class="token-card">
        <span class="status-pill badge gold">${t("token_status_waiting")}</span>
        <div class="token-num">#${tok.id.slice(-6).toUpperCase()}</div>
        <div class="token-meta">
          <div><div class="k">${t("center_id")}</div><div class="v">${esc(center.centerName || tok.centerId)}</div></div>
          <div><div class="k">${t("queue_position")}</div><div class="v">${tok.queuePosition ?? "—"}</div></div>
          <div><div class="k">${t("est_wait")}</div><div class="v">${center.estWait != null ? center.estWait + " min" : "—"}</div></div>
        </div>
      </div>
      <button class="btn ghost mt-2" id="cancel-token-btn">${t("cancel_token")}</button>`);
    document.getElementById("cancel-token-btn").addEventListener("click", () => {
      openModal({
        title: t("cancel_token_confirm_title"), body: t("cancel_token_confirm_body"),
        confirmText: t("yes_cancel"), cancelText: t("no_keep"), danger: true,
        onConfirm: async () => {
          // Spark-plan cancel: a direct Firestore update instead of a
          // Cloud Function. The token document ID is the farmer's own
          // uid (see startBooking), so `tok.id` here is always this
          // farmer's own uid — there is no separate tokenId to trust
          // from the UI. The rules independently re-check ownership
          // (farmerId == request.auth.uid), that the token is still
          // "waiting" (you can't "cancel" a token that's already been
          // served/cancelled/no-show), and that this write touches only
          // status + updatedAt.
          try {
            await updateDoc(doc(db, "tokens", tok.id), {
              status: "cancelled",
              updatedAt: serverTimestamp(),
            });
            showToast(t("saved"));
          } catch (e) {
            console.error("[cancelToken] Firestore write failed:", e.code, e.message, e);
            showToast(t("network_error"));
          }
        },
      });
    });
  });
}

function subscribeFarmerHistory() {
  const q1 = query(collection(db, "purchases"), where("farmerId", "==", store.user.uid), orderBy("purchaseDate", "desc"), limit(5));
  store._unsub.history = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("farmer-history", emptyState("history", t("no_history"), t("no_history_desc"))); return; }
    paint("farmer-history", `<div class="card">${qs.docs.map((d) => {
      const p = d.data();
      const date = p.purchaseDate?.toDate ? p.purchaseDate.toDate().toLocaleDateString("hi-IN") : "";
      return `<div class="history-item"><div>
          <div class="row gap-s"><b>${esc(p.crop)}</b><span class="tiny muted">${date}</span></div>
          <div class="tiny muted">${esc(p.centerName || p.centerId)} · ${esc(p.quantity)} · ${t("grade")}: ${esc(p.grade || "—")}</div>
        </div>
        <div class="amount">${fmtINR(p.amount)}<div><span class="badge ${p.paymentStatus === "paid" ? "green" : p.paymentStatus === "processing" ? "gold" : "muted"}">${t(p.paymentStatus || "pending")}</span></div></div>
      </div>`;
    }).join("")}</div>`);
  }, () => paint("farmer-history", emptyState("history", t("no_history"), t("no_history_desc"))));
}

function subscribeFarmerNotif() {
  const q1 = query(collection(db, "notifications"), where("userId", "==", store.user.uid), orderBy("createdAt", "desc"), limit(20));
  store._unsub.notif = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("farmer-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))); return; }
    paint("farmer-notif", `<div class="card">${qs.docs.map((d) => {
      const n = d.data();
      return `<div class="history-item"><span>${esc(n.text)}</span></div>`;
    }).join("")}</div>`);
  }, () => paint("farmer-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))));
}

/* ============================== center views ============================== */
function centerBody() {
  const tab = store.centerTab;
  if (tab === "queue") return `<h2 class="section-title">${t("queue_title")}</h2><div id="center-queue">${loadingBlock()}</div>`;
  if (tab === "capacity") return `<h2 class="section-title">${t("center_status")}</h2><div id="center-capacity">${loadingBlock()}</div>`;
  if (tab === "notif") return `<h2 class="section-title">${t("notifications")}</h2><div id="center-notif">${loadingBlock()}</div>`;
  if (tab === "settings") return centerSettings();
  return "";
}
function centerSettings() {
  return `<h2 class="section-title">${t("change_password")}</h2>
  <div class="card" style="max-width:420px">
    <form id="center-pw-form" novalidate>
      <div class="field"><label for="cpw-old">${t("password")}</label><input id="cpw-old" name="oldPassword" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="cpw-new">${t("new_password")}</label><input id="cpw-new" name="newPassword" type="password" autocomplete="new-password" required></div>
      <div class="field"><label for="cpw-confirm">${t("confirm_password")}</label><input id="cpw-confirm" name="confirmPassword" type="password" autocomplete="new-password" required></div>
      <button class="btn" type="submit">${t("save")}</button>
    </form>
  </div>`;
}

function farmerSettings() {
  return `<h2 class="section-title">${t("change_password")}</h2>
  <div class="card" style="max-width:420px">
    <form id="farmer-pw-form" novalidate>
      <div class="field"><label for="fpw-old">${t("password")}</label><input id="fpw-old" name="oldPassword" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="fpw-new">${t("new_password")}</label><input id="fpw-new" name="newPassword" type="password" autocomplete="new-password" required></div>
      <div class="field"><label for="fpw-confirm">${t("confirm_password")}</label><input id="fpw-confirm" name="confirmPassword" type="password" autocomplete="new-password" required></div>
      <button class="btn" type="submit">${t("save")}</button>
    </form>
  </div>`;
}

/* Shared by farmerSettings() and centerSettings() — same Current/New/
   Confirm fields, same Firebase reauthenticate-then-updatePassword flow,
   same error handling. Keeps the account signed in throughout. */
function wirePasswordChangeForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(form);
    const oldPw = form.oldPassword.value, p1 = form.newPassword.value, p2 = form.confirmPassword.value;
    let bad = false;
    if (!oldPw) { setFieldError(form, "oldPassword", t("field_required")); bad = true; }
    if (p1.length < 8) { setFieldError(form, "newPassword", t("weak_password")); bad = true; }
    if (p1 !== p2) { setFieldError(form, "confirmPassword", t("passwords_no_match")); bad = true; }
    if (bad) return;
    setBtnLoading(form, true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, oldPw);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, p1);
      setBtnLoading(form, false);
      form.reset();
      showToast(t("password_changed"));
    } catch (err) {
      setBtnLoading(form, false);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setFieldError(form, "oldPassword", t("wrong_password"));
      } else if (err.code === "auth/weak-password") {
        setFieldError(form, "newPassword", t("weak_password"));
      } else if (err.code === "auth/requires-recent-login") {
        showAuthError(form, t("session_expired"));
      } else {
        showAuthError(form, t("network_error"));
      }
    }
  });
}

function subscribeCenterQueue() {
  // store.profile.centerId — set on the center's users/{uid} doc by
  // Government's client-side registration flow (see wireGovRegister) — is
  // the center's real business ID. The center's Auth uid (store.user.uid)
  // is a different value and must never be used as a centerId anywhere.
  const q1 = query(collection(db, "tokens"), where("centerId", "==", store.profile.centerId), where("status", "==", "waiting"), orderBy("createdAt", "asc"), limit(50));
  store._unsub.queue = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("center-queue", emptyState("users", t("no_queue"), t("no_queue_desc"))); return; }
    paint("center-queue", `<div class="card">${qs.docs.map((d, i) => {
      const tk = { id: d.id, ...d.data() };
      return `<div class="queue-row"><span class="pos">${i + 1}</span>
        <div class="col" style="flex:1"><b>${esc(tk.farmerName || tk.farmerId)}</b><span class="tiny muted">#${tk.id.slice(-6).toUpperCase()}</span></div>
        ${i === 0 ? `<button class="btn" data-serve="${tk.id}">${t("mark_served")}</button><button class="btn ghost" data-noshow="${tk.id}">${t("mark_noshow")}</button>` : ""}
      </div>`;
    }).join("")}</div>`);
    const tokensByAttr = qs.docs.reduce((m, d) => { m[d.id] = { id: d.id, ...d.data() }; return m; }, {});
    document.querySelectorAll("[data-serve]").forEach((b) => b.addEventListener("click", () => centerMarkServed(b.dataset.serve, tokensByAttr[b.dataset.serve])));
    document.querySelectorAll("[data-noshow]").forEach((b) => b.addEventListener("click", () => centerMarkNoShow(b.dataset.noshow)));
  }, () => paint("center-queue", emptyState("users", t("no_queue"), t("no_queue_desc"))));
}
function centerMarkServed(tokenId, tokenData) {
  openModal({
    title: t("mark_served"),
    body: `<div class="field"><label for="cm-crop">${t("crop")}</label><input id="cm-crop" required></div>
      <div class="field"><label for="cm-weight">${t("weight")}</label><input id="cm-weight" inputmode="decimal" required></div>
      <div class="field"><label for="cm-rate">${t("rate")}</label><input id="cm-rate" inputmode="numeric" required></div>
      <div class="field"><label for="cm-grade">${t("grade")}</label><input id="cm-grade"></div>`,
    confirmText: t("confirm"),
    getData: (root) => ({
      crop: root.querySelector("#cm-crop").value.trim(),
      weight: Number(root.querySelector("#cm-weight").value) || 0,
      rate: Number(root.querySelector("#cm-rate").value) || 0,
      grade: root.querySelector("#cm-grade").value.trim(),
    }),
    onConfirm: async (data) => {
      try {
        // Recording a purchase now goes through the createPurchase Cloud
        // Function rather than a direct Firestore write: the server, not
        // this browser tab, is what decides the real farmerId, centerId
        // and amount (it re-derives them from the token being served and
        // from this center's own server-verified identity), so a
        // tampered request here can change only the crop/weight/rate/
        // grade being recorded for a token that is genuinely this
        // center's — never whose purchase it is or at which center.
        await callFunction("createPurchase", {
          tokenId, crop: data.crop, weight: data.weight, rate: data.rate, grade: data.grade || null,
        });
        showToast(t("saved"));
      } catch (e) { showToast(t("network_error")); }
    },
  });
}
async function centerMarkNoShow(tokenId) { try { await callFunction("markNoShow", { tokenId }); showToast(t("saved")); } catch (_) { showToast(t("network_error")); } }

function subscribeCenterCapacity() {
  store._unsub.center = onSnapshot(doc(db, "centers", store.profile.centerId), (snap) => {
    const c = snap.exists() ? snap.data() : {};
    store.profile.centerName = c.centerName || store.profile.centerName;
    const govActive = c.govStatus === "active";
    paint("center-capacity", `<div class="grid-2">
      <div class="card"><div class="row gap-s"><span>${t("center_status")}</span><span class="spacer"></span>
        <button class="btn ${c.status === "open" ? "ghost" : ""}" id="toggle-open" ${govActive ? "" : "disabled"}>${govActive ? (c.status === "open" ? t("deactivate") : t("activate")) : t("deactivate")}</button></div>
        ${!govActive ? `<div class="tiny muted mt-1">${t("gov_inactive")}</div>` : ""}</div>
      <div class="card"><div class="row gap-s"><span>${t("counters")}</span><span class="spacer"></span>
        <button class="icon-btn" id="counters-minus">${ic("minus", 16)}</button><b>${c.counters ?? 1}</b><button class="icon-btn" id="counters-plus">${ic("plus", 16)}</button></div></div>
    </div>`);
    const openBtn = document.getElementById("toggle-open");
    if (openBtn && govActive) openBtn.addEventListener("click", async () => {
      openBtn.disabled = true;
      try { await updateDoc(doc(db, "centers", store.profile.centerId), { status: c.status === "open" ? "closed" : "open" }); }
      catch (_) { showToast(t("network_error")); }
      finally { openBtn.disabled = false; }
    });
    const minus = document.getElementById("counters-minus"), plus = document.getElementById("counters-plus");
    if (minus) minus.addEventListener("click", async () => { try { await updateDoc(doc(db, "centers", store.profile.centerId), { counters: Math.max(1, (c.counters || 1) - 1) }); } catch (_) { showToast(t("network_error")); } });
    if (plus) plus.addEventListener("click", async () => { try { await updateDoc(doc(db, "centers", store.profile.centerId), { counters: Math.min(8, (c.counters || 1) + 1) }); } catch (_) { showToast(t("network_error")); } });
  }, () => paint("center-capacity", emptyState("building", t("center_status"), t("network_error"))));
}

function subscribeCenterNotif() {
  const q1 = query(collection(db, "notifications"), where("userId", "==", store.user.uid), orderBy("createdAt", "desc"), limit(20));
  store._unsub.centerNotif = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("center-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))); return; }
    paint("center-notif", `<div class="card">${qs.docs.map((d) => `<div class="history-item"><span>${esc(d.data().text)}</span></div>`).join("")}</div>`);
  }, () => paint("center-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))));
}

/* ============================== government views ============================== */
function govBody() {
  const tab = store.govTab;
  if (tab === "overview") return `<h2 class="section-title">${t("overview_title")}</h2><div id="gov-overview">${loadingBlock()}</div>`;
  if (tab === "centers") return `<h2 class="section-title">${t("nav_centers")}</h2><div id="gov-centers">${loadingBlock()}</div>`;
  if (tab === "register") return govRegisterForm();
  if (tab === "alerts") return `<h2 class="section-title">${t("alerts_title")}</h2><div id="gov-alerts">${loadingBlock()}</div>`;
  if (tab === "settings") return `<div class="alert">${ic("info")}<span>${t("gov_password_note")}</span></div>`;
  return "";
}
function govRegisterForm() {
  const d = store.centerRegisterData || (store.centerRegisterData = {});
  return `<h2 class="section-title">${t("register_new_center")}</h2>
  <div class="card" style="max-width:560px">
    <form id="gov-register-form" novalidate>
      <div class="field"><label for="gr-name">${t("center_name")}</label><input id="gr-name" name="centerName" value="${esc(d.centerName || "")}" required></div>
      <div class="field"><label for="gr-code">${t("center_code")}</label><input id="gr-code" name="centerCode" maxlength="8" placeholder="FTB" value="${esc(d.centerCode || "")}" required></div>
      <div id="center-location-fields">${locationStepHtml(d)}</div>
      <div class="field"><label for="gr-address">${t("village_address")}</label><input id="gr-address" name="address" placeholder="${t("village_address_hint")}" value="${esc(d.address || "")}"></div>
      <div class="grid-2">
        <div class="field"><label for="gr-capacity">${t("center_capacity")}</label><input id="gr-capacity" name="capacity" inputmode="numeric" value="${esc(d.capacity || "")}" required></div>
        <div class="field"><label for="gr-counters">${t("num_counters")}</label><input id="gr-counters" name="counters" inputmode="numeric" value="${esc(d.counters || "2")}" required></div>
      </div>
      <div class="field"><label>${t("crops_list")}</label>${cropsStepHtml(d.crops || [])}</div>
      <div class="field"><label for="gr-mobile">${t("mobile")}</label><input id="gr-mobile" name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" value="${esc(d.mobile || "")}" required></div>
      <div class="field"><label for="gr-adminname">${t("admin_name")}</label><input id="gr-adminname" name="adminName" value="${esc(d.adminName || "")}" required></div>
      <div class="field"><label for="gr-adminid">${t("admin_id")}</label><input id="gr-adminid" name="adminId" autocomplete="off" value="${esc(d.adminId || "")}" required></div>
      <div class="field"><label for="gr-initpw">${t("initial_password")}</label><input id="gr-initpw" name="initialPassword" type="password" autocomplete="new-password" value="${esc(d.initialPassword || "")}" required></div>
      <div class="field"><label for="gr-confirmpw">${t("confirm_password")}</label><input id="gr-confirmpw" name="confirmPassword" type="password" autocomplete="new-password" value="${esc(d.confirmPassword || "")}" required></div>
      <button class="btn" type="submit">${t("create_center")}</button>
    </form>
  </div>`;
}

function subscribeGovOverview() {
  store._unsub.govCenters = onSnapshot(collection(db, "centers"), (qs) => {
    const centers = qs.docs.map((d) => d.data());
    const open = centers.filter((c) => c.govStatus === "active" && c.status === "open").length;
    paint("gov-overview", `<div class="kpi-grid">
      <div class="card kpi"><div class="kpi-label">${t("total_centers")}</div><div class="kpi-value">${centers.length}</div></div>
      <div class="card kpi"><div class="kpi-label">${t("open_centers")}</div><div class="kpi-value">${open}</div></div>
      <div class="card kpi"><div class="kpi-label">${t("total_farmers")}</div><div class="kpi-value" id="kpi-farmers">—</div></div>
      <div class="card kpi"><div class="kpi-label">${t("total_purchases_today")}</div><div class="kpi-value" id="kpi-purchases">—</div></div>
    </div>`);
  });
}
function subscribeGovCenters() {
  store._unsub.govCentersTable = onSnapshot(collection(db, "centers"), (qs) => {
    if (qs.empty) { paint("gov-centers", emptyState("building", t("no_centers_found"), t("no_centers_desc"))); return; }
    paint("gov-centers", `<div class="card table-wrap"><table><tr><th>${t("center_name")}</th><th>${t("district")}</th><th>${t("center_status")}</th><th>${t("counters")}</th><th></th></tr>
      ${qs.docs.map((d) => { const c = d.data(); const active = c.govStatus === "active";
        return `<tr><td><b>${esc(c.centerName)}</b><div class="tiny muted">${esc(c.centerId || d.id)}</div></td><td>${esc(c.district || "—")}</td>
        <td><span class="badge ${active ? "green" : "red"}">${active ? t("gov_active") : t("gov_inactive")}</span><div class="tiny muted mt-1">${c.status === "open" ? t("open_now") : t("closed_now")}</div></td>
        <td>${c.counters ?? "—"}</td>
        <td><button class="btn ghost" data-toggle-center="${d.id}" data-gov-status="${active ? "active" : "inactive"}">${active ? t("deactivate") : t("activate")}</button></td></tr>`;
      }).join("")}
    </table></div>`);
    document.querySelectorAll("[data-toggle-center]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await callFunction("govSetCenterStatus", {
          centerId: b.dataset.toggleCenter,
          govStatus: b.dataset.govStatus === "active" ? "inactive" : "active",
        });
      } catch (_) { showToast(t("network_error")); }
      finally { b.disabled = false; }
    }));
  }, () => paint("gov-centers", emptyState("building", t("no_centers_found"), t("no_centers_desc"))));
}

function subscribeGovAlerts() {
  store._unsub.govAlerts = onSnapshot(collection(db, "centers"), (qs) => {
    const alerts = [];
    qs.docs.forEach((d) => {
      const c = d.data();
      if (c.govStatus !== "active") alerts.push(["danger", `${c.centerName} ${store.lang === "hi" ? "सरकार द्वारा निष्क्रिय है।" : "is inactive by government status."}`]);
      if (c.govStatus === "active" && c.status !== "open") alerts.push(["warn", `${c.centerName} ${store.lang === "hi" ? "अभी बंद दर्ज है।" : "is currently marked closed."}`]);
      if ((c.counters || 0) < 1) alerts.push(["danger", `${c.centerName} ${store.lang === "hi" ? "में कोई सक्रिय काउंटर नहीं है।" : "has no active counters."}`]);
    });
    paint("gov-alerts", alerts.length ? alerts.map(([k, txt]) => `<div class="alert ${k}">${ic(k === "danger" ? "alert" : "info")}<span>${txt}</span></div>`).join("") : `<div class="card tiny muted">${t("no_alerts")}</div>`);
  }, () => paint("gov-alerts", `<div class="card tiny muted">${t("no_alerts")}</div>`));
}

/* ============================== attach/detach live listeners on nav ============================== */
function attachRoleListeners() {
  const role = store.profile.role;
  if (role === "farmer") {
    if (store.farmerTab === "home") subscribeFarmerHome();
    if (store.farmerTab === "token") subscribeFarmerToken();
    if (store.farmerTab === "history") subscribeFarmerHistory();
    if (store.farmerTab === "notif") subscribeFarmerNotif();
    if (store.farmerTab === "help") wireFaq();
    if (store.farmerTab === "settings") wireFarmerSettings();
  } else if (role === "center") {
    if (store.centerTab === "queue") subscribeCenterQueue();
    if (store.centerTab === "capacity") subscribeCenterCapacity();
    if (store.centerTab === "notif") subscribeCenterNotif();
    if (store.centerTab === "settings") wireCenterSettings();
  } else if (role === "gov") {
    if (store.govTab === "overview") subscribeGovOverview();
    if (store.govTab === "centers") subscribeGovCenters();
    if (store.govTab === "register") wireGovRegister();
    if (store.govTab === "alerts") subscribeGovAlerts();
  }
}
function wireFaq() {
  document.querySelectorAll(".faq-item").forEach((item) => item.querySelector(".faq-q").addEventListener("click", () => item.classList.toggle("open")));
}
function wireCenterSettings() {
  wirePasswordChangeForm("center-pw-form");
}
function wireFarmerSettings() {
  wirePasswordChangeForm("farmer-pw-form");
}
function wireGovRegister() {
  const form = document.getElementById("gov-register-form");
  if (!form) return;
  wireLocationSelects(document, (level, value) => {
    const d = store.centerRegisterData;
    if (level === "state") { d.stateCode = value; d.districtCode = null; d.blockCode = null; d.villageCode = null; }
    else if (level === "district") { d.districtCode = value; d.blockCode = null; d.villageCode = null; }
    else if (level === "block") { d.blockCode = value; d.villageCode = null; }
    else if (level === "village") { d.villageCode = value; }
    // Preserve the rest of the form's entered values across this targeted repaint.
    d.centerName = form.centerName.value; d.centerCode = form.centerCode.value;
    d.address = form.address.value; d.capacity = form.capacity.value; d.counters = form.counters.value;
    d.mobile = form.mobile.value; d.adminName = form.adminName.value; d.adminId = form.adminId.value;
    d.initialPassword = form.initialPassword.value; d.confirmPassword = form.confirmPassword.value;
    d.crops = Array.from(form.querySelectorAll('input[name="crops"]:checked')).map((i) => i.value);
    mount();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form;
    clearFormErrors(f);
    const centerCode = f.centerCode.value.trim().toUpperCase();
    const mobile = f.mobile.value.trim();
    const adminId = f.adminId.value.trim().toLowerCase();
    const adminName = f.adminName.value.trim();
    const initialPassword = f.initialPassword.value, confirmPw = f.confirmPassword.value;
    const d = store.centerRegisterData;
    let bad = false;
    if (!/^[A-Z0-9]{2,12}$/.test(centerCode)) { setFieldError(f, "centerCode", t("field_required")); bad = true; }
    if (!/^[a-z0-9._-]{3,20}$/.test(adminId)) { setFieldError(f, "adminId", t("field_required")); bad = true; }
    if (!d.stateCode) { setFieldError(f, "state", t("field_required")); bad = true; }
    if (!d.districtCode) { setFieldError(f, "district", t("field_required")); bad = true; }
    if (initialPassword.length < 8) { setFieldError(f, "initialPassword", t("weak_password")); bad = true; }
    if (initialPassword !== confirmPw) { setFieldError(f, "confirmPassword", t("passwords_no_match")); bad = true; }
    if (bad) return;
    const crops = Array.from(f.querySelectorAll('input[name="crops"]:checked')).map((i) => i.value);
    const loc = locationPayload(d);
    // centerId is the business identifier the center will type at login
    // (see centerEmail()/handleCenterLogin) — it is chosen by Government
    // here as the Center Code, and is a completely separate value from
    // the Firebase Auth uid the new account gets below. Never conflate
    // the two: the Auth uid is only ever used as the users/{uid} doc id.
    const centerId = centerCode;
    const email = centerEmail(centerId, adminId);
    setBtnLoading(f, true);

    try {
      const existing = await getDoc(doc(db, "centers", centerId));
      if (existing.exists()) {
        setBtnLoading(f, false);
        setFieldError(f, "centerCode", t("code_taken"));
        return;
      }
    } catch (_) {
      setBtnLoading(f, false);
      showToast(t("network_error"));
      return;
    }

    // Firebase Auth account creation is a client SDK call gated only by
    // whether Email/Password sign-in is enabled for this project — it is
    // NOT mediated by firestore.rules at all, so on the Spark plan
    // (no Cloud Functions/Admin SDK) this step cannot be restricted to
    // Government specifically. What IS strictly enforced below is that
    // the resulting account is functionally useless without a matching
    // users/{uid} doc, and firestore.rules only lets an active Government
    // account create that doc with role:'center' — so creating a stray
    // Auth account alone grants no access to any farmer/center/gov data.
    const secondaryAuth = getSecondaryAuth();
    let createdUid = null;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, initialPassword);
      createdUid = cred.user.uid;
    } catch (err) {
      setBtnLoading(f, false);
      if (err.code === "auth/email-already-in-use") {
        setFieldError(f, "adminId", t("code_taken"));
      } else if (err.code === "auth/weak-password") {
        setFieldError(f, "initialPassword", t("weak_password"));
      } else {
        showToast(authErrorMessage(err));
      }
      return;
    } finally {
      // Drop the secondary session immediately; Government's own session
      // on the primary `auth` was never touched by any of this.
      try { await signOut(secondaryAuth); } catch (_) {}
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", createdUid), {
        uid: createdUid, role: "center", name: adminName, centerId, adminId,
        authProvider: "password", language: store.lang, theme: "light",
        status: "active", mustChangePassword: true, createdAt: serverTimestamp(),
      });
      const { latitude, longitude, ...centerLoc } = loc;
      batch.set(doc(db, "centers", centerId), {
        centerId, centerName: f.centerName.value.trim(), centerCode, registeredMobile: mobile,
        ...centerLoc, address: f.address.value.trim() || null,
        capacity: Math.max(0, parseInt(f.capacity.value, 10) || 0),
        counters: Math.max(1, parseInt(f.counters.value, 10) || 1),
        acceptedCrops: crops, govStatus: "active", status: "closed", createdAt: serverTimestamp(),
      });
      await batch.commit();
      const credentialsNote = `${t("center_id")}: ${centerId} · ${t("admin_id")}: ${adminId}`;
      openModal({ title: t("center_created"), body: credentialsNote, confirmText: t("confirm") });
      store.centerRegisterData = { crops: [] };
      paintScreen();
    } catch (err) {
      setBtnLoading(f, false);
      // The Auth account above was already created and cannot be rolled
      // back from the browser (deleting another user's Auth account needs
      // the Admin SDK). This is the one gap this client-only flow can't
      // close: a retry must use a different Center Code/Admin ID, since
      // this exact login now exists but has no matching Firestore profile
      // and so cannot sign in to anything.
      showToast(store.lang === "hi"
        ? "खाता तो बन गया लेकिन केंद्र रिकॉर्ड सहेजा नहीं जा सका। एक अलग केंद्र कोड/एडमिन आईडी के साथ पुनः प्रयास करें।"
        : "The login was created but the center record could not be saved. Retry with a different Center Code/Admin ID.");
    }
  });
}

/* ============================== screen dispatcher ============================== */
function screenHtml() {
  if (store.screen === "loading") return `<div class="auth-panel" style="min-height:100vh"><p class="muted">${t("loading")}</p></div>`;
  if (store.screen === "login") return screenLogin();
  if (store.screen === "signup") return screenSignup();
  if (store.screen === "forgot") return screenForgot();
  if (store.screen === "forcePassword") return screenForcePassword();
  if (store.screen === "googleComplete") return screenGoogleComplete();
  if (store.screen === "farmer") return appShellHtml(farmerBody());
  if (store.screen === "center") return appShellHtml(centerBody());
  if (store.screen === "gov") return appShellHtml(govBody());
  return "";
}

function paintScreen() {
  document.getElementById("app").innerHTML = screenHtml() + `<div id="toast-slot"></div>`;
  wireScreen();
}
function mount() { paintScreen(); if (["farmer", "center", "gov"].includes(store.screen)) attachRoleListeners(); }

function wireScreen() {
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
  if (store.screen === "login") {
    newCaptcha();
    wireLoginForm();
    if (store.crossRoleLoginError) { store.crossRoleLoginError = false; showToast(t("login_error")); }
    document.querySelectorAll("[data-role-tab]").forEach((b) => b.addEventListener("click", () => { store.authTab = b.dataset.roleTab; paintScreen(); }));
    const about = document.getElementById("go-about"), help = document.getElementById("go-help");
    if (about) about.addEventListener("click", () => openModal({ title: t("about_title"), body: t("about_body"), confirmText: t("confirm") }));
    if (help) help.addEventListener("click", () => openModal({ title: t("help_title"), body: t("faq_book_a"), confirmText: t("confirm") }));
  } else if (store.screen === "signup") {
    if (!store.signupData.captcha) newCaptcha();
    const form = document.getElementById("signup-form");
    if (form) { form.addEventListener("submit", signupNext); wirePasswordToggles(form); }
    if (store.signupStep === 2) {
      wireLocationSelects(document, (level, value) => {
        const d = store.signupData;
        if (level === "state") { d.stateCode = value; d.districtCode = null; d.blockCode = null; d.villageCode = null; }
        else if (level === "district") { d.districtCode = value; d.blockCode = null; d.villageCode = null; }
        else if (level === "block") { d.blockCode = value; d.villageCode = null; }
        else if (level === "village") { d.villageCode = value; }
        paintScreen();
      });
    }
    const back = document.getElementById("signup-back"); if (back) back.addEventListener("click", signupBack);
    const exit = document.getElementById("signup-exit"); if (exit) exit.addEventListener("click", () => { store.screen = "login"; paintScreen(); });
  } else if (store.screen === "forgot") {
    const idForm = document.getElementById("forgot-id-form"); if (idForm) idForm.addEventListener("submit", forgotSendOtp);
    const resetForm = document.getElementById("reset-form"); if (resetForm) resetForm.addEventListener("submit", forgotResetPassword);
    const exit = document.getElementById("forgot-exit"); if (exit) exit.addEventListener("click", exitForgot);
    const done = document.getElementById("forgot-done"); if (done) done.addEventListener("click", exitForgot);
    const resend = document.getElementById("otp-resend");
    if (resend) resend.addEventListener("click", async () => {
      const mobile = store.forgotData.mobile;
      if (!mobile) return;
      try { await sendForgotOtp(mobile); } catch (_) { showToast(t("network_error")); }
    });
    wireOtpBoxes();
  } else if (store.screen === "forcePassword") {
    const form = document.getElementById("force-pw-form"); if (form) form.addEventListener("submit", handleForcePasswordChange);
  } else if (store.screen === "googleComplete") {
    const form = document.getElementById("google-complete-form");
    if (form) form.addEventListener("submit", googleCompleteNext);
    if (store.googleStep === 2) {
      wireLocationSelects(document, (level, value) => {
        const d = store.googleData;
        if (level === "state") { d.stateCode = value; d.districtCode = null; d.blockCode = null; d.villageCode = null; }
        else if (level === "district") { d.districtCode = value; d.blockCode = null; d.villageCode = null; }
        else if (level === "block") { d.blockCode = value; d.villageCode = null; }
        else if (level === "village") { d.villageCode = value; }
        paintScreen();
      });
    }
    const back = document.getElementById("google-back"); if (back) back.addEventListener("click", googleCompleteBack);
  } else {
    wireShell();
  }
}
function wireOtpBoxes() {
  const boxes = document.querySelectorAll("[data-otp-index]");
  if (!boxes.length) return;
  boxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      const otp = Array.from(boxes).map((b) => b.value).join("");
      if (otp.length === 6) forgotVerifyOtp(otp);
    });
    box.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus(); });
  });
}

/* ============================== boot ============================== */
applyTheme();
document.documentElement.lang = store.lang === "hi" ? "hi" : "en";
paintScreen();