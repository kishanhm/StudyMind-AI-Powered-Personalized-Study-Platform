// ==============================
// Firebase App
// ==============================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";


// ==============================
// Firebase Authentication
// ==============================

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


// ==============================
// Firestore
// ==============================

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ==============================
// Firebase AI Logic
// ==============================

import {
    getAI,
    getGenerativeModel,
    GoogleAIBackend
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js";





import {
    initializeAppCheck,
    ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js";



// ==============================
// Firebase Configuration
// ==============================

const firebaseConfig = {

    apiKey: "AIzaSyALzNMJsFu4o7ud40113C8IJiqxH1-us5c",

    authDomain: "studymind-b34d2.firebaseapp.com",

    projectId: "studymind-b34d2",

    storageBucket: "studymind-b34d2.firebasestorage.app",

    messagingSenderId: "385458168224",

    appId: "1:385458168224:web:62df48f0bbf4f48ff284c5"

};


// ==============================
// Initialize Firebase
// ==============================

const app = initializeApp(firebaseConfig);


// ==============================
// Firebase App Check
// ==============================

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
        "YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY"
    ),
    isTokenAutoRefreshEnabled: true
});


// ==============================
// Firebase Services
// ==============================

export const auth = getAuth(app);

export const db = getFirestore(app);

// ==============================
// Firebase AI Logic
// ==============================

const ai = getAI(app, {
    backend: new GoogleAIBackend()
});


export const model = getGenerativeModel(ai, {
    model: "gemini-3.5-flash"
});


console.log("Firebase Connected");
console.log("Firebase AI Connected");