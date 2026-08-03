import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDOVsZuEHCGcx7KvUEOn9-lzO0NxioEe7M",
  authDomain: "herpid-costa-rica.firebaseapp.com",
  projectId: "herpid-costa-rica",
  storageBucket: "herpid-costa-rica.appspot.com",
  messagingSenderId: "716674443702",
  appId: "1:716674443702:web:ae5811103e2e096da57917",
  measurementId: "G-LMWJFG3KE1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);