import { db } from "./firebase.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// ==============================
// PROFILE
// ==============================

export async function saveProfile(uid, profile) {
    await setDoc(
        doc(db, "users", uid),
        {
            profile: profile
        },
        { merge: true }
    );
}

export async function loadProfile(uid) {

    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) return null;

    return snapshot.data().profile;
}

// ==============================
// TASKS
// ==============================

export async function saveTasks(uid, tasks) {

    await setDoc(
        doc(db, "users", uid),
        {
            tasks: tasks
        },
        { merge: true }
    );
}

export async function loadTasks(uid) {

    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) return [];

    return snapshot.data().tasks || [];
}

// ==============================
// SCHEDULE
// ==============================

export async function saveSchedule(uid, schedule) {

    await setDoc(
        doc(db, "users", uid),
        {
            schedule: schedule
        },
        { merge: true }
    );
}

export async function loadSchedule(uid) {

    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) return [];

    return snapshot.data().schedule || [];
}

// ==============================
// STREAK
// ==============================

export async function saveStreak(uid, streak) {

    await setDoc(
        doc(db, "users", uid),
        {
            streak: streak
        },
        { merge: true }
    );
}

export async function loadStreak(uid) {

    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) return 0;

    return snapshot.data().streak || 0;
}

// ==============================
// UPDATE ANY FIELD
// ==============================

export async function updateUserData(uid, data) {

    await updateDoc(
        doc(db, "users", uid),
        data
    );
}

// ==============================
// LOAD COMPLETE USER DATA
// ==============================

export async function loadUserData(uid) {

    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) return null;

    return snapshot.data();
}