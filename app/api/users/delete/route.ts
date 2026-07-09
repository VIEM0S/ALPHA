import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Vérifier session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const callerRole = decoded.role as string;
    const callerTenantId = decoded.tenantId as string;
    if (!['OWNER', 'ADMIN'].includes(callerRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { tenantId, uid } = await request.json();
    if (!tenantId || !uid) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    if (uid === decoded.uid) {
      return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
    }

    const userRef = adminDb.doc(`tenants/${tenantId}/users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }
    const existing = userSnap.data() as { role?: string };
    if (existing?.role === 'OWNER') {
      return NextResponse.json({ error: 'Impossible de supprimer le Propriétaire' }, { status: 403 });
    }

    // 1. Supprimer le compte Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      // Si le compte Auth n'existe déjà plus, on continue quand même le nettoyage Firestore
      if (code !== 'auth/user-not-found') throw e;
    }

    // 2. Supprimer le profil Firestore
    await userRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
