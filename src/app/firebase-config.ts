// firebase-config.ts
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDpRqVdMO966X-e34c1KQJXRKlwzvzgV04",
  authDomain: "formulapet-com-br.firebaseapp.com",
  projectId: "formulapet-com-br",
  storageBucket: "formulapet-com-br.firebasestorage.app",
  messagingSenderId: "814626284746",
  appId: "1:814626284746:web:552698e044e1845f028033",
  measurementId: "G-5V2ZJ16LX6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

// Exporta a instância de auth
export const auth = getAuth(app);
export const db = getFirestore(app);
