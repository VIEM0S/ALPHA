import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Rate-limiting simple par fenêtre glissante grossière, basé sur Firestore
// (pas de Redis disponible sur l'infra actuelle — largement suffisant pour
// le volume de trafic actuel sur des routes publiques sensibles comme
// /api/auth/login et /api/auth/forgot-password).
//
// Stocké dans une collection racine `_rate_limits`, hors de tout tenant
// (login/forgot-password sont appelés AVANT qu'un tenant ne soit connu).
// Cette collection n'a aucune règle Firestore dédiée : elle tombe donc sous
// le "allow read, write: if false" global, ce qui est voulu — seul l'Admin
// SDK (ce fichier) doit pouvoir y écrire.
//
// Fenêtre fixe (pas glissante au sens strict) : simple, suffisant pour
// bloquer un bruteforce basique sans dépendance supplémentaire.

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const ref = adminDb.collection('_rate_limits').doc(key);
  const nowMs = Date.now();

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : null;
    const windowStartMs = data?.windowStartMs as number | undefined;
    const isExpired = !windowStartMs || nowMs - windowStartMs > windowSeconds * 1000;

    if (isExpired) {
      tx.set(ref, {
        windowStartMs: nowMs,
        count: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
    }

    const currentCount = (data?.count as number) || 0;
    if (currentCount >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs! + windowSeconds * 1000 - nowMs) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    tx.update(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { allowed: true, remaining: maxAttempts - currentCount - 1, retryAfterSeconds: 0 };
  });

  return result;
}

// Extrait une IP raisonnable depuis les en-têtes standards (Netlify/proxy).
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
