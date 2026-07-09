import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const callerRole = decoded.role as string;
    const callerTenantId = decoded.tenantId as string;
    if (!['OWNER', 'ADMIN'].includes(callerRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { tenantId, uid, isActive } = await request.json();
    if (!tenantId || !uid || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    if (uid === decoded.uid) {
      return NextResponse.json({ error: 'Impossible de modifier votre propre statut' }, { status: 400 });
    }

    const userRef = adminDb.doc(`tenants/${tenantId}/users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }
    const existing = userSnap.data() as { role?: string };
    if (existing?.role === 'OWNER') {
      return NextResponse.json({ error: 'Impossible de modifier le Propriétaire' }, { status: 403 });
    }

    await userRef.update({ isActive, updatedAt: new Date().toISOString() });

    // Coupure d'accès immédiate : si on désactive, on révoque les tokens
    // Firebase de la personne. Sans ça, elle garde un accès complet à
    // Firestore tant que sa session (jusqu'à 7 jours) n'a pas expiré.
    if (!isActive) {
      await adminAuth.revokeRefreshTokens(uid);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle user status error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
