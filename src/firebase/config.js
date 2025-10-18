import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase konfigürasyonunuzu buraya yapıştırın
// Firebase Console > Project Settings > General > Your apps > Web app
const firebaseConfig = {
  apiKey: "AIzaSyDjGP2aAUapJIghYHg4LTEirWDLnuK8wDo",
  authDomain: "proaecworks.firebaseapp.com",
  projectId: "proaecworks",
  storageBucket: "proaecworks.firebasestorage.app",
  messagingSenderId: "384882247977",
  appId: "1:384882247977:web:959e549b6bff7e95a10f38"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Servisleri export et
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Firebase app instance'ını export et
export default app;