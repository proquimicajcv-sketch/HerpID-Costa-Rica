import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getPrivateKey() {
  const raw = requiredEnv('FIREBASE_PRIVATE_KEY');
  return raw.replace(/\\n/g, '\n');
}

export function getFirebaseAdmin() {
  if (!getApps().length) {
    const projectId = requiredEnv('FIREBASE_PROJECT_ID');
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

    initializeApp({
      credential: cert({
        projectId,
        clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
        privateKey: getPrivateKey()
      }),
      storageBucket
    });
  }

  return {
    adminAuth: getAuth(),
    adminDb: getFirestore(),
    adminStorage: getStorage()
  };
}
