import { auth, db, getAppCheckHeaders, getSecondaryAuth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, orderBy,
  limit, onSnapshot, serverTimestamp, Timestamp, writeBatch, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as locationAdapter from "./data/locationAdapter.js";
import * as cropsAdapter from "./data/cropsAdapter.js";

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
  play: '<path d="M7 4l13 8-13 8V4Z"/>',
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
    bk_crops_hint: "इस केंद्र द्वारा स्वीकृत फ़सलें चुनें और हर फ़सल की अनुमानित मात्रा (क्विंटल) लिखें।",
    bk_err_no_crop: "कम से कम एक फ़सल चुनें।", bk_err_qty: "हर चुनी हुई फ़सल की सही मात्रा (क्विंटल, अधिकतम 2 दशमलव) लिखें।",
    bk_err_max_crops: "एक टोकन में अधिकतम 3 फ़सलें चुनी जा सकती हैं।", bk_err_no_accepted: "इस केंद्र ने अभी कोई फ़सल स्वीकृत नहीं की है।",
    bk_err_crop_gone: "चुनी हुई फ़सल इस केंद्र पर अब स्वीकृत नहीं है।",
    declared_crops: "फ़सलें (अनुमानित)", quintal_short: "क्विंटल",
    serve_declared: "बताई गई मात्रा", serve_actual_weight: "वास्तविक वज़न (क्विंटल)", serve_not_brought: "यह फ़सल नहीं आई (वज़न 0/खाली) — छोड़ दी जाएगी",
    rate_per_quintal: "दर (₹/क्विंटल)", select_grade: "ग्रेड चुनें",
    diff_same: "बताई गई मात्रा के बराबर", diff_less: "बताई गई मात्रा से {n} क्विंटल कम", diff_more: "बताई गई मात्रा से {n} क्विंटल ज़्यादा",
    serve_line_amount: "राशि",
    serve_err_legacy: "यह टोकन पुराने तरीके से बना है (फ़सल विवरण नहीं है)। किसान से रद्द करके दोबारा बुक करने को कहें, या 'अनुपस्थित' चुनें।",
    serve_err_none: "कम से कम एक फ़सल का वज़न दर्ज करें।", serve_err_grade: "हर खरीदी गई फ़सल का ग्रेड चुनें।",
    err_invalid_input: "वज़न या दर सही नहीं है (0 से अधिक, अधिकतम 2 दशमलव)।",
    err_permission: "अनुमति नहीं मिली — यह कार्य आपके केंद्र के लिए मान्य नहीं है।",
    err_invalid_state: "टोकन की स्थिति सही नहीं है (अब प्रतीक्षा में नहीं है या रद्द हो चुका है)।",
    err_already_processed: "यह टोकन पहले ही प्रोसेस हो चुका है।",
    err_network_slow: "नेटवर्क धीमा है। दोबारा भेजने से पहले कतार जाँच लें — हो सकता है कार्य पूरा हो गया हो।",
    err_unknown: "कुछ गलत हो गया। कृपया दोबारा प्रयास करें।",
    notif_token_served: "{center} पर आपकी खरीद दर्ज हो गई है। विवरण 'पिछली खरीद' में देखें।",
    queue_sync_ok: "किसानों को कतार दिख रही है ({n} प्रतीक्षा में)",
    queue_sync_fail: "कतार किसानों तक नहीं पहुँची ({code})।",
    queue_sync_hint: "नई firestore.rules Publish करें और पेज रीफ़्रेश करें।",
    try_demo: "डेमो आज़माएँ", demo_pick_role: "देखने के लिए एक भूमिका चुनें — कोई भी असली लॉगिन ज़रूरी नहीं", demo_mode: "डेमो मोड",
    demo_mode_banner: "आप डेमो मोड में हैं — यह डेटा नकली है और सहेजा नहीं जाता।", exit_demo: "डेमो से बाहर निकलें",
    demo_active_token_exists: "आपके पास पहले से एक सक्रिय डेमो टोकन है।",
    demo_advance_queue: "कतार आगे बढ़ाएँ (डेमो)", demo_your_turn: "आपकी बारी है!",
    demo_notif_booked: "आपका टोकन {center} पर बुक हो गया है।", demo_notif_cancelled: "आपका टोकन रद्द कर दिया गया है।",
    demo_notif_served: "{center} पर आपकी खरीद दर्ज हो गई है।", demo_notif_noshow: "{center} पर आपका टोकन नो-शो के रूप में चिह्नित किया गया।",
    demo_notif_purchase: "{crop} की खरीद ₹{amount} में दर्ज की गई।",
    demo_add_purchase: "स्थानीय खरीद जोड़ें (डेमो)", demo_crop: "फ़सल", demo_weight: "मात्रा (क्विंटल)", demo_rate: "दर (₹/क्विंटल)",
    demo_center_open: "केंद्र खुला है", demo_center_closed: "केंद्र बंद है", demo_toggle_status: "स्थिति बदलें (डेमो)",
    demo_farmer_profile: "किसान प्रोफ़ाइल (डेमो)", demo_land: "भूमि", demo_main_crops: "मुख्य फ़सलें",
    demo_gov_total_centers: "कुल केंद्र", demo_gov_open_centers: "खुले केंद्र", demo_gov_total_farmers: "कुल किसान", demo_gov_today_purchases: "आज की खरीद",
    demo_activate: "सक्रिय करें (डेमो)", demo_deactivate: "निष्क्रिय करें (डेमो)", demo_open: "खोलें (डेमो)", demo_close: "बंद करें (डेमो)",
    demo_register_preview_title: "नया केंद्र पंजीकरण (डेमो पूर्वावलोकन)",
    demo_register_preview_body: "असली डैशबोर्ड में, यह पूरा फ़ॉर्म खोलता है — केंद्र का नाम, पता, क्षमता, स्वीकृत फ़सलें, एडमिन विवरण — और तुरंत एक लॉगिन बना देता है। डेमो मोड में यह क्रिया अक्षम है ताकि कोई नकली डेटा असली सिस्टम में न जाए।",
    add_local_purchase: "स्थानीय खरीद जोड़ें", lp_farmer: "किसान का नाम", lp_select_crop: "फ़सल चुनें",
    gov_capacity_label: "सरकारी क्षमता", quintal_per_day: "क्विंटल/दिन",

    view_details: "विवरण देखें", close: "बंद करें", not_available: "उपलब्ध नहीं",
    email: "ईमेल", email_optional: "ईमेल (वैकल्पिक)", invalid_email: "सही ईमेल दर्ज करें",
    nav_farmers: "किसान", registered_farmers: "पंजीकृत किसान",
    center_details_title: "केंद्र विवरण", farmer_details_title: "किसान विवरण",
    contact_person: "संपर्क व्यक्ति", contact_number: "संपर्क नंबर", registration_date: "पंजीकरण तिथि",
    current_status: "वर्तमान स्थिति", government_status: "सरकारी स्थिति", queue_info: "कतार/टोकन जानकारी",
    address_field: "पता", block_field: "ब्लॉक", village_field: "गाँव",
    no_farmers_found: "कोई किसान पंजीकृत नहीं है",
    distance_unavailable: "दूरी उपलब्ध नहीं",
    share_location: "मेरा स्थान साझा करें", update_location: "स्थान अपडेट करें",
    location_updated: "स्थान अपडेट हो गया", location_denied: "स्थान की अनुमति नहीं मिली",
    my_profile: "मेरी प्रोफ़ाइल",
    edit_capacity: "क्षमता बदलें", save_capacity: "क्षमता सहेजें", capacity_updated: "क्षमता अपडेट हो गई",
    lp_search_mobile: "किसान का मोबाइल नंबर (वैकल्पिक)", lp_search_hint: "पंजीकृत किसान से जोड़ने के लिए मोबाइल नंबर दर्ज करें",
    lp_farmer_linked: "पंजीकृत किसान से जोड़ा गया", lp_farmer_not_found: "इस नंबर से कोई पंजीकृत किसान नहीं मिला — नाम मैन्युअल रहेगा",
    payment_issue: "भुगतान समस्या", report_issue: "समस्या दर्ज करें",
    issue_type: "समस्या प्रकार", issue_payment_delayed: "भुगतान में देरी", issue_incorrect_amount: "गलत राशि",
    issue_quantity_issue: "मात्रा में समस्या", issue_other: "अन्य",
    issue_description: "विवरण (वैकल्पिक)", issue_route_to: "किसे भेजें", route_center: "केंद्र", route_gov: "शासन",
    request_sent: "आपकी शिकायत भेज दी गई है", nav_payments: "भुगतान शिकायतें",
    no_payment_requests: "कोई भुगतान शिकायत नहीं", status_open: "खुली", status_acknowledged: "स्वीकार की गई",
    status_under_review: "समीक्षा में", status_resolved: "हल हो गई",
    acknowledge: "स्वीकार करें", under_review_action: "समीक्षा में डालें", resolve: "हल करें",
    reset_via_username: "उपयोगकर्ता नाम से रीसेट करें", reset_via_email: "ईमेल से रीसेट करें",
    reset_email_sent: "यदि यह खाता मौजूद है, तो पंजीकृत ईमेल पर पासवर्ड रीसेट लिंक भेज दिया गया है।",
    reset_email_note: "ध्यान दें: यह लिंक केवल उसी ईमेल पर जाता है जो इस खाते के लिए Firebase में दर्ज है (जैसे Google से साइन इन करने वाला किसान खाता)।",
    send_reset_link: "रीसेट लिंक भेजें",
    nav_pending_payment: "लंबित भुगतान", mark_payment: "भुगतान दर्ज करें", paid_amount_label: "भुगतान राशि (₹)",
    enter_amount: "वास्तविक भुगतान राशि दर्ज करें", payment_marked_confirmation: "₹{amount} का भुगतान 'भुगतान हुआ' के रूप में दर्ज किया गया है।",
    payment_received: "भुगतान मिल गया", payment_not_received: "भुगतान नहीं मिला / शिकायत करें",
    confirmed: "भुगतान की पुष्टि हुई", awaiting_confirmation: "किसान की पुष्टि लंबित",
    no_pending_payments: "कोई लंबित भुगतान नहीं", pending_payment_desc: "जिन किसानों की फ़सल ली जा चुकी है और भुगतान अभी बाकी है, वे यहाँ दिखेंगे।",
    center_marked_paid_banner: "केंद्र ने आपके ₹{amount} के भुगतान को 'भुगतान हुआ' दर्ज किया है।",
    payment_confirmed_toast: "भुगतान की पुष्टि हो गई", expected_amount: "अनुमानित राशि",
    today_collection_title: "आज का केंद्र-वार संग्रह", col_center: "केंद्र", col_district: "ज़िला",
    col_today_qty: "आज की मात्रा", col_today_purchases: "आज की खरीद", col_today_amount: "राशि",
    no_collection_today: "आज तक कोई खरीद दर्ज नहीं हुई",
    announcements_title: "सरकारी घोषणा", create_announcement: "घोषणा बनाएँ", announcement_message: "घोषणा संदेश",
    announcement_active: "सक्रिय", announcement_inactive: "निष्क्रिय", announcement_expiry: "समाप्ति तिथि/समय (वैकल्पिक)",
    all_centers_closed_today: "आज सभी केंद्र बंद रहेंगे", publish_announcement: "प्रकाशित करें", deactivate_announcement: "निष्क्रिय करें",
    no_announcements: "कोई घोषणा नहीं", announcement_created: "घोषणा प्रकाशित हुई",
    time_unavailable: "समय अनुपलब्ध", share_location: "स्थान साझा करें", activate: "सक्रिय करें", token_id_label: "टोकन",
    issue_reaches_both: "यह शिकायत केंद्र और शासन दोनों को दिखेगी।",
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
    about_title: "What is Kisan Setu?", about_body: "Kisan Setu connects farmers with nearby procurement centers, manages tokens and queues, and shows purchase history and payment status. Center staff manage their own queue and capacity, and government accounts monitor all centers.",
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
    bk_crops_hint: "Choose the crops this center accepts and enter the expected quantity (quintal) for each.",
    bk_err_no_crop: "Select at least one crop.", bk_err_qty: "Enter a valid quantity (quintal, max 2 decimals) for every selected crop.",
    bk_err_max_crops: "You can select at most 3 crops per token.", bk_err_no_accepted: "This center has not listed any accepted crops yet.",
    bk_err_crop_gone: "A selected crop is no longer accepted by this center.",
    declared_crops: "Crops (expected)", quintal_short: "quintal",
    serve_declared: "Declared", serve_actual_weight: "Actual weight (quintal)", serve_not_brought: "Crop not brought (weight 0/blank) — will be skipped",
    rate_per_quintal: "Rate (₹/quintal)", select_grade: "Select grade",
    diff_same: "Same as declared", diff_less: "{n} quintal less than declared", diff_more: "{n} quintal more than declared",
    serve_line_amount: "Amount",
    serve_err_legacy: "This token was created the old way (no crop details). Ask the farmer to cancel and book again, or choose 'No-show'.",
    serve_err_none: "Enter the weight for at least one crop.", serve_err_grade: "Select a grade for every purchased crop.",
    err_invalid_input: "Weight or rate is invalid (must be above 0, max 2 decimals).",
    err_permission: "Permission denied — this action is not valid for your center.",
    err_invalid_state: "Invalid token state (no longer waiting, or cancelled).",
    err_already_processed: "This token has already been processed.",
    err_network_slow: "The network is slow. Check the queue before retrying — the action may have completed.",
    err_unknown: "Something went wrong. Please try again.",
    notif_token_served: "Your purchase at {center} has been recorded. See 'Purchase history' for details.",
    queue_sync_ok: "Farmers can see the queue ({n} waiting)",
    queue_sync_fail: "The queue could not be sent to farmers ({code}).",
    queue_sync_hint: "Publish the latest firestore.rules and refresh the page.",
    try_demo: "Try Demo", demo_pick_role: "Pick a role to explore — no real login needed", demo_mode: "Demo Mode",
    demo_mode_banner: "You're in Demo Mode — this data is fake and is never saved.", exit_demo: "Exit Demo",
    demo_active_token_exists: "You already have an active demo token.",
    demo_advance_queue: "Advance queue (Demo)", demo_your_turn: "It's your turn!",
    demo_notif_booked: "Your token at {center} is booked.", demo_notif_cancelled: "Your token has been cancelled.",
    demo_notif_served: "Your purchase at {center} has been recorded.", demo_notif_noshow: "Your token at {center} was marked no-show.",
    demo_notif_purchase: "Purchase of {crop} recorded for ₹{amount}.",
    demo_add_purchase: "Add local purchase (Demo)", demo_crop: "Crop", demo_weight: "Quantity (quintal)", demo_rate: "Rate (₹/quintal)",
    demo_center_open: "Center is open", demo_center_closed: "Center is closed", demo_toggle_status: "Toggle status (Demo)",
    demo_farmer_profile: "Farmer profile (Demo)", demo_land: "Land", demo_main_crops: "Main crops",
    demo_gov_total_centers: "Total centers", demo_gov_open_centers: "Open centers", demo_gov_total_farmers: "Total farmers", demo_gov_today_purchases: "Today's purchases",
    demo_activate: "Activate (Demo)", demo_deactivate: "Deactivate (Demo)", demo_open: "Open (Demo)", demo_close: "Close (Demo)",
    demo_register_preview_title: "Register new center (Demo preview)",
    demo_register_preview_body: "In the real dashboard, this opens the full form — center name, address, capacity, accepted crops, admin details — and creates a working login instantly. It's disabled here in Demo Mode so no fake data ever touches the real system.",
    add_local_purchase: "Add Local Purchase", lp_farmer: "Farmer name", lp_select_crop: "Select crop",
    gov_capacity_label: "Government capacity", quintal_per_day: "quintal/day",

    view_details: "View Details", close: "Close", not_available: "Not Available",
    email: "Email", email_optional: "Email (optional)", invalid_email: "Enter a valid email",
    nav_farmers: "Farmers", registered_farmers: "Registered farmers",
    center_details_title: "Center Details", farmer_details_title: "Farmer Details",
    contact_person: "Contact person", contact_number: "Contact number", registration_date: "Registration date",
    current_status: "Current status", government_status: "Government status", queue_info: "Queue / token info",
    address_field: "Address", block_field: "Block", village_field: "Village",
    no_farmers_found: "No farmers registered yet",
    distance_unavailable: "Distance unavailable",
    share_location: "Share my location", update_location: "Update location",
    location_updated: "Location updated", location_denied: "Location permission denied",
    my_profile: "My Profile",
    edit_capacity: "Edit capacity", save_capacity: "Save capacity", capacity_updated: "Capacity updated",
    lp_search_mobile: "Farmer's mobile number (optional)", lp_search_hint: "Enter a mobile number to link a registered farmer",
    lp_farmer_linked: "Linked to registered farmer", lp_farmer_not_found: "No registered farmer found for this number — name stays manual",
    payment_issue: "Payment Issue", report_issue: "Report issue",
    issue_type: "Issue type", issue_payment_delayed: "Payment delayed", issue_incorrect_amount: "Incorrect amount",
    issue_quantity_issue: "Quantity issue", issue_other: "Other",
    issue_description: "Description (optional)", issue_route_to: "Send to", route_center: "Center", route_gov: "Government",
    request_sent: "Your issue has been sent", nav_payments: "Payment Issues",
    no_payment_requests: "No payment issues", status_open: "Open", status_acknowledged: "Acknowledged",
    status_under_review: "Under review", status_resolved: "Resolved",
    acknowledge: "Acknowledge", under_review_action: "Mark under review", resolve: "Resolve",
    reset_via_username: "Reset using Username", reset_via_email: "Reset using Email",
    reset_email_sent: "If an account exists, a password reset link has been sent to its registered email.",
    reset_email_note: "Note: this link only reaches the exact email registered in Firebase for this account (for example, a farmer account signed in with Google).",
    send_reset_link: "Send reset link",
    nav_pending_payment: "Pending Payment", mark_payment: "Mark Payment", paid_amount_label: "Amount paid (₹)",
    enter_amount: "Enter the actual amount paid", payment_marked_confirmation: "Payment of ₹{amount} has been marked as paid.",
    payment_received: "Payment Received", payment_not_received: "Payment Not Received / Report Issue",
    confirmed: "Payment confirmed", awaiting_confirmation: "Awaiting farmer confirmation",
    no_pending_payments: "No pending payments", pending_payment_desc: "Farmers whose crop has been collected and whose payment is still due will appear here.",
    center_marked_paid_banner: "The center has marked your payment of ₹{amount} as paid.",
    payment_confirmed_toast: "Payment confirmed", expected_amount: "Expected amount",
    today_collection_title: "Today's Collection by Center", col_center: "Center", col_district: "District",
    col_today_qty: "Today's quantity", col_today_purchases: "Today's purchases", col_today_amount: "Amount",
    no_collection_today: "No purchases recorded today",
    announcements_title: "Government Announcement", create_announcement: "Create Announcement", announcement_message: "Announcement message",
    announcement_active: "Active", announcement_inactive: "Inactive", announcement_expiry: "Expiry date/time (optional)",
    all_centers_closed_today: "All centers closed today", publish_announcement: "Publish", deactivate_announcement: "Deactivate",
    no_announcements: "No announcements", announcement_created: "Announcement published",
    time_unavailable: "Time unavailable", share_location: "Share location", activate: "Activate", token_id_label: "Token",
    issue_reaches_both: "This report is visible to both the Center and Government.",
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
  forgotMethod: "username",
  forgotRole: "farmer",
  forgotData: {},
  captcha: { a: 1, b: 1 },
  sortBy: "nearest",
  draft: null,
  forcePasswordChange: false,
  _unsub: {},
  _opBusy: new Set(),
  demoActive: false,
  demoRole: null,
  demoTab: null,
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
  root.innerHTML = `<div class="modal-backdrop" data-close="1"><div class="modal ${m.wide ? "wide" : ""}" role="dialog" aria-modal="true">
    <h3>${m.title}</h3><div class="muted modal-body">${m.body}</div>
    <div class="modal-actions">
      ${m.hideCancel ? "" : `<button class="btn ${m.danger ? "" : "ghost"}" id="modal-cancel">${m.cancelText || t("cancel")}</button>`}
      <button class="btn ${m.danger ? "danger" : ""}" id="modal-confirm">${m.confirmText || t("confirm")}</button>
    </div></div></div>`;
  root.querySelector(".modal-backdrop").addEventListener("click", (e) => { if (e.target.dataset.close) closeModal(); });
  const cancelBtn = document.getElementById("modal-cancel");
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  document.getElementById("modal-confirm").addEventListener("click", () => {
    const data = m.getData ? m.getData(root) : undefined;
    // Optional: modals that pass `validate` keep themselves open (and show
    // the message in their own #modal-error box) until the input is valid.
    if (m.validate) {
      const msg = m.validate(data);
      if (msg) {
        const box = root.querySelector("#modal-error");
        if (box) { box.textContent = msg; box.style.display = ""; }
        return;
      }
    }
    closeModal(); m.onConfirm && m.onConfirm(data);
  });
  if (m.onOpen) m.onOpen(root);
}

function paint(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtINR(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

/* Single reusable date+time formatter for every notification/alert card
   (spec: "21 Sep 2026, 05:42 PM" style, safe fallback, never crashes on a
   missing/pending server timestamp). */
function fmtDateTime(ts) {
  if (!ts || typeof ts.toDate !== "function") return t("time_unavailable");
  try {
    return ts.toDate().toLocaleString(store.lang === "hi" ? "hi-IN" : "en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch (_) { return t("time_unavailable"); }
}

/* ============================== token / purchase helpers ==============================
   Limits below are MIRRORED in firestore.rules — change both together. */
const MAX_CROPS_PER_TOKEN = 3;        // rules: declaredCrops.size() <= 3 (also bounds the batched-write rule-call budget)
const MAX_QTY_QUINTAL = 5000;         // rules: quantity <= 5000
const MAX_RATE_PER_QUINTAL = 100000;  // rules: rate <= 100000
const GRADES = ["A", "B", "C"];       // rules: grade in ['A','B','C']
const OP_TIMEOUT_MS = 20000;
/* Queue estimates. There is no server on the Spark plan, so nothing can
   measure real service times: this is a flat estimate (minutes one counter
   needs per farmer). Change it here if your centers are faster/slower. */
const MINUTES_PER_TOKEN = 10;
const MAX_QUEUE_PUBLISHED = 50;        // rules: queueUids.size() <= 50 (= the queue query's limit)

function centerCounters(c) { return Math.max(1, Math.min(8, Number(c && c.counters) || 1)); }
/* Wait for someone joining now (center list / booking modal). null = the
   center has not published its queue yet -> UI shows "—", never a fake 0. */
function centerWaitMin(c) {
  const len = Number(c && c.queueLength);
  if (!c || c.queueLength == null || !Number.isFinite(len)) return null;
  return Math.ceil(len / centerCounters(c)) * MINUTES_PER_TOKEN;
}
/* 1-based position of a farmer in the center's published queue, or null. */
function queuePositionOf(center, farmerId) {
  const list = center && Array.isArray(center.queueUids) ? center.queueUids : null;
  const i = list ? list.indexOf(farmerId) : -1;
  return i >= 0 ? i + 1 : null;
}
function waitForPosition(center, pos) {
  return pos == null ? null : Math.ceil((pos - 1) / centerCounters(center)) * MINUTES_PER_TOKEN;
}

function cropName(code) {
  try {
    if (cropsAdapter.isReady()) {
      for (const g of cropsAdapter.getCropsByCategory()) {
        for (const c of g.crops) {
          if (c.code === code) return (store.lang === "hi" ? (c.nameHi || c.name) : c.name) || String(code);
        }
      }
    }
  } catch (_) { /* fall back to the raw code below */ }
  return String(code);
}
/* Real great-circle distance between two lat/lng points, in km, rounded to
   1 decimal. Returns null if either point is missing — the UI must then
   show "Distance unavailable", never a fake number. No paid Maps API. */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const R = 6371; // Earth's mean radius, km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
/* Best-effort browser geolocation. Always resolves (never rejects) so a
   caller can just `await` it and treat null as "not available/denied" —
   location is optional everywhere it's used, never required to proceed. */
function tryGetLocation() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}
/* Positive number, at most 2 decimals, <= max. Returns the number or null. */
function parsePositive2dp(raw, max) {
  const s = String(raw == null ? "" : raw).trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= max ? n : null;
}
function roundMoney(n) { return Math.round(n * 100) / 100; }
function newBookingId() {
  const bytes = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");   // 32 hex chars
}
function ksError(code, message, extra) { const e = new Error(message || code); e.code = code; if (extra) Object.assign(e, extra); return e; }
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(ksError("deadline-exceeded", "no server acknowledgement within " + ms + "ms")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
const fsRead = (ref) => withTimeout(getDoc(ref), OP_TIMEOUT_MS);
function declaredCropsSummary(map) {
  if (!map || typeof map !== "object") return "";
  return Object.entries(map).map(([code, q]) => `${cropName(code)} ${Number(q) || 0} ${t("quintal_short")}`).join(" · ");
}
/* Sync error -> i18n key, for flows that don't need to re-read anything. */
function simpleErrorKey(e) {
  const code = String((e && e.code) || "");
  if (code === "unavailable" || code === "network-request-failed" || navigator.onLine === false) return "network_error";
  if (code === "deadline-exceeded") return "err_network_slow";
  if (code === "unauthenticated") return "session_expired";
  if (code === "permission-denied") return "err_permission";
  return "err_unknown";
}

/* ============================== auth helpers ============================== */
function farmerEmail(username) { return `${username.trim().toLowerCase()}@f.kisansetu.app`; }
function centerEmail(centerId, adminId) { return `${centerId.trim().toLowerCase()}.${adminId.trim().toLowerCase()}@c.kisansetu.app`; }
function govEmail(officialId) { return `${officialId.trim().toLowerCase()}@g.kisansetu.app`; }

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
  // Demo Mode is fully isolated from Firebase: whatever this listener is
  // about to do (read Firestore, change store.screen) never runs while a
  // demo is open, so it can never overwrite demo state or leak a real
  // session into it.
  if (store.demoActive) return;

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
/* Optional "share current location" control — never blocks the form.
   Writes plain numbers onto the given data object; the caller re-paints
   (or not) as it likes. Browser geolocation permission is asked for only
   when this button is pressed, never on page load. */
function locationShareHtml(d) {
  const has = typeof d.latitude === "number" && typeof d.longitude === "number";
  return `<div class="field">
    <button type="button" class="btn ghost" id="loc-share-btn">${ic("mapPin", 16)}${t("share_location")}</button>
    <p class="tiny muted mt-1" id="loc-share-status">${has ? `${t("location_updated")} (${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)})` : ""}</p>
  </div>`;
}
function wireLocationShareButton(d, onDone) {
  const btn = document.getElementById("loc-share-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const loc = await tryGetLocation();
    btn.disabled = false;
    const status = document.getElementById("loc-share-status");
    if (loc) {
      d.latitude = loc.latitude; d.longitude = loc.longitude;
      if (status) status.textContent = `${t("location_updated")} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`;
    } else if (status) {
      status.textContent = t("location_denied");
    }
    if (onDone) onDone(loc);
  });
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
    d.email = form.email.value.trim();
    d.username = form.username.value.trim(); d.password = form.password.value; d.confirmPassword = form.confirmPassword.value;
    let bad = false;
    if (!d.fullName) { setFieldError(form, "fullName", t("field_required")); bad = true; }
    if (!/^[6-9]\d{9}$/.test(d.mobile)) { setFieldError(form, "mobile", t("field_required")); bad = true; }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { setFieldError(form, "email", t("invalid_email")); bad = true; }
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
      ...(d.email ? { email: d.email } : {}),
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

/* ---- forgot password: Firebase Auth's own secure reset email, no Cloud
   Function, no Blaze plan, and never a fake "OTP sent" claim.
   IMPORTANT, please read: a password-reset email can only ever reach the
   exact address that is this account's Firebase Auth login identifier.
   Farmer/Center/Government accounts created through this app sign in
   with a deterministic *synthetic* address (username@f.kisansetu.app,
   centerId.adminId@c.kisansetu.app, officialId@g.kisansetu.app) — never a
   real inbox — so "Reset using Username/ID" below computes that same
   address and asks Firebase to email it, but nobody can read that inbox.
   "Reset using Email" only works for an account whose Auth email really
   is a personal inbox — in this app, that is a farmer who signed up with
   "Continue with Google". This is a real limitation of the current
   username/synthetic-email login design, not something rules or a Cloud
   Function can work around; it's called out again in reset_email_note. */
function forgotIdentifierEmail(role, d) {
  if (role === "farmer") return d.username ? farmerEmail(d.username) : null;
  if (role === "center") return d.centerId && d.adminId ? centerEmail(d.centerId, d.adminId) : null;
  return d.officialId ? govEmail(d.officialId) : null;
}
async function forgotSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const method = store.forgotMethod || "username";
  const d = store.forgotData;
  let email = null;
  if (method === "email") {
    email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(form, "email", t("invalid_email")); return; }
  } else {
    const role = store.forgotRole || "farmer";
    if (role === "farmer") { d.username = form.username.value.trim(); if (!d.username) { setFieldError(form, "username", t("field_required")); return; } }
    else if (role === "center") {
      d.centerId = form.centerId.value.trim(); d.adminId = form.adminId.value.trim();
      if (!d.centerId || !d.adminId) { showAuthError(form, t("field_required")); return; }
    } else {
      d.officialId = form.officialId.value.trim();
      if (!d.officialId) { setFieldError(form, "officialId", t("field_required")); return; }
    }
    email = forgotIdentifierEmail(role, d);
  }
  setBtnLoading(form, true);
  // A generic outcome regardless of whether the account exists — this is
  // standard, honest practice (it never claims an OTP was sent, and never
  // discloses which usernames/emails have real accounts).
  try { await sendPasswordResetEmail(auth, email); } catch (_) { /* still show the generic message below */ }
  setBtnLoading(form, false);
  store.forgotStep = "sent";
  paintScreen();
}
function exitForgot() {
  store.screen = "login"; store.forgotStep = "identify"; store.forgotMethod = "username";
  store.forgotRole = "farmer"; store.forgotData = {};
  paintScreen();
}

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
        <div class="auth-divider"><span>${t("or_divider")}</span></div>
        <button type="button" class="btn ghost block demo-cta-btn" id="go-demo">${ic("play", 16)}${t("try_demo")}</button>
        <div class="demo-picker" id="demo-picker" hidden>
          <p class="tiny muted mb-1">${t("demo_pick_role")}</p>
          <div class="demo-role-grid">
            <button type="button" class="demo-role-btn" data-demo-role="farmer">${ic("user", 20)}<span>${t("role_farmer")}</span></button>
            <button type="button" class="demo-role-btn" data-demo-role="center">${ic("building", 20)}<span>${t("role_center")}</span></button>
            <button type="button" class="demo-role-btn" data-demo-role="gov">${ic("users", 20)}<span>${t("role_gov")}</span></button>
          </div>
        </div>
        <div class="auth-foot-links">
          <button type="button" id="go-about">${t("about")}</button>
          <button type="button" id="go-help">${t("help")}</button>
        </div>
      </div>
    </div>
  </div>`;
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
      <div class="field"><label for="su-email">${t("email_optional")}</label><input id="su-email" name="email" type="email" autocomplete="email" value="${esc(d.email || "")}"></div>
      <div class="field"><label for="su-username">${t("username")}</label><input id="su-username" name="username" autocomplete="username" value="${esc(d.username || "")}" required></div>
      <div class="field"><label for="su-password">${t("password")}</label><input id="su-password" name="password" type="password" autocomplete="new-password" required></div>
      <div class="field"><label for="su-confirm">${t("confirm_password")}</label><input id="su-confirm" name="confirmPassword" type="password" autocomplete="new-password" required></div>`;
  } else if (store.signupStep === 2) {
    fields = `<div id="location-fields">${locationStepHtml(d)}</div>${locationShareHtml(d)}`;
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
    fields = `<div id="location-fields">${locationStepHtml(d)}</div>${locationShareHtml(d)}`;
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
  const method = store.forgotMethod || "username";
  const role = store.forgotRole || "farmer";
  let body = "";
  if (step === "sent") {
    body = `<div class="alert ok">${ic("checkCircle")}<span>${t("reset_email_sent")}</span></div>
      <p class="tiny muted mt-1">${t("reset_email_note")}</p>
      <button class="btn block mt-2" id="forgot-done">${t("sign_in")}</button>`;
  } else {
    const methodTabs = `<div class="segs" role="tablist">
      <button type="button" data-reset-method="username" aria-current="${method === "username"}">${t("reset_via_username")}</button>
      <button type="button" data-reset-method="email" aria-current="${method === "email"}">${t("reset_via_email")}</button>
    </div>`;
    let fields;
    if (method === "email") {
      fields = `<div class="field"><label for="fg-email">${t("email")}</label><input id="fg-email" name="email" type="email" autocomplete="email" required></div>`;
    } else {
      const roleTabs = `<div class="segs" role="tablist">
        <button type="button" data-reset-role="farmer" aria-current="${role === "farmer"}">${t("role_farmer")}</button>
        <button type="button" data-reset-role="center" aria-current="${role === "center"}">${t("role_center")}</button>
        <button type="button" data-reset-role="gov" aria-current="${role === "gov"}">${t("role_gov")}</button>
      </div>`;
      let roleFields;
      if (role === "farmer") {
        roleFields = `<div class="field"><label for="fg-username">${t("username")}</label><input id="fg-username" name="username" autocomplete="username" required></div>`;
      } else if (role === "center") {
        roleFields = `<div class="field"><label for="fg-centerid">${t("center_id")}</label><input id="fg-centerid" name="centerId" required></div>
          <div class="field"><label for="fg-adminid">${t("admin_id")}</label><input id="fg-adminid" name="adminId" required></div>`;
      } else {
        roleFields = `<div class="field"><label for="fg-officialid">${t("official_id")}</label><input id="fg-officialid" name="officialId" required></div>`;
      }
      fields = roleTabs + roleFields;
    }
    body = `${methodTabs}
      <form id="forgot-reset-form" novalidate>
        ${fields}
        <button type="submit" class="btn block mt-2">${t("send_reset_link")}</button>
      </form>`;
  }
  return `<div class="auth-panel" style="min-height:100vh">
    <div class="auth-card">
      <div class="auth-brand"><div class="glyph">${ic("sprout", 20)}</div><div class="auth-brand-name brand-face">${t("brand")}</div></div>
      <h1 style="font-size:19px">${t("forgot_password")}</h1>
      <div id="forgot-body">${body}</div>
      <p class="auth-switch"><button type="button" class="link-btn" id="forgot-exit">${t("sign_in")}</button></p>
    </div>
  </div>`;
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
  if (role === "center") return [["queue", "users", t("nav_queue")], ["pending", "ticket", t("nav_pending_payment")], ["capacity", "settings", t("nav_capacity")], ["payments", "alert", t("nav_payments")], ["notif", "bell", t("nav_notif")], ["settings", "user", t("nav_settings")]];
  return [["overview", "chart", t("nav_overview")], ["centers", "building", t("nav_centers")], ["farmers", "users", t("nav_farmers")], ["register", "plus", t("nav_register")], ["announce", "bell", t("announcements_title")], ["alerts", "alert", t("nav_alerts")], ["settings", "settings", t("nav_settings")]];
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
  return `<div id="ks-ticker"></div>
  <header class="topbar">
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
          <button id="acct-profile">${ic("user", 16)}${t("my_profile")}</button>
          <button id="acct-settings">${ic("settings", 16)}${t("nav_settings")}</button>
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
  const acctProfile = document.getElementById("acct-profile");
  if (acctProfile) acctProfile.addEventListener("click", () => {
    store.accountOpen = false;
    const panel = document.getElementById("account-panel"); if (panel) panel.classList.remove("open");
    openProfileModal();
  });
  const acctSettings = document.getElementById("acct-settings");
  if (acctSettings) acctSettings.addEventListener("click", () => {
    store.accountOpen = false;
    const panel = document.getElementById("account-panel"); if (panel) panel.classList.remove("open");
    setTabKey("settings");
  });
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
    if (store.sortBy === "wait") return (centerWaitMin(a) ?? 999) - (centerWaitMin(b) ?? 999);
    if (store.sortBy === "token") return (b.tokenAvailability ?? -1) - (a.tokenAvailability ?? -1);
    return (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999);
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
          <span>${c.distanceKm != null ? `${c.distanceKm} ${t("km_away")}` : t("distance_unavailable")}</span>
          <span>${t("queue_len")}: ${c.queueLength != null ? c.queueLength : "—"}</span>
          <span>${t("est_wait")}: ${centerWaitMin(c) != null ? centerWaitMin(c) + " min" : "—"}</span>
          <span class="badge ${c.govStatus !== "active" ? "red" : c.status === "open" ? "green" : "red"}">${c.govStatus !== "active" ? t("gov_inactive") : c.status === "open" ? t("open_now") : t("closed_now")}</span>
        </div>
      </div>
      <div class="actions"><button class="btn gold" data-book="${c.id}" ${c.govStatus !== "active" || c.status !== "open" ? "disabled" : ""}>${t("book_token")}</button></div>
    </div>`).join("")}</div>`;
}

/* ---- Farmer profile card: the currently authenticated farmer's own real
   Firestore profile (farmers/{uid}), never Demo data. Also offers to
   (re)share location, which is what powers the real Haversine distance
   below — sharing it is always optional. ---- */
function farmerProfileCardHtml(farmer) {
  if (!farmer) return `<div class="card muted tiny">${t("loading")}</div>`;
  const row = (label, val) => `<div class="col"><span class="tiny muted">${label}</span><span>${val != null && val !== "" ? esc(val) : t("not_available")}</span></div>`;
  const hasLoc = typeof farmer.latitude === "number" && typeof farmer.longitude === "number";
  return `<div class="card" id="farmer-profile-card">
    <div class="row gap-s"><h3 style="margin:0">${t("my_profile")}</h3><span class="spacer"></span>
      <button class="btn ghost" id="farmer-update-location">${ic("mapPin", 16)}${t("update_location")}</button></div>
    <div class="grid-2 mt-2">
      ${row(t("full_name"), farmer.name)}
      ${row(t("mobile"), farmer.mobile)}
      ${row(t("email"), farmer.email)}
      ${row(t("username"), farmer.username)}
      ${row(t("state"), farmer.state)}
      ${row(t("district"), farmer.district)}
      ${row(t("block"), farmer.block)}
      ${row(t("village"), farmer.village)}
    </div>
    <p class="tiny muted mt-1">${hasLoc ? `${t("location_updated")} (${farmer.latitude.toFixed(4)}, ${farmer.longitude.toFixed(4)})` : t("distance_unavailable")}</p>
  </div>`;
}

/* ---- Center profile card: the logged-in Center's own real Firestore
   center document (centers/{centerId}) plus the operator's own contact
   name from users/{uid} (store.profile.name). Never Demo data. ---- */
function centerProfileCardHtml(center, profile) {
  if (!center) return `<div class="card muted tiny">${t("loading")}</div>`;
  const row = (label, val) => `<div class="col"><span class="tiny muted">${label}</span><span>${val != null && val !== "" ? esc(val) : t("not_available")}</span></div>`;
  const crops = Array.isArray(center.acceptedCrops) && center.acceptedCrops.length
    ? center.acceptedCrops.map(cropName).join("، ") : null;
  const created = center.createdAt && center.createdAt.toDate ? center.createdAt.toDate().toLocaleDateString(store.lang === "hi" ? "hi-IN" : "en-IN") : null;
  return `<div class="card" id="center-profile-card">
    <h3 style="margin:0 0 8px">${t("my_profile")}</h3>
    <div class="grid-2">
      ${row(t("center_name"), center.centerName)}
      ${row(t("center_id"), center.centerId)}
      ${row(t("contact_person"), profile && profile.name)}
      ${row(t("mobile"), center.registeredMobile)}
      ${row(t("email"), center.email)}
      ${row(t("state"), center.state)}
      ${row(t("district"), center.district)}
      ${row(t("block"), center.block)}
      ${row(t("village"), center.village)}
      ${row(t("address_field"), center.address)}
      ${row(t("gov_capacity_label"), typeof center.capacity === "number" ? `${center.capacity} ${t("quintal_per_day")}` : null)}
      ${row(t("crops_list"), crops)}
      ${row(t("current_status"), center.status === "open" ? t("open_now") : center.status === "closed" ? t("closed_now") : null)}
      ${row(t("government_status"), center.govStatus === "active" ? t("gov_active") : center.govStatus === "inactive" ? t("gov_inactive") : null)}
      ${row(t("registration_date"), created)}
    </div>
  </div>`;
}

/* Opens the logged-in user's real Profile Card as a modal — reachable
   ONLY from the avatar/account menu. Deliberately separate from Settings
   (password change), which stays a separate nav/menu item. Always reads
   the current Firestore doc, never cached/demo data. */
function openProfileModal() {
  const role = store.profile.role;
  openModal({
    title: t("my_profile"),
    body: `<div id="profile-modal-body">${loadingBlock()}</div>`,
    hideCancel: true,
    confirmText: t("close"),
    onOpen: (root) => {
      const target = () => root.querySelector("#profile-modal-body");
      if (role === "farmer") {
        getDoc(doc(db, "farmers", store.user.uid)).then((snap) => {
          const farmer = snap.exists() ? snap.data() : null;
          const el = target(); if (el) el.innerHTML = farmerProfileCardHtml(farmer);
          const locBtn = root.querySelector("#farmer-update-location");
          if (locBtn) locBtn.addEventListener("click", async () => {
            locBtn.disabled = true;
            const loc = await tryGetLocation();
            locBtn.disabled = false;
            if (!loc) { showToast(t("location_denied")); return; }
            try {
              await updateDoc(doc(db, "farmers", store.user.uid), { latitude: loc.latitude, longitude: loc.longitude, updatedAt: serverTimestamp() });
              showToast(t("location_updated"));
              openProfileModal();
              if (store.farmerTab === "home") subscribeFarmerHome();
            } catch (_) { showToast(t("network_error")); }
          });
        }).catch(() => { const el = target(); if (el) el.innerHTML = `<div class="card muted tiny">${t("err_unknown")}</div>`; });
      } else if (role === "center") {
        getDoc(doc(db, "centers", store.profile.centerId)).then((snap) => {
          const center = snap.exists() ? { id: snap.id, ...snap.data() } : null;
          const el = target(); if (el) el.innerHTML = centerProfileCardHtml(center, store.profile);
        }).catch(() => { const el = target(); if (el) el.innerHTML = `<div class="card muted tiny">${t("err_unknown")}</div>`; });
      } else {
        const el = target();
        if (el) el.innerHTML = `<div class="card"><div class="grid-2">
          <div class="col"><span class="tiny muted">${t("official_id")}</span><span>${esc(store.profile.officialId || "")}</span></div>
          <div class="col"><span class="tiny muted">${t("full_name")}</span><span>${esc(store.profile.name || "")}</span></div>
        </div></div>`;
      }
    },
  });
}

function subscribeFarmerHome() {
  getDoc(doc(db, "farmers", store.user.uid)).then((snap) => {
    const farmer = snap.exists() ? snap.data() : {};
    const q1 = query(collection(db, "centers"), where("districtCode", "==", farmer.districtCode), limit(20));
    store._unsub.centers = onSnapshot(q1, (qs) => {
      const centers = qs.docs.map((d) => {
        const c = { id: d.id, ...d.data() };
        c.distanceKm = (typeof farmer.latitude === "number" && typeof farmer.longitude === "number")
          ? haversineKm(farmer.latitude, farmer.longitude, c.latitude, c.longitude)
          : null;
        // "Token availability" adapts to the real capacity/queue fields
        // already on the center doc — no invented per-day token counter.
        c.tokenAvailability = typeof c.capacity === "number" ? Math.max(0, c.capacity - (c.queueLength || 0)) : null;
        return c;
      });
      // Item 8 fix: the Farmer dashboard must NOT permanently show the
      // full Profile Card (that's avatar -> My Profile only, see
      // openProfileModal). Home just gets a small nudge to share location
      // when it's missing, since Nearest sorting depends on it.
      const locPrompt = (typeof farmer.latitude === "number" && typeof farmer.longitude === "number") ? "" : `
        <div class="alert warn"><span>${t("distance_unavailable")}</span>
          <button class="btn ghost tiny" id="farmer-home-update-location" style="margin-left:auto">${ic("mapPin", 14)}${t("share_location")}</button>
        </div>`;
      paint("farmer-home", `${locPrompt}<h2 class="section-title">${t("nearby_centers")}</h2>${renderNearbyCenters(centers)}`);
      document.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { store.sortBy = b.dataset.sort; subscribeFarmerHome(); }));
      document.querySelectorAll("[data-book]").forEach((b) => b.addEventListener("click", () => startBooking(b.dataset.book, centers.find((c) => c.id === b.dataset.book))));
      const locBtn = document.getElementById("farmer-home-update-location");
      if (locBtn) locBtn.addEventListener("click", async () => {
        locBtn.disabled = true;
        const loc = await tryGetLocation();
        locBtn.disabled = false;
        if (!loc) { showToast(t("location_denied")); return; }
        try {
          await updateDoc(doc(db, "farmers", store.user.uid), { latitude: loc.latitude, longitude: loc.longitude, updatedAt: serverTimestamp() });
          showToast(t("location_updated"));
          subscribeFarmerHome();
        } catch (_) { showToast(t("network_error")); }
      });
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
function bookingCropsHtml(center) {
  const accepted = Array.isArray(center.acceptedCrops) ? center.acceptedCrops.filter((c) => typeof c === "string" && c) : [];
  const err = `<div id="modal-error" class="alert danger" role="alert" style="display:none"></div>`;
  if (!accepted.length) return `<p class="tiny muted">${t("bk_err_no_accepted")}</p>${err}`;
  return `<p class="tiny muted mb-1">${t("bk_crops_hint")}</p>
    <div style="max-height:50vh;overflow:auto">${accepted.map((code) => `
      <div style="display:flex;gap:8px;align-items:center;margin:6px 0">
        <label class="crop-chip" style="flex:1"><input type="checkbox" name="bk-crop" value="${esc(code)}"><span>${esc(cropName(code))}</span></label>
        <div class="field" style="margin:0;width:120px"><input data-bk-qty="${esc(code)}" inputmode="decimal" placeholder="${t("quintal_short")}" aria-label="${esc(cropName(code))} — ${t("quintal_short")}"></div>
      </div>`).join("")}</div>
    ${err}`;
}

function startBooking(centerId, center) {
  if (!center || center.govStatus !== "active" || center.status !== "open") return;
  openModal({
    title: t("book_token"),
    body: `${esc(center.centerName)} — ${t("est_wait")}: ${centerWaitMin(center) != null ? centerWaitMin(center) + " min" : "—"}${bookingCropsHtml(center)}`,
    confirmText: t("book_token"), cancelText: t("cancel"),
    onOpen: (root) => {
      const box = root.querySelector(".modal") || root;
      // Typing a quantity ticks the crop; ticking a crop jumps to its quantity.
      box.addEventListener("input", (ev) => {
        const q = ev.target && ev.target.dataset && ev.target.dataset.bkQty;
        if (q == null) return;
        const cb = Array.from(box.querySelectorAll('input[name="bk-crop"]')).find((c) => c.value === q);
        if (cb) cb.checked = ev.target.value.trim() !== "";
      });
      box.addEventListener("change", (ev) => {
        if (!ev.target || ev.target.name !== "bk-crop" || !ev.target.checked) return;
        const inp = Array.from(box.querySelectorAll("[data-bk-qty]")).find((i) => i.dataset.bkQty === ev.target.value);
        if (inp) inp.focus();
      });
    },
    getData: (root) => {
      const crops = {}; let selected = 0, bad = 0;
      root.querySelectorAll('input[name="bk-crop"]:checked').forEach((cb) => {
        selected++;
        const inp = Array.from(root.querySelectorAll("[data-bk-qty]")).find((i) => i.dataset.bkQty === cb.value);
        const q = parsePositive2dp(inp && inp.value, MAX_QTY_QUINTAL);
        if (q == null || cb.value.includes("/")) bad++; else crops[cb.value] = q;
      });
      return { crops, selected, bad };
    },
    validate: (d) => {
      if (!d.selected) return Array.isArray(center.acceptedCrops) && center.acceptedCrops.length ? t("bk_err_no_crop") : t("bk_err_no_accepted");
      if (d.selected > MAX_CROPS_PER_TOKEN) return t("bk_err_max_crops");
      if (d.bad) return t("bk_err_qty");
      return "";
    },
    onConfirm: async (data) => {
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
        showToast(t(simpleErrorKey(e)));
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
        // regardless (including that every declared crop is in the
        // center's acceptedCrops).
        const centerSnap = await getDoc(doc(db, "centers", centerId));
        if (!centerSnap.exists() || centerSnap.data().govStatus !== "active" || centerSnap.data().status !== "open") {
          showToast(t("err_permission"));
          return;
        }
        const accepted = centerSnap.data().acceptedCrops;
        if (!Array.isArray(accepted) || Object.keys(data.crops).some((c) => !accepted.includes(c))) {
          showToast(t("bk_err_crop_gone"));
          return;
        }
        // The farmer's display name always comes from their own
        // users/{uid} document, never from anything typed on this screen.
        const userSnap = await getDoc(doc(db, "users", uid));
        const farmerName = userSnap.exists() ? userSnap.data().name : "";
        const farmerSnap = await getDoc(doc(db, "farmers", uid));
        const farmerMobile = farmerSnap.exists() ? farmerSnap.data().mobile : "";
        const farmerEmail = farmerSnap.exists() ? farmerSnap.data().email : null;
        // bookingId is unique per booking. tokens/{uid} is reused across
        // bookings, so purchase/notification document IDs are derived from
        // uid + bookingId — that is what lets each booking produce its own
        // purchases exactly once, while a re-serve of the same booking
        // can never create a second copy.
        await setDoc(doc(db, "tokens", uid), {
          farmerId: uid,
          farmerName,
          farmerMobile,
          ...(farmerEmail ? { farmerEmail } : {}),
          centerId,
          status: "waiting",
          bookingId: newBookingId(),
          declaredCrops: data.crops,
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
        // write-time rejection (e.g. center not open/active, crop not
        // accepted, farmerName mismatch) or a real network failure, and
        // the toast says which.
        showToast(t(simpleErrorKey(e)));
      }
    },
  });
}

function subscribeFarmerToken() {
  const q1 = query(collection(db, "tokens"), where("farmerId", "==", store.user.uid), where("status", "==", "waiting"), limit(1));
  store._unsub.myToken = onSnapshot(q1, (qs) => {
    if (store._unsub.myTokenCenter) { store._unsub.myTokenCenter(); store._unsub.myTokenCenter = null; }
    if (qs.empty) { paint("farmer-token", emptyState("ticket", t("no_active_token"), t("no_active_token_desc"))); return; }
    const tok = { id: qs.docs[0].id, ...qs.docs[0].data() };
    // Live center document: the center publishes queueUids/queueLength/counters
    // there (see subscribeCenterQueue), so position and wait update as the
    // queue moves — no Cloud Function involved.
    store._unsub.myTokenCenter = onSnapshot(doc(db, "centers", tok.centerId), (centerSnap) => {
      const center = centerSnap.exists() ? centerSnap.data() : {};
      const pos = queuePositionOf(center, tok.farmerId);
      const wait = waitForPosition(center, pos);
      paint("farmer-token", `<h2 class="section-title">${t("my_token")}</h2>
      <div class="token-card">
        <span class="status-pill badge gold">${t("token_status_waiting")}</span>
        <div class="token-num">#${tok.id.slice(-6).toUpperCase()}</div>
        <div class="token-meta">
          <div><div class="k">${t("center_id")}</div><div class="v">${esc(center.centerName || tok.centerId)}</div></div>
          <div><div class="k">${t("queue_position")}</div><div class="v">${pos != null ? pos : "—"}</div></div>
          <div><div class="k">${t("est_wait")}</div><div class="v">${wait != null ? wait + " min" : "—"}</div></div>
          <div><div class="k">${t("declared_crops")}</div><div class="v">${esc(declaredCropsSummary(tok.declaredCrops)) || "—"}</div></div>
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
    }, () => paint("farmer-token", emptyState("ticket", t("no_active_token"), t("no_active_token_desc"))));
  });
}

function subscribeFarmerHistory() {
  const q1 = query(collection(db, "purchases"), where("farmerId", "==", store.user.uid), orderBy("purchaseDate", "desc"), limit(15));
  store._unsub.history = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("farmer-history", emptyState("history", t("no_history"), t("no_history_desc"))); return; }
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    paint("farmer-history", `<div class="card">${rows.map((p) => {
      const badgeCls = p.paymentStatus === "confirmed" || p.paymentStatus === "paid" ? "green" : p.paymentStatus === "processing" ? "gold" : "muted";
      const badgeLabel = t(p.paymentStatus || "pending");
      // 'processing' = the Center has marked this paid but the farmer has
      // not yet confirmed receipt — show the confirmation prompt from
      // spec item 9/10 right here, driven by the live onSnapshot above so
      // no refresh is ever needed.
      const confirmBanner = p.paymentStatus === "processing" ? `
        <div class="alert warn mt-1" style="flex-direction:column;align-items:stretch;gap:6px">
          <span>${esc(t("center_marked_paid_banner").replace("{amount}", Number(p.paidAmount ?? p.amount).toLocaleString("en-IN")))}</span>
          <div class="row gap-s">
            <button class="btn" data-payment-received="${p.id}">${t("payment_received")}</button>
            <button class="btn ghost" data-report-issue="${p.id}">${t("payment_not_received")}</button>
          </div>
        </div>` : "";
      return `<div class="history-item" style="flex-direction:column;align-items:stretch">
        <div class="row gap-s" style="width:100%">
          <div>
            <div class="row gap-s"><b>${esc(cropName(p.crop))}</b><span class="tiny muted">${fmtDateTime(p.purchaseDate)}</span></div>
            <div class="tiny muted">${esc(p.centerName || p.centerId)} · ${esc(p.quantity)} · ${t("grade")}: ${esc(p.grade || "—")}</div>
            ${p.paymentStatus !== "processing" ? `<button class="btn ghost tiny mt-1" data-report-issue="${p.id}">${t("payment_issue")}</button>` : ""}
          </div>
          <span class="spacer"></span>
          <div class="amount">${fmtINR(p.amount)}<div><span class="badge ${badgeCls}">${badgeLabel}</span></div></div>
        </div>
        ${confirmBanner}
      </div>`;
    }).join("")}</div>`);
    document.querySelectorAll("[data-report-issue]").forEach((b) => b.addEventListener("click", () => {
      openPaymentIssueModal(rows.find((p) => p.id === b.dataset.reportIssue));
    }));
    document.querySelectorAll("[data-payment-received]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await withTimeout(updateDoc(doc(db, "purchases", b.dataset.paymentReceived), {
          paymentStatus: "confirmed", confirmedAt: serverTimestamp(), confirmedBy: store.user.uid,
        }), OP_TIMEOUT_MS);
        showToast(t("payment_confirmed_toast"));
      } catch (e) {
        console.error("[farmerConfirmPayment] error.code:", e && e.code, "| message:", e && e.message);
        showToast(t(simpleErrorKey(e)));
        b.disabled = false;
      }
    }));
  }, (err) => { console.error("[subscribeFarmerHistory] error.code:", err && err.code, "| message:", err && err.message); paint("farmer-history", emptyState("history", t("no_history"), t("no_history_desc"))); });
}

/* Real payment/issue report against a real purchase the farmer actually
   owns. Written to paymentRequests; firestore.rules re-validates every
   copied field (crop/quantity/amount/center) against the purchase itself,
   so nothing here can be spoofed from the browser. */
async function openPaymentIssueModal(purchase) {
  if (!purchase) return;
  let farmer;
  try {
    const snap = await fsRead(doc(db, "farmers", store.user.uid));
    farmer = snap.exists() ? snap.data() : null;
  } catch (_) { showToast(t("network_error")); return; }
  if (!farmer) { showToast(t("err_unknown")); return; }
  openModal({
    title: t("report_issue"),
    body: `<p class="tiny muted">${esc(cropName(purchase.crop))} · ${esc(purchase.quantity)} ${t("quintal_short")} · ${fmtINR(purchase.amount)} · ${esc(purchase.centerName)}</p>
      <div class="field"><label for="pi-type">${t("issue_type")}</label>
        <select id="pi-type" required>
          <option value="payment_delayed">${t("issue_payment_delayed")}</option>
          <option value="incorrect_amount">${t("issue_incorrect_amount")}</option>
          <option value="quantity_issue">${t("issue_quantity_issue")}</option>
          <option value="other">${t("issue_other")}</option>
        </select></div>
      <div class="field"><label for="pi-desc">${t("issue_description")}</label><textarea id="pi-desc" rows="3" maxlength="500"></textarea></div>
      <p class="tiny muted">${t("issue_reaches_both")}</p>
      <div id="modal-error" class="alert danger" role="alert" style="display:none"></div>`,
    confirmText: t("submit"), cancelText: t("cancel"),
    getData: (root) => ({
      issueType: root.querySelector("#pi-type").value,
      description: root.querySelector("#pi-desc").value.trim().slice(0, 500),
    }),
    onConfirm: async (d) => {
      try {
        if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");
        await withTimeout(setDoc(doc(collection(db, "paymentRequests")), {
          farmerId: store.user.uid, farmerName: farmer.name, farmerMobile: farmer.mobile,
          centerId: purchase.centerId, centerName: purchase.centerName,
          issueType: d.issueType, description: d.description,
          purchaseId: purchase.id, crop: purchase.crop, quantity: purchase.quantity, amount: purchase.amount,
          // Always visible to BOTH the owning Center and Government — the
          // farmer no longer has to choose a single destination, and
          // neither side is ever silently left out (spec item 4).
          requestedTo: "both", status: "open", createdAt: serverTimestamp(),
        }), OP_TIMEOUT_MS);
        showToast(t("request_sent"));
      } catch (e) {
        console.error("[openPaymentIssueModal] error.code:", e && e.code, "| message:", e && e.message);
        showToast(t(simpleErrorKey(e)));
      }
    },
  });
}

function subscribeFarmerNotif() {
  const q1 = query(collection(db, "notifications"), where("userId", "==", store.user.uid), orderBy("createdAt", "desc"), limit(20));
  store._unsub.notif = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("farmer-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))); return; }
    paint("farmer-notif", `<div class="card">${qs.docs.map((d) => {
      const n = d.data();
      // "token_served" notifications carry structured fields only (a center
      // can't write free text to a farmer); the sentence is built here.
      const text = n.type === "token_served" ? t("notif_token_served").replace("{center}", n.centerName || "") : n.text;
      return `<div class="history-item" style="flex-direction:column;align-items:stretch"><span>${esc(text)}</span><span class="tiny muted">${fmtDateTime(n.createdAt)}</span></div>`;
    }).join("")}</div>`);
  }, () => paint("farmer-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))));
}

/* ============================== center views ============================== */
function centerBody() {
  const tab = store.centerTab;
  if (tab === "queue") return `<div class="row gap-s"><h2 class="section-title" style="margin:0">${t("queue_title")}</h2><span class="spacer"></span>
      <button class="btn gold" id="add-local-purchase">${ic("plus", 16)}${t("add_local_purchase")}</button></div>
    <div id="queue-sync"></div><div id="center-queue">${loadingBlock()}</div>`;
  if (tab === "pending") return `<h2 class="section-title">${t("nav_pending_payment")}</h2><div id="center-pending">${loadingBlock()}</div>`;
  if (tab === "capacity") return `<h2 class="section-title">${t("center_status")}</h2><div id="center-capacity">${loadingBlock()}</div>`;
  if (tab === "payments") return `<h2 class="section-title">${t("nav_payments")}</h2><div id="center-payments">${loadingBlock()}</div>`;
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
  const addBtn = document.getElementById("add-local-purchase");
  if (addBtn) addBtn.addEventListener("click", openAddLocalPurchase);
  // store.profile.centerId — set on the center's users/{uid} doc by
  // Government's client-side registration flow (see wireGovRegister) — is
  // the center's real business ID. The center's Auth uid (store.user.uid)
  // is a different value and must never be used as a centerId anywhere.
  const q1 = query(collection(db, "tokens"), where("centerId", "==", store.profile.centerId), where("status", "==", "waiting"), orderBy("createdAt", "asc"), limit(MAX_QUEUE_PUBLISHED));

  /* Publishes the queue to centers/{centerId} (queueUids, queueLength) so
     farmers can see their position / the wait. Only the center can write
     these fields (firestore.rules validates type and size, and that only
     the owning, gov-active center writes). It runs while this Queue tab is
     open; if nobody has it open the numbers go stale — see the notes. */
  let latestDocs = null, latestCenter = null, lastSig = null, retries = 0, retryTimer = null;
  const setSync = (ok, detail) => {
    const el = document.getElementById("queue-sync");
    if (!el) return;
    el.innerHTML = ok
      ? `<div class="tiny muted">${esc(t("queue_sync_ok").replace("{n}", String(detail)))}</div>`
      : `<div class="alert danger" role="alert">${ic("alert")}<span>${esc(t("queue_sync_fail").replace("{code}", String(detail)))}${detail === "permission-denied" ? " " + esc(t("queue_sync_hint")) : ""}</span></div>`;
  };
  const publishQueue = () => {
    if (!latestDocs) return;
    if (latestCenter && latestCenter.govStatus !== "active") return;
    const uids = latestDocs.map((d) => d.data().farmerId).filter((x) => typeof x === "string");
    const patch = { queueUids: uids, queueLength: uids.length };
    const sig = JSON.stringify(patch);
    const already = !!latestCenter && latestCenter.queueLength === patch.queueLength && JSON.stringify(latestCenter.queueUids || []) === JSON.stringify(uids);
    if (already) { lastSig = sig; setSync(true, uids.length); return; }
    if (sig === lastSig) return;
    lastSig = sig;
    updateDoc(doc(db, "centers", store.profile.centerId), patch).then(() => {
      retries = 0;
      setSync(true, uids.length);
    }).catch((e) => {
      lastSig = null;   // a rejected write rolls the local doc back; retry instead of staying stale
      console.error("[publishQueue] TEMP diagnostic — error.code:", e && e.code, "| error.message:", e && e.message);
      setSync(false, (e && e.code) || "error");
      if (retries < 3) { retries++; clearTimeout(retryTimer); retryTimer = setTimeout(publishQueue, 3000); }
    });
  };
  store._unsub.queueRetry = () => clearTimeout(retryTimer);
  store._unsub.queueCenter = onSnapshot(doc(db, "centers", store.profile.centerId), (snap) => {
    latestCenter = snap.exists() ? snap.data() : null;
    publishQueue();
  }, (e) => { console.error("[publishQueue] center listener error:", e && e.code, e && e.message); publishQueue(); });

  store._unsub.queue = onSnapshot(q1, (qs) => {
    latestDocs = qs.docs;
    publishQueue();
    if (qs.empty) { paint("center-queue", emptyState("users", t("no_queue"), t("no_queue_desc"))); return; }
    paint("center-queue", `<div class="card">${qs.docs.map((d, i) => {
      const tk = { id: d.id, ...d.data() };
      const cropsLine = declaredCropsSummary(tk.declaredCrops);
      return `<div class="queue-row"><span class="pos">${i + 1}</span>
        <div class="col" style="flex:1"><b>${esc(tk.farmerName || tk.farmerId)}</b><span class="tiny muted">#${tk.id.slice(-6).toUpperCase()}</span>
          ${tk.farmerMobile ? `<span class="tiny muted">${ic("user", 12)} ${esc(tk.farmerMobile)}</span>` : ""}
          ${tk.farmerEmail ? `<span class="tiny muted">${esc(tk.farmerEmail)}</span>` : ""}
          ${cropsLine ? `<span class="tiny muted">${esc(cropsLine)}</span>` : ""}
          <span class="tiny muted">${t("current_status")}: ${t("token_status_waiting")}</span></div>
        ${i === 0 ? `<button class="btn" data-serve="${tk.id}">${t("mark_served")}</button><button class="btn ghost" data-noshow="${tk.id}">${t("mark_noshow")}</button>` : ""}
      </div>`;
    }).join("")}</div>`);
    const tokensByAttr = qs.docs.reduce((m, d) => { m[d.id] = { id: d.id, ...d.data() }; return m; }, {});
    document.querySelectorAll("[data-serve]").forEach((b) => b.addEventListener("click", () => centerMarkServed(b.dataset.serve, tokensByAttr[b.dataset.serve])));
    document.querySelectorAll("[data-noshow]").forEach((b) => b.addEventListener("click", () => centerMarkNoShow(b.dataset.noshow)));
  }, () => paint("center-queue", emptyState("users", t("no_queue"), t("no_queue_desc"))));
}

/* ---- Center: serve / no-show — direct Firestore (Spark plan, no Cloud Functions) ----
   What the rules (firestore.rules) enforce server-side, independent of this code:
   - only an ACTIVE center, only for a token whose centerId == users/{uid}.centerId
   - only while the token is still "waiting"
   - purchase farmerId/centerId/farmerName/centerName/declaredQuantity must match the
     token / center documents; amount must equal quantity x rate; crop must be one the
     farmer declared AND the center accepts; grade must be A/B/C
   - purchase doc ID = `${tokenId}_${bookingId}_${crop}` -> the token is the uniqueness anchor
   - purchase + notification + token->"done" must be ONE atomic batch (rules use getAfter)
   The browser only supplies crop / weight / rate / grade. Nothing about identity or
   money is taken from the UI. */
const SERVE_ERR_KEYS = {
  "ks/invalid-input": "err_invalid_input",
  "ks/invalid-grade": "serve_err_grade",
  "ks/no-lines": "serve_err_none",
  "ks/crop-not-accepted": "bk_err_crop_gone",
};

function serveRowsHtml(entries) {
  return entries.map(([code, declared]) => {
    const d = typeof declared === "number" ? declared : 0;
    return `<div class="card" data-serve-row="${esc(code)}" data-declared="${d}" style="margin:8px 0">
      <div class="row gap-s"><b>${esc(cropName(code))}</b><span class="spacer"></span><span class="tiny muted">${t("serve_declared")}: ${d} ${t("quintal_short")}</span></div>
      <div class="grid-2">
        <div class="field"><label>${t("serve_actual_weight")}</label><input data-f="weight" inputmode="decimal" value="${d}" aria-label="${t("serve_actual_weight")}"></div>
        <div class="field"><label>${t("rate_per_quintal")}</label><input data-f="rate" inputmode="decimal" aria-label="${t("rate_per_quintal")}"></div>
      </div>
      <div class="field"><label>${t("grade")}</label><select data-f="grade" aria-label="${t("grade")}"><option value="">${t("select_grade")}</option>${GRADES.map((g) => `<option value="${g}">${t("grade")} ${g}</option>`).join("")}</select></div>
      <div class="tiny" data-f="diff"></div>
      <div class="tiny muted" data-f="amt"></div>
    </div>`;
  }).join("");
}

/* Live "less / more / same" + line amount + grand total inside the serve modal. */
function wireServeModal(root) {
  const box = root.querySelector(".modal") || root;
  const refresh = () => {
    let total = 0;
    box.querySelectorAll("[data-serve-row]").forEach((row) => {
      const declared = Number(row.dataset.declared) || 0;
      const f = (name) => row.querySelector(`[data-f="${name}"]`);
      const wRaw = f("weight").value.trim().replace(",", ".");
      const notBrought = wRaw === "" || /^0+(\.0{1,2})?$/.test(wRaw);
      const w = notBrought ? 0 : parsePositive2dp(wRaw, MAX_QTY_QUINTAL);
      const r = parsePositive2dp(f("rate").value, MAX_RATE_PER_QUINTAL);
      const diffEl = f("diff"), amtEl = f("amt");
      amtEl.textContent = "";
      if (notBrought) { diffEl.textContent = t("serve_not_brought"); return; }
      if (w == null) { diffEl.textContent = t("err_invalid_input"); return; }
      const diff = roundMoney(w - declared);
      diffEl.textContent = diff === 0 ? t("diff_same") : (diff < 0 ? t("diff_less") : t("diff_more")).replace("{n}", String(Math.abs(diff)));
      if (r != null) { const a = roundMoney(w * r); total += a; amtEl.textContent = `${t("serve_line_amount")}: ${fmtINR(a)}`; }
    });
    const tt = box.querySelector("#serve-total");
    if (tt) tt.textContent = `${t("total")}: ${fmtINR(roundMoney(total))}`;
  };
  box.addEventListener("input", refresh);
  refresh();
}

/* Turns the modal's raw strings into validated purchase lines.
   acceptedCrops === null skips the accepted-crops check (modal-time only;
   the submit path always passes the center's freshly-read list). */
function normalizeServeLines(raw, declaredMap, acceptedCrops) {
  const lines = [];
  for (const r of raw || []) {
    if (!declaredMap || typeof r.crop !== "string" || r.crop.includes("/")
        || !Object.prototype.hasOwnProperty.call(declaredMap, r.crop) || typeof declaredMap[r.crop] !== "number") {
      return { error: "ks/invalid-input" };
    }
    const wRaw = String(r.weightStr == null ? "" : r.weightStr).trim().replace(",", ".");
    if (wRaw === "" || /^0+(\.0{1,2})?$/.test(wRaw)) continue;          // crop not brought -> skipped
    const weight = parsePositive2dp(wRaw, MAX_QTY_QUINTAL);
    const rate = parsePositive2dp(r.rateStr, MAX_RATE_PER_QUINTAL);
    if (weight == null || rate == null) return { error: "ks/invalid-input" };
    if (!GRADES.includes(r.grade)) return { error: "ks/invalid-grade" };
    if (Array.isArray(acceptedCrops) && !acceptedCrops.includes(r.crop)) return { error: "ks/crop-not-accepted" };
    lines.push({ crop: r.crop, weight, rate, grade: r.grade, declared: declaredMap[r.crop], amount: roundMoney(weight * rate) });
  }
  if (!lines.length) return { error: "ks/no-lines" };
  if (lines.length > MAX_CROPS_PER_TOKEN) return { error: "ks/invalid-input" };
  return { lines };
}

function centerMarkServed(tokenId, tokenData) {
  const declared = tokenData && tokenData.declaredCrops;
  if (!tokenData || typeof tokenData.bookingId !== "string" || !declared || typeof declared !== "object" || !Object.keys(declared).length) {
    showToast(t("serve_err_legacy"));      // token created before crop details existed
    return;
  }
  const entries = Object.entries(declared).slice(0, MAX_CROPS_PER_TOKEN);
  openModal({
    title: t("mark_served"),
    body: `<p class="tiny muted">${esc(tokenData.farmerName || "")}</p>
      <div style="max-height:60vh;overflow:auto">${serveRowsHtml(entries)}</div>
      <div class="row gap-s"><b id="serve-total"></b></div>
      <div id="modal-error" class="alert danger" role="alert" style="display:none"></div>`,
    confirmText: t("confirm"),
    onOpen: wireServeModal,
    getData: (root) => Array.from(root.querySelectorAll("[data-serve-row]")).map((row) => ({
      crop: row.dataset.serveRow,
      weightStr: row.querySelector('[data-f="weight"]').value,
      rateStr: row.querySelector('[data-f="rate"]').value,
      grade: row.querySelector('[data-f="grade"]').value,
    })),
    validate: (raw) => {
      const r = normalizeServeLines(raw, Object.fromEntries(entries), null);
      return r.error ? t(SERVE_ERR_KEYS[r.error] || "err_unknown") : "";
    },
    onConfirm: (raw) => centerServeToken(tokenId, raw),
  });
}

/* Maps a failed serve/no-show to a REAL category. permission-denied is ambiguous
   (rules deny both "not yours" and "no longer waiting"), so we re-read the token
   (a center can only read its own) to tell "already processed" apart. */
async function classifyCenterOpError(e, tokenId) {
  const code = String((e && e.code) || "");
  if (code === "unauthenticated") return "session_expired";
  if (code === "deadline-exceeded") return "err_network_slow";
  if (code === "unavailable" || code === "network-request-failed") return "network_error";
  if (SERVE_ERR_KEYS[code]) return SERVE_ERR_KEYS[code];
  if (code === "ks/legacy-token") return "serve_err_legacy";
  if (["permission-denied", "failed-precondition", "aborted", "already-exists", "not-found", "ks/not-waiting", "ks/token-missing"].includes(code)) {
    try {
      const s = await getDoc(doc(db, "tokens", tokenId));
      if (!s.exists()) return "err_invalid_state";
      const st = s.data().status;
      if (st === "done" || st === "noshow") return "err_already_processed";
      if (st !== "waiting") return "err_invalid_state";
      return code === "permission-denied" ? "err_permission" : "err_invalid_state";
    } catch (e2) {
      return code === "permission-denied" || (e2 && e2.code === "permission-denied") ? "err_permission" : "err_invalid_state";
    }
  }
  return "err_unknown";
}

async function centerServeToken(tokenId, rawLines) {
  const op = "centerMarkServed";
  if (store._opBusy.has(tokenId)) return;               // ignore double-clicks
  store._opBusy.add(tokenId);
  showToast(t("loading"));
  try {
    const cu = auth.currentUser;
    if (!cu) throw ksError("unauthenticated", "no signed-in user");
    if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");

    // 1. Who is calling — re-read our own profile; never trust UI/store values.
    const uSnap = await fsRead(doc(db, "users", cu.uid));
    const u = uSnap.exists() ? uSnap.data() : null;
    if (!u || u.role !== "center" || u.status !== "active" || typeof u.centerId !== "string") {
      throw ksError("permission-denied", "caller is not an active center");
    }
    const centerId = u.centerId;

    // 2. The token — fresh, and it must be this center's and still waiting.
    const tSnap = await fsRead(doc(db, "tokens", tokenId));
    if (!tSnap.exists()) throw ksError("ks/token-missing", "token does not exist");
    const tok = tSnap.data();
    if (tok.centerId !== centerId) throw ksError("permission-denied", "token belongs to another center");
    if (tok.status !== "waiting") throw ksError("ks/not-waiting", "token status is " + tok.status);
    // farmerId comes from the TOKEN. (tokenId == farmerId in this data model.)
    if (typeof tok.bookingId !== "string" || typeof tok.farmerId !== "string" || typeof tok.farmerName !== "string"
        || tok.farmerId !== tokenId || !tok.declaredCrops || typeof tok.declaredCrops !== "object") {
      throw ksError("ks/legacy-token", "token has no booking details");
    }

    // 3. centerName / acceptedCrops come from the center document.
    const cSnap = await fsRead(doc(db, "centers", centerId));
    const center = cSnap.exists() ? cSnap.data() : null;
    if (!center || center.govStatus !== "active") throw ksError("permission-denied", "center is not active");
    if (typeof center.centerName !== "string" || !Array.isArray(center.acceptedCrops)) throw ksError("ks/bad-center", "center document is malformed");

    // 4. Validate the typed lines; amount = weight x rate is computed HERE, and re-checked by the rules.
    const norm = normalizeServeLines(rawLines, tok.declaredCrops, center.acceptedCrops);
    if (norm.error) throw ksError(norm.error, "invalid serve input");
    const lines = norm.lines;

    // 5. ONE atomic batch: purchases + notification + token -> done.
    const batch = writeBatch(db);
    lines.forEach((l) => {
      batch.set(doc(db, "purchases", `${tokenId}_${tok.bookingId}_${l.crop}`), {
        farmerId: tok.farmerId,
        farmerName: tok.farmerName,
        centerId,
        centerName: center.centerName,
        tokenId,
        bookingId: tok.bookingId,
        crop: l.crop,
        quantity: l.weight,
        declaredQuantity: l.declared,
        rate: l.rate,
        grade: l.grade,
        amount: l.amount,
        paymentStatus: "pending",
        purchaseDate: serverTimestamp(),
      });
    });
    batch.set(doc(db, "notifications", `${tokenId}_${tok.bookingId}`), {
      userId: tok.farmerId,
      type: "token_served",
      centerId,
      centerName: center.centerName,
      bookingId: tok.bookingId,
      primaryCrop: lines[0].crop,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "tokens", tokenId), { status: "done", updatedAt: serverTimestamp() });
    await withTimeout(batch.commit(), OP_TIMEOUT_MS);
    showToast(t("saved"));
  } catch (e) {
    // TEMP DIAGNOSTIC — remove once verified end-to-end.
    console.error(`[${op}] TEMP diagnostic — error.code:`, e && e.code, "| error.message:", e && e.message);
    showToast(t(await classifyCenterOpError(e, tokenId)));
  } finally {
    store._opBusy.delete(tokenId);
  }
}

async function centerMarkNoShow(tokenId) {
  const op = "centerMarkNoShow";
  if (store._opBusy.has(tokenId)) return;
  store._opBusy.add(tokenId);
  try {
    if (!auth.currentUser) throw ksError("unauthenticated", "no signed-in user");
    if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");
    // Rules allow exactly this write from a center: own-center token, currently
    // "waiting", changing only status -> "noshow" and updatedAt.
    await withTimeout(updateDoc(doc(db, "tokens", tokenId), { status: "noshow", updatedAt: serverTimestamp() }), OP_TIMEOUT_MS);
    showToast(t("saved"));
  } catch (e) {
    // TEMP DIAGNOSTIC — remove once verified end-to-end.
    console.error(`[${op}] TEMP diagnostic — error.code:`, e && e.code, "| error.message:", e && e.message);
    showToast(t(await classifyCenterOpError(e, tokenId)));
  } finally {
    store._opBusy.delete(tokenId);
  }
}

/* ---- Center: Add Local Purchase — a manual purchase entry not tied to a
   token/queue booking (e.g. a farmer who walks in without booking).
   Writes to its own `localPurchases` collection (kept separate from the
   token-linked `purchases` collection so none of the existing queue/token
   rules or flows are touched). The center has no farmer-directory read
   access (by design — see firestore.rules), so the farmer's name here is
   plain text the center operator types in, not a linked farmer record. */
async function openAddLocalPurchase() {
  let center;
  try {
    const snap = await fsRead(doc(db, "centers", store.profile.centerId));
    center = snap.exists() ? snap.data() : null;
  } catch (_) { showToast(t("network_error")); return; }
  if (!center) { showToast(t("err_unknown")); return; }
  const accepted = Array.isArray(center.acceptedCrops) ? center.acceptedCrops.filter((c) => typeof c === "string" && c) : [];
  const cropOptions = accepted.map((code) => `<option value="${esc(code)}">${esc(cropName(code))}</option>`).join("");
  let linkedFarmer = null; // { id, name, mobile } once a real farmer is found by mobile
  openModal({
    title: t("add_local_purchase"),
    body: `
      <div class="field"><label for="lp-mobile">${t("lp_search_mobile")}</label>
        <input id="lp-mobile" name="lookupMobile" inputmode="numeric" maxlength="10"><p class="tiny muted">${t("lp_search_hint")}</p></div>
      <p class="tiny" id="lp-link-status"></p>
      <div class="field"><label for="lp-farmer">${t("lp_farmer")}</label><input id="lp-farmer" name="farmerName" required></div>
      <div class="field"><label for="lp-crop">${t("crop")}</label>
        <select id="lp-crop" name="crop" required ${accepted.length ? "" : "disabled"}>
          <option value="">${t("lp_select_crop")}</option>${cropOptions}
        </select>
        ${accepted.length ? "" : `<p class="tiny muted">${t("bk_err_no_accepted")}</p>`}
      </div>
      <div class="grid-2">
        <div class="field"><label for="lp-qty">${t("quantity")} (${t("quintal_short")})</label><input id="lp-qty" name="quantity" inputmode="decimal" required></div>
        <div class="field"><label for="lp-rate">${t("rate_per_quintal")}</label><input id="lp-rate" name="rate" inputmode="decimal" required></div>
      </div>
      <div class="row gap-s"><span>${t("total")}</span><span class="spacer"></span><b id="lp-amount">${fmtINR(0)}</b></div>
      <div id="modal-error" class="alert danger" role="alert" style="display:none"></div>`,
    confirmText: t("save"), cancelText: t("cancel"),
    onOpen: (root) => {
      const box = root.querySelector(".modal") || root;
      const recompute = () => {
        const q = parsePositive2dp(box.querySelector("#lp-qty").value, MAX_QTY_QUINTAL);
        const r = parsePositive2dp(box.querySelector("#lp-rate").value, MAX_RATE_PER_QUINTAL);
        box.querySelector("#lp-amount").textContent = fmtINR(roundMoney((q || 0) * (r || 0)));
      };
      box.addEventListener("input", recompute);
      let lookupTimer = null;
      const mobileInput = box.querySelector("#lp-mobile");
      const statusEl = box.querySelector("#lp-link-status");
      const nameInput = box.querySelector("#lp-farmer");
      mobileInput.addEventListener("input", () => {
        linkedFarmer = null;
        statusEl.textContent = "";
        nameInput.readOnly = false;
        clearTimeout(lookupTimer);
        const mobile = mobileInput.value.trim();
        if (!/^[6-9]\d{9}$/.test(mobile)) return;
        lookupTimer = setTimeout(async () => {
          try {
            // Single-result query, exact mobile match — a narrow lookup the
            // rules permit for a center (request.query.limit <= 1), never a
            // browsable farmer directory.
            const q1 = query(collection(db, "farmers"), where("mobile", "==", mobile), limit(1));
            const qs = await withTimeout(getDocs(q1), OP_TIMEOUT_MS);
            if (!qs.empty) {
              const fd = qs.docs[0];
              linkedFarmer = { id: fd.id, name: fd.data().name, mobile: fd.data().mobile };
              nameInput.value = fd.data().name || "";
              nameInput.readOnly = true;
              statusEl.textContent = t("lp_farmer_linked");
              statusEl.className = "tiny";
            } else {
              statusEl.textContent = t("lp_farmer_not_found");
              statusEl.className = "tiny muted";
            }
          } catch (_) { /* lookup is best-effort; manual name entry still works */ }
        }, 400);
      });
    },
    getData: (root) => ({
      farmerName: root.querySelector("#lp-farmer").value.trim(),
      crop: root.querySelector("#lp-crop").value,
      quantity: parsePositive2dp(root.querySelector("#lp-qty").value, MAX_QTY_QUINTAL),
      rate: parsePositive2dp(root.querySelector("#lp-rate").value, MAX_RATE_PER_QUINTAL),
    }),
    validate: (d) => {
      if (!d.farmerName) return t("field_required");
      if (!accepted.length) return t("bk_err_no_accepted");
      if (!d.crop || !accepted.includes(d.crop)) return t("bk_err_crop_gone");
      if (d.quantity == null || d.rate == null) return t("err_invalid_input");
      return null;
    },
    onConfirm: async (d) => {
      try {
        if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");
        const amount = roundMoney(d.quantity * d.rate);
        const ref = doc(collection(db, "localPurchases"));
        await withTimeout(setDoc(ref, {
          ...(linkedFarmer ? { farmerId: linkedFarmer.id, farmerMobile: linkedFarmer.mobile } : {}),
          farmerName: d.farmerName,
          centerId: store.profile.centerId,
          centerName: center.centerName,
          crop: d.crop,
          quantity: d.quantity,
          rate: d.rate,
          amount,
          paymentStatus: "pending",
          purchaseDate: serverTimestamp(),
          createdAt: serverTimestamp(),
        }), OP_TIMEOUT_MS);
        showToast(t("saved"));
      } catch (e) {
        console.error("[openAddLocalPurchase] error.code:", e && e.code, "| message:", e && e.message);
        showToast(t(simpleErrorKey(e)));
      }
    },
  });
}

function subscribeCenterCapacity() {
  store._unsub.center = onSnapshot(doc(db, "centers", store.profile.centerId), (snap) => {
    const c = snap.exists() ? snap.data() : {};
    store.profile.centerName = c.centerName || store.profile.centerName;
    const govActive = c.govStatus === "active";
    paint("center-capacity", `<div class="grid-2">
      <div class="card"><div class="row gap-s"><span>${t("gov_capacity_label")}</span><span class="spacer"></span>
        <b>${c.capacity != null ? `${c.capacity} ${t("quintal_per_day")}` : "—"}</b></div>
        <div class="tiny muted mt-1">${store.lang === "hi" ? "यह केवल शासन द्वारा तय की जाती है।" : "Set by Government only — the center cannot change this."}</div></div>
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
    paint("center-notif", `<div class="card">${qs.docs.map((d) => {
      const n = d.data();
      return `<div class="history-item" style="flex-direction:column;align-items:stretch"><span>${esc(n.text || "")}</span><span class="tiny muted">${fmtDateTime(n.createdAt)}</span></div>`;
    }).join("")}</div>`);
  }, () => paint("center-notif", emptyState("bell", t("no_notifications"), t("no_notifications_desc"))));
}

function paymentStatusBadge(status) {
  const map = { open: ["red", "status_open"], acknowledged: ["gold", "status_acknowledged"], under_review: ["gold", "status_under_review"], resolved: ["green", "status_resolved"] };
  const [cls, key] = map[status] || ["muted", "status_open"];
  return `<span class="badge ${cls}">${t(key)}</span>`;
}

/* Center's real-time payment-issue inbox: onSnapshot() on paymentRequests
   for this center's own centerId only (rules pin centerId==this center —
   a center can never see another center's requests). Every payment
   issue a farmer raises is visible to BOTH its center and Government
   (requestedTo is fixed to 'both'; see firestore.rules), so this list is
   not filtered by routing. No orderBy in the query itself — sorting is
   done client-side below so this never depends on a composite index
   being created in the Firebase console. */
function subscribeCenterPayments() {
  const q1 = query(collection(db, "paymentRequests"), where("centerId", "==", store.profile.centerId), limit(30));
  store._unsub.centerPayments = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("center-payments", emptyState("alert", t("no_payment_requests"), "")); return; }
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    paint("center-payments", `<div class="card">${rows.map((r) => {
      return `<div class="history-item" style="flex-direction:column;align-items:stretch">
        <div class="row gap-s"><b>${esc(r.farmerName)}</b><span class="tiny muted">${esc(r.farmerMobile)}</span><span class="spacer"></span>${paymentStatusBadge(r.status)}</div>
        <div class="tiny muted">${t("issue_type")}: ${t("issue_" + r.issueType)} · ${esc(cropName(r.crop))} · ${esc(r.quantity)} ${t("quintal_short")} · ${fmtINR(r.amount)}</div>
        ${r.description ? `<div class="tiny">${esc(r.description)}</div>` : ""}
        <div class="tiny muted">${fmtDateTime(r.createdAt)}</div>
        <div class="row gap-s mt-1">
          <button class="btn ghost" data-pay-status="${r.id}" data-status="acknowledged" ${r.status !== "open" ? "disabled" : ""}>${t("acknowledge")}</button>
          <button class="btn ghost" data-pay-status="${r.id}" data-status="under_review" ${r.status === "resolved" ? "disabled" : ""}>${t("under_review_action")}</button>
          <button class="btn" data-pay-status="${r.id}" data-status="resolved" ${r.status === "resolved" ? "disabled" : ""}>${t("resolve")}</button>
        </div>
      </div>`;
    }).join("")}</div>`);
    document.querySelectorAll("[data-pay-status]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await updateDoc(doc(db, "paymentRequests", b.dataset.payStatus), { status: b.dataset.status }); showToast(t("saved")); }
      catch (_) { showToast(t("network_error")); b.disabled = false; }
    }));
  }, () => paint("center-payments", emptyState("alert", t("no_payment_requests"), "")));
}

/* ------------------------------------------------------------------
   Pending Payment (Center): real purchases (purchases/{id}) tied to
   THIS center whose paymentStatus is still 'pending' — the token was
   served, the purchase document exists, but the farmer hasn't been
   paid yet. "Mark Payment" moves it to 'processing' (awaiting the
   farmer's own confirmation, shown in real time in their Purchase
   History via subscribeFarmerHistory's onSnapshot — no Cloud Function
   / notification write needed for that). Never a fake/manual record:
   this only ever lists real purchases already created when a token
   was served (see centerServeToken) or a local purchase was added.
------------------------------------------------------------------ */
function subscribeCenterPending() {
  let tokenRows = null, localRows = null;
  const render = () => {
    if (tokenRows === null || localRows === null) return; // wait for both first snapshots
    const rows = [...tokenRows, ...localRows].sort((a, b) => (b.purchaseDate?.toMillis?.() || 0) - (a.purchaseDate?.toMillis?.() || 0));
    if (!rows.length) { paint("center-pending", emptyState("ticket", t("no_pending_payments"), t("pending_payment_desc"))); return; }
    paint("center-pending", `<div class="card">${rows.map((p) => `<div class="history-item"><div>
          <div class="row gap-s"><b>${esc(p.farmerName)}</b><span class="tiny muted">${fmtDateTime(p.purchaseDate)}</span>${p._source === "local" ? `<span class="badge muted">${t("add_local_purchase")}</span>` : ""}</div>
          <div class="tiny muted">${esc(cropName(p.crop))} · ${esc(p.quantity)} ${t("quintal_short")} · ${t("rate_per_quintal")}: ${fmtINR(p.rate)}${p.tokenId ? ` · ${t("token_id_label")}: ${esc(p.tokenId)}` : ""}</div>
          <div class="tiny muted">${t("expected_amount")}: ${fmtINR(p.amount)}</div>
          <button class="btn gold tiny mt-1" data-mark-payment="${p._source}:${p.id}">${t("mark_payment")}</button>
        </div>
        <div class="amount"><span class="badge muted">${t("pending")}</span></div>
      </div>`).join("")}</div>`);
    document.querySelectorAll("[data-mark-payment]").forEach((b) => b.addEventListener("click", () => {
      const [source, id] = b.dataset.markPayment.split(":");
      const list = source === "local" ? localRows : tokenRows;
      openMarkPaymentModal(list.find((p) => p.id === id), source);
    }));
  };
  // No orderBy here on purpose: centerId + paymentStatus is already two
  // equality filters, and adding orderBy(purchaseDate) on top of that
  // would require a manual composite index to be created in the Firebase
  // console before this query would ever return anything — sorting is
  // instead done client-side above so the list works immediately.
  const q1 = query(collection(db, "purchases"),
    where("centerId", "==", store.profile.centerId), where("paymentStatus", "==", "pending"), limit(50));
  store._unsub.centerPending = onSnapshot(q1,
    (qs) => { tokenRows = qs.docs.map((d) => ({ id: d.id, _source: "token", ...d.data() })); render(); },
    (err) => { console.error("[subscribeCenterPending/purchases] error.code:", err && err.code, "| message:", err && err.message); tokenRows = []; render(); });
  const q2 = query(collection(db, "localPurchases"),
    where("centerId", "==", store.profile.centerId), where("paymentStatus", "==", "pending"), limit(50));
  store._unsub.centerPendingLocal = onSnapshot(q2,
    (qs) => { localRows = qs.docs.map((d) => ({ id: d.id, _source: "local", ...d.data() })); render(); },
    (err) => { console.error("[subscribeCenterPending/localPurchases] error.code:", err && err.code, "| message:", err && err.message); localRows = []; render(); });
}

/* source == "token" -> purchases/{id}, moves pending -> processing and
   waits for the farmer's own confirmation (spec items 9/10, surfaced
   live in Farmer > Purchase history). source == "local" -> localPurchases/{id};
   a local/walk-in entry has no guaranteed linked farmer account to send a
   confirmation prompt to, so marking it paid there is final (pending -> paid). */
function openMarkPaymentModal(purchase, source) {
  if (!purchase) return;
  const collName = source === "local" ? "localPurchases" : "purchases";
  const nextStatus = source === "local" ? "paid" : "processing";
  openModal({
    title: t("mark_payment"),
    body: `<p class="tiny muted">${esc(purchase.farmerName)} · ${esc(cropName(purchase.crop))} · ${esc(purchase.quantity)} ${t("quintal_short")} · ${t("expected_amount")}: ${fmtINR(purchase.amount)}</p>
      <div class="field"><label for="mp-amount">${t("paid_amount_label")}</label><input id="mp-amount" inputmode="decimal" value="${purchase.amount}" placeholder="${t("enter_amount")}"></div>
      <div id="modal-error" class="alert danger" role="alert" style="display:none"></div>`,
    confirmText: t("mark_payment"), cancelText: t("cancel"),
    getData: (root) => ({ amount: parsePositive2dp(root.querySelector("#mp-amount").value, 10000000) }),
    validate: (d) => (d.amount == null ? t("err_invalid_input") : null),
    onConfirm: async (d) => {
      try {
        if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");
        await withTimeout(updateDoc(doc(db, collName, purchase.id), {
          paymentStatus: nextStatus, paidAmount: d.amount, paidAt: serverTimestamp(), paidBy: store.user.uid,
        }), OP_TIMEOUT_MS);
        showToast(t("payment_marked_confirmation").replace("{amount}", Number(d.amount).toLocaleString("en-IN")));
      } catch (e) {
        console.error("[openMarkPaymentModal] error.code:", e && e.code, "| message:", e && e.message);
        showToast(t(simpleErrorKey(e)));
      }
    },
  });
}

/* ------------------------------------------------------------------
   Government running announcement ticker — shown at the top of the
   Farmer and Center dashboards only (Government manages announcements
   directly on its own "Announcements" tab and doesn't need the public
   ticker repeated at the top of its own site). Driven by onSnapshot() on
   /announcements so it appears/disappears live with no refresh. Only
   'active' (and not-yet-expired) announcements show. No orderBy in the
   query — active==true is already one equality filter, and sorting is
   done client-side so this never depends on a composite index existing.
------------------------------------------------------------------ */
function tickerHtml(rows) {
  if (!rows.length) return "";
  const text = rows.map((a) => esc(a.message)).join("      •      ");
  return `<div class="ks-ticker" role="status"><div class="ks-ticker-track"><span>${text}</span><span aria-hidden="true">${text}</span></div></div>`;
}
function subscribeAnnouncementTicker() {
  const q1 = query(collection(db, "announcements"), where("active", "==", true), limit(5));
  store._unsub.ticker = onSnapshot(q1, (qs) => {
    const now = Date.now();
    const rows = qs.docs.map((d) => d.data())
      .filter((a) => !a.expiresAt || !a.expiresAt.toMillis || a.expiresAt.toMillis() > now)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const slot = document.getElementById("ks-ticker");
    if (slot) slot.innerHTML = tickerHtml(rows);
  }, (err) => {
    console.error("[subscribeAnnouncementTicker] error.code:", err && err.code, "| message:", err && err.message);
    const slot = document.getElementById("ks-ticker"); if (slot) slot.innerHTML = "";
  });
}

/* ============================== government views ============================== */
function govBody() {
  const tab = store.govTab;
  if (tab === "overview") return `<h2 class="section-title">${t("overview_title")}</h2><div id="gov-overview">${loadingBlock()}</div><div id="gov-today-collection" class="mt-2">${loadingBlock()}</div>`;
  if (tab === "centers") return `<h2 class="section-title">${t("nav_centers")}</h2><div id="gov-centers">${loadingBlock()}</div>`;
  if (tab === "farmers") return `<h2 class="section-title">${t("registered_farmers")}</h2><div id="gov-farmers">${loadingBlock()}</div>`;
  if (tab === "register") return govRegisterForm();
  if (tab === "announce") return `<div class="row gap-s"><h2 class="section-title" style="margin:0">${t("announcements_title")}</h2><span class="spacer"></span>
      <button class="btn gold" id="new-announcement">${ic("plus", 16)}${t("create_announcement")}</button></div>
    <div id="gov-announcements">${loadingBlock()}</div>`;
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
      ${locationShareHtml(d)}
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
    loadGovFarmerCount();
    loadGovTodayPurchaseCount();
  });
  subscribeGovTodayCollection();
}

/* Government "Today's Center Collection": real-time (onSnapshot) roll-up
   of today's actual /purchases records, grouped client-side by centerId —
   no fake/static numbers, no Cloud Function. district comes from a plain
   getDocs() read of /centers (Government has list access there), just to
   label each row; the totals themselves come only from real purchases. */
function subscribeGovTodayCollection() {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const q1 = query(collection(db, "purchases"), where("purchaseDate", ">=", Timestamp.fromDate(startOfDay)));
  const renderEmpty = () => paint("gov-today-collection", `<h3 class="section-title">${t("today_collection_title")}</h3>${emptyState("chart", t("no_collection_today"), "")}`);
  store._unsub.govTodayCollection = onSnapshot(q1, async (qs) => {
    if (qs.empty) { renderEmpty(); return; }
    const byCenter = new Map();
    qs.docs.forEach((docSnap) => {
      const p = docSnap.data();
      const key = p.centerId || "?";
      const entry = byCenter.get(key) || { centerId: key, centerName: p.centerName, qty: 0, count: 0, amount: 0 };
      entry.qty += Number(p.quantity) || 0;
      entry.count += 1;
      entry.amount += Number(p.amount) || 0;
      byCenter.set(key, entry);
    });
    let centersMeta = {};
    try {
      const csnap = await getDocs(collection(db, "centers"));
      csnap.docs.forEach((d) => { centersMeta[d.id] = d.data(); });
    } catch (_) { /* district column falls back to "—" below */ }
    const list = Array.from(byCenter.values()).sort((a, b) => b.amount - a.amount);
    paint("gov-today-collection", `<h3 class="section-title">${t("today_collection_title")}</h3>
      <div class="card table-wrap"><table><tr>
        <th>${t("col_center")}</th><th>${t("col_district")}</th><th>${t("col_today_qty")}</th><th>${t("col_today_purchases")}</th><th>${t("col_today_amount")}</th>
      </tr>${list.map((r) => `<tr>
        <td>${esc((centersMeta[r.centerId] && centersMeta[r.centerId].centerName) || r.centerName || r.centerId)}</td>
        <td>${esc((centersMeta[r.centerId] && centersMeta[r.centerId].district) || t("not_available"))}</td>
        <td>${r.qty.toFixed(2)} ${t("quintal_short")}</td>
        <td>${r.count}</td>
        <td>${fmtINR(r.amount)}</td>
      </tr>`).join("")}</table></div>`);
  }, renderEmpty);
}
/* Real counts via Firestore's count() aggregation (one aggregation read,
   no Cloud Function needed — works on the Spark plan). Firestore rules
   gate this: only an active Government caller may list/get `farmers` or
   `purchases`, so this never opens either collection up more broadly. */
async function loadGovFarmerCount() {
  const el = document.getElementById("kpi-farmers");
  if (!el) return;
  try {
    const snap = await getCountFromServer(collection(db, "farmers"));
    el.textContent = String(snap.data().count);
  } catch (e) {
    console.error("[loadGovFarmerCount] error.code:", e && e.code, "| message:", e && e.message);
    el.textContent = "—";
  }
}
async function loadGovTodayPurchaseCount() {
  const el = document.getElementById("kpi-purchases");
  if (!el) return;
  try {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const q1 = query(collection(db, "purchases"), where("purchaseDate", ">=", Timestamp.fromDate(startOfDay)));
    const snap = await getCountFromServer(q1);
    el.textContent = String(snap.data().count);
  } catch (e) {
    console.error("[loadGovTodayPurchaseCount] error.code:", e && e.code, "| message:", e && e.message);
    el.textContent = "—";
  }
}
function subscribeGovCenters() {
  store._unsub.govCentersTable = onSnapshot(collection(db, "centers"), (qs) => {
    if (qs.empty) { paint("gov-centers", emptyState("building", t("no_centers_found"), t("no_centers_desc"))); return; }
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    paint("gov-centers", `<div class="card table-wrap"><table><tr><th>${t("center_name")}</th><th>${t("district")}</th><th>${t("center_status")}</th><th>${t("counters")}</th><th></th></tr>
      ${rows.map((c) => { const active = c.govStatus === "active";
        return `<tr><td><b>${esc(c.centerName)}</b><div class="tiny muted">${esc(c.centerId || c.id)}</div></td><td>${esc(c.district || "—")}</td>
        <td><span class="badge ${active ? "green" : "red"}">${active ? t("gov_active") : t("gov_inactive")}</span><div class="tiny muted mt-1">${c.status === "open" ? t("open_now") : t("closed_now")}</div></td>
        <td>${c.counters ?? "—"}</td>
        <td><div class="table-actions">
          <button class="btn ghost" data-view-center="${c.id}">${t("view_details")}</button>
          <button class="btn ghost" data-toggle-center="${c.id}" data-gov-status="${active ? "active" : "inactive"}">${active ? t("deactivate") : t("activate")}</button>
        </div></td></tr>`;
      }).join("")}
    </table></div>`);
    document.querySelectorAll("[data-toggle-center]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await govToggleCenterStatus(b.dataset.toggleCenter, b.dataset.govStatus); }
      finally { b.disabled = false; }
    }));
    document.querySelectorAll("[data-view-center]").forEach((b) => b.addEventListener("click", () => {
      govViewCenterDetails(rows.find((c) => c.id === b.dataset.viewCenter));
    }));
  }, () => paint("gov-centers", emptyState("building", t("no_centers_found"), t("no_centers_desc"))));
}

/* Government's "View Details" modal for a center. Every field the center
   document may actually have; anything not present shows "Not Available"
   rather than being invented. Also lets Government change the
   Government-set capacity (firestore.rules: only Government may write
   this field; a Center can never change it). */
function govViewCenterDetails(c) {
  if (!c) return;
  const na = t("not_available");
  const date = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString(store.lang === "hi" ? "hi-IN" : "en-IN") : na;
  const crops = Array.isArray(c.acceptedCrops) && c.acceptedCrops.length ? c.acceptedCrops.map(cropName).join(", ") : na;
  const row = (label, val) => `<div class="col"><span class="tiny muted">${label}</span><span>${val != null && val !== "" ? esc(val) : na}</span></div>`;
  openModal({
    title: t("center_details_title"),
    body: `<div class="grid-2">
        ${row(t("center_name"), c.centerName)}
        ${row(t("center_id"), c.centerId || c.id)}
        ${row(t("contact_person"), c.adminName)}
        ${row(t("contact_number"), c.registeredMobile)}
        ${row(t("email"), c.email)}
        ${row(t("state"), c.state)}
        ${row(t("district"), c.district)}
        ${row(t("block_field"), c.block)}
        ${row(t("village_field"), c.village)}
        ${row(t("address_field"), c.address)}
        ${row(t("gov_capacity_label"), c.capacity != null ? `${c.capacity} ${t("quintal_per_day")}` : null)}
        ${row(t("current_status"), c.status === "open" ? t("open_now") : c.status === "closed" ? t("closed_now") : null)}
        ${row(t("government_status"), c.govStatus === "active" ? t("gov_active") : t("gov_inactive"))}
        ${row(t("queue_info"), c.queueLength != null ? `${c.queueLength} · ${c.counters ?? "—"} ${t("counters")}` : na)}
        ${row(t("registration_date"), date)}
      </div>
      <p class="tiny muted mt-2">${t("crops_accepted")}: ${esc(crops)}</p>
      <div class="field mt-2"><label for="gov-cap-edit">${t("edit_capacity")}</label>
        <div class="row gap-s"><input id="gov-cap-edit" inputmode="numeric" value="${c.capacity ?? ""}" style="max-width:140px">
          <button type="button" class="btn ghost" id="gov-cap-save">${t("save_capacity")}</button></div>
      </div>`,
    confirmText: t("close"), hideCancel: true, wide: true,
    onOpen: (root) => {
      const saveBtn = root.querySelector("#gov-cap-save");
      if (saveBtn) saveBtn.addEventListener("click", async () => {
        const val = Math.max(0, parseInt(root.querySelector("#gov-cap-edit").value, 10) || 0);
        saveBtn.disabled = true;
        try { await updateDoc(doc(db, "centers", c.id), { capacity: val }); showToast(t("capacity_updated")); }
        catch (_) { showToast(t("network_error")); }
        finally { saveBtn.disabled = false; }
      });
    },
    onConfirm: () => {},
  });
}

/* Government's real farmer directory — real-time, real Firestore data
   (firestore.rules: only an active Government caller may list `farmers`).
   Kept to the most recent 200 so the listener stays light; the count KPI
   on Overview uses getCountFromServer() separately for the true total. */
function subscribeGovFarmers() {
  const q1 = query(collection(db, "farmers"), orderBy("createdAt", "desc"), limit(200));
  store._unsub.govFarmers = onSnapshot(q1, (qs) => {
    if (qs.empty) { paint("gov-farmers", emptyState("users", t("no_farmers_found"), "")); return; }
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    paint("gov-farmers", `<div class="card table-wrap"><table><tr><th>${t("full_name")}</th><th>${t("mobile")}</th><th>${t("district")}</th><th></th></tr>
      ${rows.map((f) => `<tr><td><b>${esc(f.name)}</b><div class="tiny muted">${esc(f.username || "—")}</div></td>
        <td>${esc(f.mobile || "—")}</td><td>${esc(f.district || "—")}</td>
        <td><button class="btn ghost" data-view-farmer="${f.id}">${t("view_details")}</button></td></tr>`).join("")}
    </table></div>`);
    document.querySelectorAll("[data-view-farmer]").forEach((b) => b.addEventListener("click", () => {
      govViewFarmerDetails(rows.find((f) => f.id === b.dataset.viewFarmer));
    }));
  }, () => paint("gov-farmers", emptyState("users", t("no_farmers_found"), "")));
}

function govViewFarmerDetails(f) {
  if (!f) return;
  const na = t("not_available");
  const date = f.createdAt?.toDate ? f.createdAt.toDate().toLocaleDateString(store.lang === "hi" ? "hi-IN" : "en-IN") : na;
  const crops = Array.isArray(f.mainCrops) && f.mainCrops.length ? f.mainCrops.map(cropName).join(", ") : na;
  const row = (label, val) => `<div class="col"><span class="tiny muted">${label}</span><span>${val != null && val !== "" ? esc(val) : na}</span></div>`;
  openModal({
    title: t("farmer_details_title"),
    body: `<div class="grid-2">
        ${row(t("full_name"), f.name)}
        ${row(t("mobile"), f.mobile)}
        ${row(t("email"), f.email)}
        ${row(t("username"), f.username)}
        ${row(t("state"), f.state)}
        ${row(t("district"), f.district)}
        ${row(t("block_field"), f.block)}
        ${row(t("village_field"), f.village)}
        ${row(t("registration_date"), date)}
      </div>
      <p class="tiny muted mt-2">${t("main_crops")}: ${esc(crops)}</p>`,
    confirmText: t("close"), hideCancel: true, wide: true,
    onConfirm: () => {},
  });
}

/* Spark-compatible direct Firestore write (no Cloud Function — that call,
   govSetCenterStatus, is what produced a blanket "No internet connection"
   whenever the function wasn't reachable, regardless of the real cause).
   firestore.rules enforces: only an active Government caller may change
   govStatus/status here, deactivating always forces status to 'closed'
   (an inactive center can't be reopened by its own operator), and no
   other field on the center document can change through this action. */
async function govToggleCenterStatus(centerId, currentGovStatus) {
  const turningInactive = currentGovStatus === "active";
  try {
    if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");
    const patch = turningInactive ? { govStatus: "inactive", status: "closed" } : { govStatus: "active" };
    await withTimeout(updateDoc(doc(db, "centers", centerId), patch), OP_TIMEOUT_MS);
    showToast(t("saved"));
  } catch (e) {
    console.error("[govToggleCenterStatus] error.code:", e && e.code, "| message:", e && e.message);
    showToast(t(simpleErrorKey(e)));
  }
}

function subscribeGovAlerts() {
  let centerAlertsHtml = "";
  let paymentAlertsHtml = "";
  const render = () => {
    const combined = paymentAlertsHtml + centerAlertsHtml;
    paint("gov-alerts", combined || `<div class="card tiny muted">${t("no_alerts")}</div>`);
    document.querySelectorAll("[data-pay-status]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await updateDoc(doc(db, "paymentRequests", b.dataset.payStatus), { status: b.dataset.status }); showToast(t("saved")); }
      catch (_) { showToast(t("network_error")); b.disabled = false; }
    }));
  };
  store._unsub.govAlerts = onSnapshot(collection(db, "centers"), (qs) => {
    const alerts = [];
    qs.docs.forEach((d) => {
      const c = d.data();
      if (c.govStatus !== "active") alerts.push(["danger", `${c.centerName} ${store.lang === "hi" ? "सरकार द्वारा निष्क्रिय है।" : "is inactive by government status."}`]);
      if (c.govStatus === "active" && c.status !== "open") alerts.push(["warn", `${c.centerName} ${store.lang === "hi" ? "अभी बंद दर्ज है।" : "is currently marked closed."}`]);
      if ((c.counters || 0) < 1) alerts.push(["danger", `${c.centerName} ${store.lang === "hi" ? "में कोई सक्रिय काउंटर नहीं है।" : "has no active counters."}`]);
    });
    centerAlertsHtml = alerts.map(([k, txt]) => `<div class="alert ${k}">${ic(k === "danger" ? "alert" : "info")}<span>${txt}</span></div>`).join("");
    render();
  }, () => { centerAlertsHtml = ""; render(); });

  // Real-time payment-request alerts (onSnapshot — no polling). Government
  // sees every valid farmer request regardless of center (requestedTo is
  // always 'both' — see firestore.rules), and there's no orderBy here so
  // this never depends on a composite index existing in the console.
  const q1 = query(collection(db, "paymentRequests"), limit(30));
  store._unsub.govAlertsPayments = onSnapshot(q1, (qs) => {
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const openCount = rows.filter((r) => r.status === "open").length;
    paymentAlertsHtml = !rows.length ? "" : `<div class="card">
      <div class="row gap-s"><b>${t("nav_payments")}</b>${openCount ? `<span class="badge red">${openCount}</span>` : ""}</div>
      ${rows.map((r) => `<div class="history-item" style="flex-direction:column;align-items:stretch">
          <div class="row gap-s"><b>${esc(r.farmerName)}</b><span class="tiny muted">${esc(r.centerName)}</span><span class="spacer"></span>${paymentStatusBadge(r.status)}</div>
          <div class="tiny muted">${t("issue_type")}: ${t("issue_" + r.issueType)} · ${fmtINR(r.amount)}</div>
          ${r.description ? `<div class="tiny">${esc(r.description)}</div>` : ""}
          <div class="tiny muted">${fmtDateTime(r.createdAt)}</div>
          <div class="row gap-s mt-1">
            <button class="btn ghost" data-pay-status="${r.id}" data-status="acknowledged" ${r.status !== "open" ? "disabled" : ""}>${t("acknowledge")}</button>
            <button class="btn ghost" data-pay-status="${r.id}" data-status="under_review" ${r.status === "resolved" ? "disabled" : ""}>${t("under_review_action")}</button>
            <button class="btn" data-pay-status="${r.id}" data-status="resolved" ${r.status === "resolved" ? "disabled" : ""}>${t("resolve")}</button>
          </div>
        </div>`).join("")}
    </div>`;
    render();
  }, (err) => { console.error("[subscribeGovAlerts/paymentRequests] error.code:", err && err.code, "| message:", err && err.message); paymentAlertsHtml = ""; render(); });
}

/* ------------------------------------------------------------------
   Government-only announcement management (create / activate /
   deactivate). Firestore rules restrict create/update on this
   collection to an active Government caller only (see firestore.rules)
   — Farmer/Center only ever get read access to active announcements,
   enforced there too, never just in this UI.
------------------------------------------------------------------ */
function openCreateAnnouncementModal() {
  openModal({
    title: t("create_announcement"),
    body: `<div class="field"><label for="an-msg">${t("announcement_message")}</label><textarea id="an-msg" rows="3" maxlength="300"></textarea></div>
      <button type="button" class="btn ghost" id="an-quick-closed" style="margin:4px 0 10px">${t("all_centers_closed_today")}</button>
      <div class="field"><label for="an-expiry">${t("announcement_expiry")}</label><input id="an-expiry" type="datetime-local"></div>
      <div id="modal-error" class="alert danger" role="alert" style="display:none"></div>`,
    confirmText: t("publish_announcement"), cancelText: t("cancel"),
    onOpen: (root) => {
      const quick = root.querySelector("#an-quick-closed");
      if (quick) quick.addEventListener("click", () => {
        root.querySelector("#an-msg").value = store.lang === "hi"
          ? "⚠ सरकारी सूचना: आज सभी राशन केंद्र बंद रहेंगे।"
          : "⚠ Government Notice: All ration centers will remain closed today.";
      });
    },
    getData: (root) => ({
      message: root.querySelector("#an-msg").value.trim().slice(0, 300),
      expiry: root.querySelector("#an-expiry").value,
    }),
    validate: (d) => (!d.message ? t("field_required") : null),
    onConfirm: async (d) => {
      try {
        if (navigator.onLine === false) throw ksError("unavailable", "browser reports offline");
        await withTimeout(setDoc(doc(collection(db, "announcements")), {
          message: d.message, active: true, createdBy: store.user.uid, createdAt: serverTimestamp(),
          expiresAt: d.expiry ? Timestamp.fromDate(new Date(d.expiry)) : null,
        }), OP_TIMEOUT_MS);
        showToast(t("announcement_created"));
      } catch (e) {
        console.error("[openCreateAnnouncementModal] error.code:", e && e.code, "| message:", e && e.message);
        showToast(t(simpleErrorKey(e)));
      }
    },
  });
}
function wireGovAnnouncementButton() {
  const newBtn = document.getElementById("new-announcement");
  // Bug fix: previously this button was only ever wired from inside the
  // onSnapshot() SUCCESS callback below, so if that first read failed for
  // any reason (offline, a permission hiccup, a slow connection) the
  // button silently did nothing. It's now wired synchronously the moment
  // the "Announcements" tab renders, independent of the listener's state.
  if (newBtn) newBtn.onclick = openCreateAnnouncementModal;
}
function subscribeGovAnnouncements() {
  wireGovAnnouncementButton();
  const q1 = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));
  store._unsub.govAnnouncements = onSnapshot(q1, (qs) => {
    wireGovAnnouncementButton();
    if (qs.empty) { paint("gov-announcements", emptyState("bell", t("no_announcements"), "")); wireGovAnnouncementButton(); return; }
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    paint("gov-announcements", `<div class="card">${rows.map((a) => `<div class="history-item" style="flex-direction:column;align-items:stretch">
        <div class="row gap-s"><span>${esc(a.message)}</span><span class="spacer"></span><span class="badge ${a.active ? "green" : "muted"}">${a.active ? t("announcement_active") : t("announcement_inactive")}</span></div>
        <div class="tiny muted">${fmtDateTime(a.createdAt)}</div>
        <div class="row gap-s mt-1">
          <button class="btn ${a.active ? "ghost" : ""}" data-toggle-announcement="${a.id}" data-next="${a.active ? "false" : "true"}">${a.active ? t("deactivate_announcement") : t("activate")}</button>
        </div>
      </div>`).join("")}</div>`);
    wireGovAnnouncementButton();
    document.querySelectorAll("[data-toggle-announcement]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await updateDoc(doc(db, "announcements", b.dataset.toggleAnnouncement), { active: b.dataset.next === "true" }); showToast(t("saved")); }
      catch (_) { showToast(t("network_error")); b.disabled = false; }
    }));
  }, (err) => {
    console.error("[subscribeGovAnnouncements] error.code:", err && err.code, "| message:", err && err.message);
    paint("gov-announcements", emptyState("bell", t("no_announcements"), ""));
    wireGovAnnouncementButton();
  });
}

/* ============================== attach/detach live listeners on nav ============================== */
function attachRoleListeners() {
  const role = store.profile.role;
  // Ticker is public-notice UI for Farmer/Center only — Government
  // manages announcements directly on its own tab (spec item 12).
  if (role !== "gov") subscribeAnnouncementTicker();
  else { const slot = document.getElementById("ks-ticker"); if (slot) slot.innerHTML = ""; }
  if (role === "farmer") {
    if (store.farmerTab === "home") subscribeFarmerHome();
    if (store.farmerTab === "token") subscribeFarmerToken();
    if (store.farmerTab === "history") subscribeFarmerHistory();
    if (store.farmerTab === "notif") subscribeFarmerNotif();
    if (store.farmerTab === "help") wireFaq();
    if (store.farmerTab === "settings") wireFarmerSettings();
  } else if (role === "center") {
    if (store.centerTab === "queue") subscribeCenterQueue();
    if (store.centerTab === "pending") subscribeCenterPending();
    if (store.centerTab === "capacity") subscribeCenterCapacity();
    if (store.centerTab === "payments") subscribeCenterPayments();
    if (store.centerTab === "notif") subscribeCenterNotif();
    if (store.centerTab === "settings") wireCenterSettings();
  } else if (role === "gov") {
    if (store.govTab === "overview") subscribeGovOverview();
    if (store.govTab === "centers") subscribeGovCenters();
    if (store.govTab === "farmers") subscribeGovFarmers();
    if (store.govTab === "register") wireGovRegister();
    if (store.govTab === "announce") subscribeGovAnnouncements();
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
  wireLocationShareButton(store.centerRegisterData);
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
      batch.set(doc(db, "centers", centerId), {
        centerId, centerName: f.centerName.value.trim(), centerCode, registeredMobile: mobile,
        ...loc, address: f.address.value.trim() || null,
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

/* ============================== DEMO MODE ==============================
   A fully local, in-memory layer for SIH judges to explore the product.
   Hard isolation rules this whole section follows:
   - never reads or writes Firestore, never calls Firebase Auth, never
     calls a Cloud Function;
   - never touches store.user or store.profile (those stay reserved for a
     real authenticated session) — everything demo-related lives on
     store.demoActive / store.demoRole / store.demoTab and in DEMO_STATE;
   - the real login/signup/Google-login flow, and every real
     farmer/center/gov screen, is completely untouched by this section.
*/

const DEMO_DATA = {
  farmer: {
    name: "रामलाल यादव", mobile: "98765 43210",
    state: "उत्तर प्रदेश", district: "बरेली", block: "बहेड़ी", village: "मझगवां",
    landArea: "2.5 एकड़", crops: ["गेहूँ", "गन्ना", "सरसों"],
  },
  centers: [
    { id: "DEMO-C1", name: "बरेली मंडी केंद्र", district: "बरेली", distanceKm: 3.2, counters: 3, capacity: 400, estWait: 22, acceptedCrops: ["गेहूँ", "गन्ना"] },
    { id: "DEMO-C2", name: "नवाबगंज क्रय केंद्र", district: "बरेली", distanceKm: 7.8, counters: 2, capacity: 250, estWait: 40, acceptedCrops: ["गेहूँ", "सरसों"] },
    { id: "DEMO-C3", name: "फरीदपुर सहकारी केंद्र", district: "बरेली", distanceKm: 12.4, counters: 2, capacity: 200, estWait: null, acceptedCrops: ["गन्ना"] },
  ],
  purchases: [
    { crop: "गेहूँ", centerName: "बरेली मंडी केंद्र", quantity: "18 क्विंटल", amount: 39600, grade: "A", paymentStatus: "paid", dateLabel: "12 मार्च 2025" },
    { crop: "सरसों", centerName: "नवाबगंज क्रय केंद्र", quantity: "6 क्विंटल", amount: 33000, grade: "B", paymentStatus: "processing", dateLabel: "2 फ़रवरी 2025" },
  ],
  centerQueueFarmers: [
    { name: "सुरेश कुमार", crop: "गेहूँ" },
    { name: "मीना देवी", crop: "गन्ना" },
    { name: "अजय सिंह", crop: "सरसों" },
  ],
  govCenters: [
    { id: "DEMO-C1", name: "बरेली मंडी केंद्र", district: "बरेली", status: "open", govStatus: "active", counters: 3 },
    { id: "DEMO-C2", name: "नवाबगंज क्रय केंद्र", district: "बरेली", status: "open", govStatus: "active", counters: 2 },
    { id: "DEMO-C3", name: "फरीदपुर सहकारी केंद्र", district: "बरेली", status: "closed", govStatus: "active", counters: 2 },
    { id: "DEMO-C4", name: "मीरगंज क्रय केंद्र", district: "बरेली", status: "closed", govStatus: "inactive", counters: 1 },
  ],
  govAlerts: [
    "फरीदपुर सहकारी केंद्र पिछले 2 दिनों से बंद है।",
    "मीरगंज केंद्र निष्क्रिय है — सक्रिय करना बाकी है।",
  ],
};

function freshDemoState() {
  return {
    farmerToken: null,
    farmerNotifs: [],
    farmerPurchases: DEMO_DATA.purchases.map((p) => ({ ...p })),
    centerQueue: DEMO_DATA.centerQueueFarmers.map((f, i) => ({ ...f, id: "dq" + i, tokenNo: "48291" + i })),
    centerServedCount: 0,
    centerStatus: "open",
    centerNotifs: [],
    centerPurchases: [],
    govCenters: DEMO_DATA.govCenters.map((c) => ({ ...c })),
  };
}
let DEMO_STATE = freshDemoState();

function demoPushNotif(list, text) {
  list.unshift({ text, time: new Date() });
}

function enterDemo(role) {
  DEMO_STATE = freshDemoState();
  store.demoActive = true;
  store.demoRole = role;
  store.demoTab = role === "farmer" ? "home" : role === "center" ? "queue" : "overview";
  try { sessionStorage.setItem("ks_demo_role", role); } catch (_) {}
  paintScreen();
}
function exitDemo() {
  store.demoActive = false;
  store.demoRole = null;
  store.demoTab = null;
  DEMO_STATE = freshDemoState();
  try { sessionStorage.removeItem("ks_demo_role"); } catch (_) {}
  store.screen = "login";
  paintScreen();
}

function demoNavItems() {
  if (store.demoRole === "farmer") return [["home", "mapPin", t("nav_home")], ["token", "ticket", t("nav_token")], ["history", "history", t("nav_history")], ["notif", "bell", t("nav_notif")]];
  if (store.demoRole === "center") return [["queue", "users", t("nav_queue")], ["capacity", "settings", t("nav_capacity")], ["notif", "bell", t("nav_notif")]];
  return [["overview", "chart", t("nav_overview")], ["centers", "building", t("nav_centers")], ["register", "plus", t("nav_register")], ["alerts", "alert", t("nav_alerts")]];
}
function demoRoleLabel() {
  return store.demoRole === "farmer" ? t("role_farmer") : store.demoRole === "center" ? t("role_center") : t("role_gov");
}
function demoBodyHtml() {
  if (store.demoRole === "farmer") return demoFarmerBody();
  if (store.demoRole === "center") return demoCenterBody();
  return demoGovBody();
}
function demoShellHtml() {
  const items = demoNavItems();
  const active = store.demoTab;
  return `<div class="demo-banner" role="status">${ic("info", 15)}<span>${t("demo_mode_banner")}</span><button type="button" id="demo-exit-banner" class="link-btn">${t("exit_demo")}</button></div>
  <header class="topbar">
    <div class="brand-mark"><div class="glyph">${ic("sprout", 18)}</div>
      <div class="brand-name brand-face">${t("brand")}<small>${esc(demoRoleLabel())} · ${t("demo_mode")}</small></div></div>
    <nav class="top-tabs">${items.map(([k, icon, label]) => `<button data-demo-tab="${k}" aria-current="${active === k}">${ic(icon, 16)}${label}</button>`).join("")}</nav>
    <div class="spacer"></div>
    <div class="topbar-actions">
      ${langToggleHtml()}
      <button class="icon-btn" id="theme-toggle" aria-label="${t("toggle_theme")}">${ic(store.theme === "dark" ? "sun" : "moon", 17)}</button>
      <button class="btn ghost" id="demo-exit">${t("exit_demo")}</button>
    </div>
  </header>
  <nav class="role-tabs">${items.map(([k, icon, label]) => `<button data-demo-tab="${k}" aria-current="${active === k}">${ic(icon, 16)}${label}</button>`).join("")}</nav>
  <main id="main-content">${demoBodyHtml()}</main>
  <nav class="bottom-nav">${items.slice(0, 5).map(([k, icon, label]) => `<button data-demo-tab="${k}" aria-current="${active === k}">${ic(icon)}<span>${label}</span></button>`).join("")}</nav>`;
}
function wireDemoShell() {
  document.querySelectorAll("[data-demo-tab]").forEach((b) => b.addEventListener("click", () => { store.demoTab = b.dataset.demoTab; paintScreen(); }));
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", () => setTheme(store.theme === "dark" ? "light" : "dark"));
  const exit1 = document.getElementById("demo-exit"); if (exit1) exit1.addEventListener("click", exitDemo);
  const exit2 = document.getElementById("demo-exit-banner"); if (exit2) exit2.addEventListener("click", exitDemo);
  if (store.demoRole === "farmer") wireDemoFarmer();
  else if (store.demoRole === "center") wireDemoCenter();
  else wireDemoGov();
}

/* ---- Farmer demo ---- */
function demoFarmerBody() {
  const tab = store.demoTab;
  if (tab === "home") return demoFarmerHome();
  if (tab === "token") return demoFarmerToken();
  if (tab === "history") return demoFarmerHistory();
  if (tab === "notif") return demoFarmerNotif();
  return "";
}
function demoFarmerHome() {
  const f = DEMO_DATA.farmer;
  const centersHtml = DEMO_DATA.centers.map((c) => {
    const open = c.estWait != null;
    return `<div class="center-item">
      <div>
        <div class="name">${esc(c.name)}</div>
        <div class="meta-line">
          <span>${c.distanceKm} ${t("km_away")}</span>
          <span>${t("est_wait")}: ${open ? c.estWait + " min" : "—"}</span>
          <span class="badge ${open ? "green" : "red"}">${open ? t("open_now") : t("closed_now")}</span>
        </div>
      </div>
      <div class="actions"><button class="btn gold" data-demo-book="${c.id}" ${open ? "" : "disabled"}>${t("book_token")}</button></div>
    </div>`;
  }).join("");
  return `<h2 class="section-title">${t("demo_farmer_profile")}</h2>
    <div class="card">
      <div class="history-item"><span><b>${esc(f.name)}</b> · ${esc(f.mobile)}</span></div>
      <div class="history-item"><span>${esc(f.village)}, ${esc(f.block)}, ${esc(f.district)}, ${esc(f.state)}</span></div>
      <div class="history-item"><span>${t("demo_land")}: ${esc(f.landArea)} · ${t("demo_main_crops")}: ${esc(f.crops.join(", "))}</span></div>
    </div>
    <h2 class="section-title">${t("nearby_centers")}</h2>
    <div class="card">${centersHtml}</div>`;
}
function demoFarmerToken() {
  const tok = DEMO_STATE.farmerToken;
  if (!tok) return `<h2 class="section-title">${t("my_token")}</h2>${emptyState("ticket", t("no_active_token"), t("no_active_token_desc"))}`;
  const atFront = tok.queuePosition <= 1;
  return `<h2 class="section-title">${t("my_token")}</h2>
    <div class="token-card">
      <span class="status-pill badge gold">${t("token_status_waiting")}</span>
      <div class="token-num">#${tok.id.slice(-6).toUpperCase()}</div>
      <div class="token-meta">
        <div><div class="k">${t("center_id")}</div><div class="v">${esc(tok.centerName)}</div></div>
        <div><div class="k">${t("queue_position")}</div><div class="v">${tok.queuePosition}</div></div>
        <div><div class="k">${t("est_wait")}</div><div class="v">${tok.estWait != null ? tok.estWait + " min" : "—"}</div></div>
      </div>
      ${atFront ? `<p class="tiny" style="color:var(--accent-strong);font-weight:600">${t("demo_your_turn")}</p>` : ""}
    </div>
    <div class="row gap-s mt-2">
      ${atFront ? "" : `<button class="btn ghost" id="demo-advance-queue">${t("demo_advance_queue")}</button>`}
      <button class="btn ghost" id="demo-cancel-token">${t("cancel_token")}</button>
    </div>`;
}
function demoFarmerHistory() {
  const list = DEMO_STATE.farmerPurchases;
  if (!list.length) return `<h2 class="section-title">${t("purchase_history")}</h2>${emptyState("history", t("no_history"), t("no_history_desc"))}`;
  return `<h2 class="section-title">${t("purchase_history")}</h2>
    <div class="card">${list.map((p) => `<div class="history-item"><div>
        <div class="row gap-s"><b>${esc(p.crop)}</b><span class="tiny muted">${esc(p.dateLabel)}</span></div>
        <div class="tiny muted">${esc(p.centerName)} · ${esc(p.quantity)} · ${t("grade")}: ${esc(p.grade)}</div>
      </div>
      <div class="amount">${fmtINR(p.amount)}<div><span class="badge ${p.paymentStatus === "paid" ? "green" : "gold"}">${t(p.paymentStatus)}</span></div></div>
    </div>`).join("")}</div>`;
}
function demoFarmerNotif() {
  const list = DEMO_STATE.farmerNotifs;
  if (!list.length) return `<h2 class="section-title">${t("notifications")}</h2>${emptyState("bell", t("no_notifications"), t("no_notifications_desc"))}`;
  return `<h2 class="section-title">${t("notifications")}</h2>
    <div class="card">${list.map((n) => `<div class="history-item"><span>${esc(n.text)}</span></div>`).join("")}</div>`;
}
function wireDemoFarmer() {
  document.querySelectorAll("[data-demo-book]").forEach((b) => b.addEventListener("click", () => {
    if (DEMO_STATE.farmerToken) { showToast(t("demo_active_token_exists")); return; }
    const center = DEMO_DATA.centers.find((c) => c.id === b.dataset.demoBook);
    if (!center) return;
    DEMO_STATE.farmerToken = {
      id: "DT" + Date.now(), centerId: center.id, centerName: center.name,
      queuePosition: DEMO_STATE.centerQueue.length + 1, estWait: center.estWait,
    };
    demoPushNotif(DEMO_STATE.farmerNotifs, t("demo_notif_booked").replace("{center}", center.name));
    showToast(t("saved"));
    store.demoTab = "token";
    paintScreen();
  }));
  const advance = document.getElementById("demo-advance-queue");
  if (advance) advance.addEventListener("click", () => {
    if (DEMO_STATE.farmerToken && DEMO_STATE.farmerToken.queuePosition > 1) DEMO_STATE.farmerToken.queuePosition--;
    paintScreen();
  });
  const cancel = document.getElementById("demo-cancel-token");
  if (cancel) cancel.addEventListener("click", () => {
    const tok = DEMO_STATE.farmerToken;
    if (!tok) return;
    DEMO_STATE.farmerToken = null;
    demoPushNotif(DEMO_STATE.farmerNotifs, t("demo_notif_cancelled"));
    showToast(t("saved"));
    paintScreen();
  });
}

/* ---- Center demo ---- */
function demoCenterBody() {
  const tab = store.demoTab;
  if (tab === "queue") return demoCenterQueue();
  if (tab === "capacity") return demoCenterCapacity();
  if (tab === "notif") return demoCenterNotif();
  return "";
}
function demoCenterQueue() {
  const q = DEMO_STATE.centerQueue;
  if (!q.length) return `<h2 class="section-title">${t("queue_title")}</h2>${emptyState("users", t("no_queue"), t("no_queue_desc"))}`;
  return `<h2 class="section-title">${t("queue_title")}</h2>
    <div class="card">${q.map((tk, i) => `<div class="queue-row"><span class="pos">${i + 1}</span>
        <div class="col" style="flex:1"><b>${esc(tk.name)}</b><span class="tiny muted">#${tk.tokenNo}</span><span class="tiny muted">${esc(tk.crop)}</span></div>
        ${i === 0 ? `<button class="btn" data-demo-serve="${tk.id}">${t("mark_served")}</button><button class="btn ghost" data-demo-noshow="${tk.id}">${t("mark_noshow")}</button>` : ""}
      </div>`).join("")}</div>`;
}
function demoCenterCapacity() {
  const open = DEMO_STATE.centerStatus === "open";
  return `<h2 class="section-title">${t("center_status")}</h2>
    <div class="card">
      <div class="history-item"><span class="badge ${open ? "green" : "red"}">${open ? t("demo_center_open") : t("demo_center_closed")}</span></div>
      <div class="history-item"><span>${t("nav_capacity")}: 400 · ${t("num_counters")}: 3</span></div>
      <button class="btn ghost mt-1" id="demo-toggle-status">${t("demo_toggle_status")}</button>
    </div>
    <h2 class="section-title">${t("demo_add_purchase")}</h2>
    <div class="card">
      <div class="field"><label for="dp-crop">${t("demo_crop")}</label><input id="dp-crop" value="गेहूँ"></div>
      <div class="field"><label for="dp-weight">${t("demo_weight")}</label><input id="dp-weight" inputmode="decimal" value="10"></div>
      <div class="field"><label for="dp-rate">${t("demo_rate")}</label><input id="dp-rate" inputmode="numeric" value="2200"></div>
      <button class="btn" id="demo-add-purchase">${t("demo_add_purchase")}</button>
    </div>`;
}
function demoCenterNotif() {
  const list = DEMO_STATE.centerNotifs;
  if (!list.length) return `<h2 class="section-title">${t("notifications")}</h2>${emptyState("bell", t("no_notifications"), t("no_notifications_desc"))}`;
  return `<h2 class="section-title">${t("notifications")}</h2>
    <div class="card">${list.map((n) => `<div class="history-item"><span>${esc(n.text)}</span></div>`).join("")}</div>`;
}
function wireDemoCenter() {
  document.querySelectorAll("[data-demo-serve]").forEach((b) => b.addEventListener("click", () => {
    const tk = DEMO_STATE.centerQueue.find((x) => x.id === b.dataset.demoServe);
    if (!tk) return;
    DEMO_STATE.centerQueue = DEMO_STATE.centerQueue.filter((x) => x.id !== tk.id);
    DEMO_STATE.centerServedCount++;
    demoPushNotif(DEMO_STATE.centerNotifs, t("demo_notif_served").replace("{center}", esc(tk.name)));
    if (DEMO_STATE.farmerToken) { DEMO_STATE.farmerToken = null; }
    showToast(t("saved"));
    paintScreen();
  }));
  document.querySelectorAll("[data-demo-noshow]").forEach((b) => b.addEventListener("click", () => {
    const tk = DEMO_STATE.centerQueue.find((x) => x.id === b.dataset.demoNoshow);
    if (!tk) return;
    DEMO_STATE.centerQueue = DEMO_STATE.centerQueue.filter((x) => x.id !== tk.id);
    demoPushNotif(DEMO_STATE.centerNotifs, t("demo_notif_noshow").replace("{center}", esc(tk.name)));
    showToast(t("saved"));
    paintScreen();
  }));
  const toggle = document.getElementById("demo-toggle-status");
  if (toggle) toggle.addEventListener("click", () => {
    DEMO_STATE.centerStatus = DEMO_STATE.centerStatus === "open" ? "closed" : "open";
    paintScreen();
  });
  const addPurchase = document.getElementById("demo-add-purchase");
  if (addPurchase) addPurchase.addEventListener("click", () => {
    const crop = document.getElementById("dp-crop").value.trim() || "गेहूँ";
    const weight = Number(document.getElementById("dp-weight").value) || 0;
    const rate = Number(document.getElementById("dp-rate").value) || 0;
    const amount = weight * rate;
    DEMO_STATE.centerPurchases.unshift({ crop, weight, rate, amount });
    demoPushNotif(DEMO_STATE.centerNotifs, t("demo_notif_purchase").replace("{crop}", esc(crop)).replace("{amount}", amount.toLocaleString("en-IN")));
    showToast(t("saved"));
    paintScreen();
  });
}

/* ---- Government demo ---- */
function demoGovBody() {
  const tab = store.demoTab;
  if (tab === "overview") return demoGovOverview();
  if (tab === "centers") return demoGovCenters();
  if (tab === "register") return demoGovRegisterPreview();
  if (tab === "alerts") return demoGovAlerts();
  return "";
}
function demoGovOverview() {
  const centers = DEMO_STATE.govCenters;
  const open = centers.filter((c) => c.status === "open").length;
  return `<h2 class="section-title">${t("nav_overview")}</h2>
    <div class="kpi-grid">
      <div class="card kpi"><div class="kpi-label">${t("demo_gov_total_centers")}</div><div class="kpi-value">${centers.length}</div></div>
      <div class="card kpi"><div class="kpi-label">${t("demo_gov_open_centers")}</div><div class="kpi-value">${open}</div></div>
      <div class="card kpi"><div class="kpi-label">${t("demo_gov_total_farmers")}</div><div class="kpi-value">1,248</div></div>
      <div class="card kpi"><div class="kpi-label">${t("demo_gov_today_purchases")}</div><div class="kpi-value">37</div></div>
    </div>`;
}
function demoGovCenters() {
  const centers = DEMO_STATE.govCenters;
  return `<h2 class="section-title">${t("nav_centers")}</h2>
    <div class="card">${centers.map((c) => `<div class="history-item">
      <div><b>${esc(c.name)}</b><div class="tiny muted">${esc(c.district)} · ${t("num_counters")}: ${c.counters}</div></div>
      <div class="row gap-s">
        <span class="badge ${c.status === "open" ? "green" : "red"}">${c.status === "open" ? t("open_now") : t("closed_now")}</span>
        <span class="badge ${c.govStatus === "active" ? "green" : "muted"}">${c.govStatus === "active" ? t("gov_active") : t("gov_inactive")}</span>
        <button class="btn ghost tiny" data-demo-gov-toggle="${c.id}">${c.govStatus === "active" ? t("demo_deactivate") : t("demo_activate")}</button>
      </div>
    </div>`).join("")}</div>`;
}
function demoGovRegisterPreview() {
  return `<h2 class="section-title">${t("register_new_center")}</h2>
    <div class="card">
      <p><b>${t("demo_register_preview_title")}</b></p>
      <p class="tiny muted">${t("demo_register_preview_body")}</p>
    </div>`;
}
function demoGovAlerts() {
  const alerts = DEMO_DATA.govAlerts;
  return `<h2 class="section-title">${t("nav_alerts")}</h2>
    <div class="card">${alerts.map((a) => `<div class="alert warn" role="status">${ic("alert")}<span>${esc(a)}</span></div>`).join("")}</div>`;
}
function wireDemoGov() {
  document.querySelectorAll("[data-demo-gov-toggle]").forEach((b) => b.addEventListener("click", () => {
    const c = DEMO_STATE.govCenters.find((x) => x.id === b.dataset.demoGovToggle);
    if (!c) return;
    c.govStatus = c.govStatus === "active" ? "inactive" : "active";
    if (c.govStatus === "inactive") c.status = "closed";
    showToast(t("saved"));
    paintScreen();
  }));
}

/* ============================== screen dispatcher ============================== */
function screenHtml() {
  if (store.demoActive) return demoShellHtml();
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
  if (store.demoActive) { wireDemoShell(); return; }
  if (store.screen === "login") {
    newCaptcha();
    wireLoginForm();
    if (store.crossRoleLoginError) { store.crossRoleLoginError = false; showToast(t("login_error")); }
    document.querySelectorAll("[data-role-tab]").forEach((b) => b.addEventListener("click", () => { store.authTab = b.dataset.roleTab; paintScreen(); }));
    const about = document.getElementById("go-about"), help = document.getElementById("go-help");
    if (about) about.addEventListener("click", () => openModal({ title: t("about_title"), body: t("about_body"), confirmText: t("confirm") }));
    if (help) help.addEventListener("click", () => openModal({ title: t("help_title"), body: t("faq_book_a"), confirmText: t("confirm") }));
    const demoBtn = document.getElementById("go-demo"), demoPicker = document.getElementById("demo-picker");
    if (demoBtn && demoPicker) demoBtn.addEventListener("click", () => { demoPicker.hidden = !demoPicker.hidden; });
    document.querySelectorAll("[data-demo-role]").forEach((b) => b.addEventListener("click", () => enterDemo(b.dataset.demoRole)));
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
      wireLocationShareButton(store.signupData);
    }
    const back = document.getElementById("signup-back"); if (back) back.addEventListener("click", signupBack);
    const exit = document.getElementById("signup-exit"); if (exit) exit.addEventListener("click", () => { store.screen = "login"; paintScreen(); });
  } else if (store.screen === "forgot") {
    document.querySelectorAll("[data-reset-method]").forEach((b) => b.addEventListener("click", () => { store.forgotMethod = b.dataset.resetMethod; paintScreen(); }));
    document.querySelectorAll("[data-reset-role]").forEach((b) => b.addEventListener("click", () => { store.forgotRole = b.dataset.resetRole; paintScreen(); }));
    const form = document.getElementById("forgot-reset-form"); if (form) form.addEventListener("submit", forgotSubmit);
    const exit = document.getElementById("forgot-exit"); if (exit) exit.addEventListener("click", exitForgot);
    const done = document.getElementById("forgot-done"); if (done) done.addEventListener("click", exitForgot);
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
      wireLocationShareButton(store.googleData);
    }
    const back = document.getElementById("google-back"); if (back) back.addEventListener("click", googleCompleteBack);
  } else {
    wireShell();
  }
}
/* ============================== boot ============================== */
applyTheme();
document.documentElement.lang = store.lang === "hi" ? "hi" : "en";

// Restore Demo Mode across a refresh without ever touching Firebase: if
// the tab was in demo mode, re-enter it locally before anything else
// runs. onAuthStateChanged's own `if (store.demoActive) return;` guard
// (above) means whatever Firebase does after this is a no-op either way.
(function restoreDemoIfAny() {
  try {
    const savedRole = sessionStorage.getItem("ks_demo_role");
    if (savedRole && ["farmer", "center", "gov"].includes(savedRole)) enterDemo(savedRole);
  } catch (_) {}
})();
paintScreen();