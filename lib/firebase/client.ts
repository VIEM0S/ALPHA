import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
};

// Singleton — évite la double initialisation en dev (hot-reload Next.js)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Fix : Firestore n'avait aucun cache local persistant configuré — une
// coupure réseau (fréquente en boutique) bloquait toute l'appli (plus de
// lecture ni écriture possible). `persistentLocalCache` garde les dernières
// données lues en IndexedDB et met en file les écritures pour les rejouer
// au retour du réseau. `initializeFirestore` doit être appelé une seule fois
// et avant tout autre usage de Firestore — donc uniquement côté navigateur.
// `persistentSingleTabManager` : un seul onglet gère le cache à la fois
// (suffisant pour une caisse, évite la complexité multi-onglets).
export const db = (() => {
  if (typeof window === 'undefined') return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    });
  } catch {
    // Déjà initialisé (ex: hot-reload Next.js en dev) — récupérer l'instance existante.
    return getFirestore(app);
  }
})();

export const rtdb = getDatabase(app);

export default app;
