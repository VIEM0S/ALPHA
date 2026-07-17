import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/send';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

async function performDeletion(tenantId: string, uid: string) {
  try {
    await adminAuth.deleteUser(uid);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw e;
  }
  await adminDb.doc(`tenants/${tenantId}/users/${uid}`).delete();
}

async function notifyAdmin(tenantId: string, adminUid: string, title: string, message: string) {
  await adminDb.collection(`tenants/${tenantId}/alerts`).add({
    tenantId, type: 'USER_DELETION_RESOLVED', severity: 'MEDIUM',
    title, message, reference: 'users', referenceId: null,
    targetUserId: adminUid,
    isRead: false, isResolved: false, resolvedBy: null, resolvedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  const adminSnap = await adminDb.doc(`tenants/${tenantId}/users/${adminUid}`).get();
  const email = adminSnap.data()?.email as string | undefined;
  if (email) await sendEmail({ to: email, subject: title, html: `<p>${message}</p>` });
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.role !== 'OWNER') {
      return NextResponse.json({ error: 'Réservé au Propriétaire' }, { status: 403 });
    }
    const tenantId = decoded.tenantId as string;

    const { requestId, action, note } = await request.json();
    if (!requestId || !['approve', 'reject', 'delete_now'].includes(action)) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }

    const reqRef = adminDb.doc(`tenants/${tenantId}/user_deletion_requests/${requestId}`);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'PENDING') {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 400 });
    }

    const resolvedByName = decoded.name || decoded.email || decoded.uid;

    if (action === 'reject') {
      await reqRef.update({
        status: 'REJECTED', resolvedBy: decoded.uid, resolvedByName,
        resolvedAt: FieldValue.serverTimestamp(), resolutionNote: note || null,
      });
      await notifyAdmin(
        tenantId, reqData.requestedBy,
        'Demande de suppression refusée',
        `Le Propriétaire a refusé la suppression de ${reqData.targetUserName}.${note ? ` Note : "${note}"` : ''}`
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'approve') {
      await reqRef.update({
        status: 'APPROVED', resolvedBy: decoded.uid, resolvedByName,
        resolvedAt: FieldValue.serverTimestamp(), resolutionNote: note || null,
      });
      await notifyAdmin(
        tenantId, reqData.requestedBy,
        'Demande de suppression approuvée',
        `Le Propriétaire a approuvé la suppression de ${reqData.targetUserName}. Vous pouvez maintenant la finaliser depuis la fiche utilisateur.`
      );
      return NextResponse.json({ success: true });
    }

    // action === 'delete_now' : le Propriétaire traite directement, sans repasser par l'Admin
    await performDeletion(tenantId, reqData.targetUserId);
    await reqRef.update({
      status: 'COMPLETED', resolvedBy: decoded.uid, resolvedByName,
      resolvedAt: FieldValue.serverTimestamp(), resolutionNote: note || null,
    });
    await notifyAdmin(
      tenantId, reqData.requestedBy,
      'Suppression traitée directement par le Propriétaire',
      `Le Propriétaire a supprimé lui-même le compte de ${reqData.targetUserName}. Aucune action supplémentaire n'est nécessaire de votre part.`
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deletion request response error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
