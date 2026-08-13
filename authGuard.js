import { auth } from "./firebase.js";
import { loadProfile } from "./database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.replace("login.html");
        return;
    }

    console.log("Logged in:", user.email);

    const profile = await loadProfile(user.uid);

    if (profile) {
        console.log("Profile Loaded");
    }

});