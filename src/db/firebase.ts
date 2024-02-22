import dotenv from 'dotenv';
import {initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore/lite';
import {getStorage} from 'firebase/storage';
dotenv.config();

export const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);

export const storage = getStorage(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export default firestore;
