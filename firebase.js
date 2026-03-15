import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getMessaging }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { getStorage }    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCn8TB2KdUoOB8ePfE9oLcic54ZkhSRfIM",
  authDomain:        "chit-f4d4e.firebaseapp.com",
  projectId:         "chit-f4d4e",
  storageBucket:     "chit-f4d4e.firebasestorage.app",
  messagingSenderId: "1090199679595",
  appId:             "1:1090199679595:web:8ea09750b5b40c8ec6b72e",
  measurementId:     "G-KCH3VD0JZG"
};

const app = initializeApp(firebaseConfig);
export const db        = getFirestore(app);
export const auth      = getAuth(app);
export const messaging = getMessaging(app);
export const storage   = getStorage(app);
