import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { writeAuditLog } from '@/lib/firebase/audit-log';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const tenantId = decoded.tenantId as string;

    const { requestId } = await request.json();
    if (!requestId) return NextResponse.json({ error: 'Champ manquant' }, { status: 400 });

    const reqRef = adminDb.doc(`tenants/${tenantId}/user_deletion_requests/${requestId}`);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    const reqData = reqSnap.data()!;

    // Fix (demande explicite) : seul l'Admin qui a fait la demande peut la
    // retirer lui-même — utile en cas de réconciliation avant même que le
    // Propriétaire n'ait eu le temps de répondre. Possible tant que ce n'est
    // pas déjà finalisé (le compte n'a pas encore été touché).
    if (reqData.requestedBy !== decoded.uid) {
      return NextResponse.json({ error: 'Cette demande ne vous appartient pas' }, { status: 403 });
    }
    if (!['PENDING', 'APPROVED'].includes(reqData.status)) {
      return NextResponse.json({ error: 'Cette demande n\'est plus dans un état permettant l\'annulation' }, { status: 400 });
    }

    await reqRef.update({
      status: 'REJECTED',
      resolvedBy: decoded.uid,
      resolvedByName: decoded.name || decoded.email || decoded.uid,
      resolvedAt: FieldValue.serverTimestamp(),
      resolutionNote: 'Retirée par l\'Admin demandeur.',
    });

    // Le Propriétaire est informé que la demande n'a plus lieu d'être suivie.
    await adminDb.collection(`tenants/${tenantId}/alerts`).add({
      tenantId, type: 'USER_DELETION_RESOLVED', severity: 'LOW',
      title: 'Demande de suppression retirée',
      message: `${decoded.name || decoded.email} a retiré sa demande concernant ${reqData.targetUserName}.`,
      reference: 'users', referenceId: reqData.targetUserId,
      targetRole: 'OWNER',
      isRead: false, isResolved: false, resolvedBy: null, resolvedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      tenantId, userId: decoded.uid, action: 'DELETION_REQUEST_REJECTED',
      entity: 'users', entityId: reqData.targetUserId,
      details: `${reqData.targetUserName} — retirée par le demandeur lui-même`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel deletion request error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
