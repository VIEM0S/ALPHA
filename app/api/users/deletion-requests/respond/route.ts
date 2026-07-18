import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/send';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

// Fix (demande explicite) : suppression réversible plutôt que définitive — voir
// le commentaire détaillé dans app/api/users/delete/route.ts. Même logique ici.
async function performSoftDelete(tenantId: string, uid: string, deletedBy: string) {
  await adminAuth.updateUser(uid, { disabled: true });
  try {
    await adminAuth.revokeRefreshTokens(uid);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw e;
  }
  await adminDb.doc(`tenants/${tenantId}/users/${uid}`).update({
    isActive: false,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
  });
}

async function notifyAdmin(tenantId: string, adminUid: string, title: string, message: string) {
  await adminDb.collection(`tenants/${tenantId}/alerts`).add({
    tenantId, type: 'USER_DELETION_RESOLVED', severity: 'MEDIUM',
    title, message, reference: 'users', referenceId: null,
    targetUserId: adminUid,
    isRead: false, isResolved: false, resolvedBy: null, resolvedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  try {
    const adminSnap = await adminDb.doc(`tenants/${tenantId}/users/${adminUid}`).get();
    const email = adminSnap.data()?.email as string | undefined;
    if (email) {
      const result = await sendEmail({ to: email, subject: title, html: `<p>${message}</p>` });
      if (!result.sent) console.error('Notification email non envoyée :', result.error);
    }
  } catch (e) {
    console.error('notifyAdmin: échec de l\'envoi email (notification in-app déjà créée) :', e);
  }
}

const VALID_ACTIONS = ['approve', 'reject', 'delete_now', 'revoke_approval'];

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
    if (!requestId || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }

    const reqRef = adminDb.doc(`tenants/${tenantId}/user_deletion_requests/${requestId}`);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    const reqData = reqSnap.data()!;

    // Fix (demande explicite) : une approbation peut être retirée tant que
    // l'Admin n'a pas encore finalisé — utile si une réconciliation a lieu
    // entre-temps. 'delete_now' reste possible aussi bien avant qu'après
    // approbation (le Propriétaire peut toujours trancher lui-même).
    const allowedFromStatus: Record<string, string[]> = {
      approve: ['PENDING'],
      reject: ['PENDING'],
      revoke_approval: ['APPROVED'],
      delete_now: ['PENDING', 'APPROVED'],
    };
    if (!allowedFromStatus[action].includes(reqData.status)) {
      return NextResponse.json({ error: 'Cette demande n\'est plus dans un état permettant cette action' }, { status: 400 });
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

    if (action === 'revoke_approval') {
      await reqRef.update({
        status: 'REJECTED', resolvedBy: decoded.uid, resolvedByName,
        resolvedAt: FieldValue.serverTimestamp(),
        resolutionNote: note || 'Approbation retirée avant finalisation.',
      });
      await notifyAdmin(
        tenantId, reqData.requestedBy,
        'Approbation retirée',
        `Le Propriétaire est revenu sur son approbation concernant ${reqData.targetUserName} — la suppression n'aura pas lieu.${note ? ` Note : "${note}"` : ''}`
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

    // action === 'delete_now' : le Propriétaire traite directement, sans (ou sans plus) attendre l'Admin
    await performSoftDelete(tenantId, reqData.targetUserId, decoded.uid);
    await reqRef.update({
      status: 'COMPLETED', resolvedBy: decoded.uid, resolvedByName,
      resolvedAt: FieldValue.serverTimestamp(), resolutionNote: note || null,
    });
    await notifyAdmin(
      tenantId, reqData.requestedBy,
      'Suppression traitée directement par le Propriétaire',
      `Le Propriétaire a désactivé lui-même le compte de ${reqData.targetUserName}. Aucune action supplémentaire n'est nécessaire de votre part.`
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deletion request response error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
