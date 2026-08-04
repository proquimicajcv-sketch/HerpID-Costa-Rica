import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const ERROR_CONFIG_FIREBASE_ADMIN = 'La configuracion de Firebase Admin no esta completa en el servidor.';

function readEnv(name) {
  const value = process.env[name];
  if (!value) return '';
  return String(value).trim();
}

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

function resolveProjectId() {
  return readEnv('FIREBASE_PROJECT_ID') || readEnv('VITE_FIREBASE_PROJECT_ID');
}

function resolveStorageBucket(projectId) {
  return readEnv('FIREBASE_STORAGE_BUCKET') || readEnv('VITE_FIREBASE_STORAGE_BUCKET') || (projectId ? `${projectId}.firebasestorage.app` : '');
}

function hasExplicitServiceAccount() {
  return Boolean(readEnv('FIREBASE_CLIENT_EMAIL') && readEnv('FIREBASE_PRIVATE_KEY'));
}

function canUseApplicationDefaultCredentials() {
  return Boolean(
    readEnv('GOOGLE_APPLICATION_CREDENTIALS') ||
    readEnv('GOOGLE_CLOUD_PROJECT') ||
    readEnv('GCLOUD_PROJECT') ||
    readEnv('GCP_PROJECT') ||
    readEnv('K_SERVICE')
  );
}

function buildFirebaseAdminOptions() {
  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error('Missing environment variable: FIREBASE_PROJECT_ID');
  }

  const storageBucket = resolveStorageBucket(projectId);
  if (hasExplicitServiceAccount()) {
    return {
      credential: cert({
        projectId,
        clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
        privateKey: getPrivateKey()
      }),
      projectId,
      storageBucket
    };
  }

  if (canUseApplicationDefaultCredentials()) {
    return {
      credential: applicationDefault(),
      projectId,
      storageBucket
    };
  }

  throw new Error(ERROR_CONFIG_FIREBASE_ADMIN);
}

export function getFirebaseAdmin() {
  if (!getApps().length) {
    initializeApp(buildFirebaseAdminOptions());
  }

  return {
    adminAuth: getAuth(),
    adminDb: getFirestore(),
    adminStorage: getStorage()
  };
}
