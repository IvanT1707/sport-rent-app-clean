import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyANoBBSM3UAxMY0kFzSGAB_luJCXPeyXvE",
  authDomain: "sportrent-a81c9.firebaseapp.com",
  projectId: "sportrent-a81c9",
  storageBucket: "sportrent-a81c9.firebasestorage.app",
  messagingSenderId: "1084389173107",
  appId: "1:1084389173107:web:0b6247178e55e358c00706",
  measurementId: "G-XLHTRTQB3Y"
};

// Log Firebase config for debugging (remove in production)
console.log('Firebase Config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'undefined'
});

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);