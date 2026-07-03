import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  // Sur Windows, les \n dans .env sont parfois littéraux — on les corrige
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY manquant dans .env');
  }
  // Supprimer les guillemets éventuels autour de la clé
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  // Remplacer les \n littéraux par de vrais sauts de ligne
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail) {
    throw new Error('Variables Firebase Admin manquantes dans .env');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });
}

let adminApp: App;
try {
  adminApp = getAdminApp();
} catch (e) {
  console.error('❌ Firebase Admin init error:', e);
  throw e;
}

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminRtdb = getDatabase(adminApp);

export default adminApp;
