import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    // Restaurer un compte annule une décision de suppression déjà validée —
    // réservé au Propriétaire, cohérent avec le reste du workflow.
    if (decoded.role !== 'OWNER') {
      return NextResponse.json({ error: 'Réservé au Propriétaire' }, { status: 403 });
    }
    const tenantId = decoded.tenantId as string;

    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'Champ manquant' }, { status: 400 });

    const userRef = adminDb.doc(`tenants/${tenantId}/users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Compte introuvable (a peut-être été supprimé définitivement avant ce fix)' }, { status: 404 });
    }

    await adminAuth.updateUser(uid, { disabled: false });
    await userRef.update({
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      restoredAt: FieldValue.serverTimestamp(),
      restoredBy: decoded.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore user error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
