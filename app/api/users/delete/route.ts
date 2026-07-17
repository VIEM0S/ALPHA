import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/send';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

async function notifyRole(
  tenantId: string,
  targetRole: 'OWNER' | 'ADMIN',
  alert: { type: string; severity: string; title: string; message: string; referenceId?: string }
) {
  // Notification in-app (visible sur /notifications, lue par tous les membres du rôle ciblé)
  await adminDb.collection(`tenants/${tenantId}/alerts`).add({
    tenantId, type: alert.type, severity: alert.severity,
    title: alert.title, message: alert.message,
    reference: 'users', referenceId: alert.referenceId || null,
    targetRole,
    isRead: false, isResolved: false, resolvedBy: null, resolvedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Notification email à tous les utilisateurs du rôle ciblé — best-effort :
  // une erreur ici (SendGrid non configuré, index Firestore manquant...) ne
  // doit jamais faire échouer la demande de suppression elle-même, puisque
  // la notification in-app ci-dessus a déjà réussi.
  try {
    const snap = await adminDb.collection(`tenants/${tenantId}/users`)
      .where('role', '==', targetRole).where('isActive', '==', true).get();
    const results = await Promise.all(snap.docs.map(d => {
      const email = d.data().email as string | undefined;
      if (!email) return Promise.resolve({ sent: false, error: 'Pas d\'email sur ce compte' });
      return sendEmail({ to: email, subject: alert.title, html: `<p>${alert.message}</p>` });
    }));
    results.forEach(r => { if (!r.sent) console.error('Notification email non envoyée :', r.error); });
  } catch (e) {
    console.error('notifyRole: échec de l\'envoi email (notification in-app déjà créée) :', e);
  }
}

async function performDeletion(tenantId: string, uid: string) {
  try {
    await adminAuth.deleteUser(uid);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw e;
  }
  await adminDb.doc(`tenants/${tenantId}/users/${uid}`).delete();
}

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

    const { tenantId, uid, reason, requestId } = await request.json();
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
    const existing = userSnap.data() as { role?: string; firstName?: string; lastName?: string };
    const targetRole = existing?.role;
    const targetName = `${existing?.firstName || ''} ${existing?.lastName || ''}`.trim() || uid;

    if (targetRole === 'OWNER') {
      return NextResponse.json({ error: 'Impossible de supprimer le Propriétaire' }, { status: 403 });
    }
    // Fix : un Admin pouvait auparavant supprimer un autre Admin sans aucun
    // contrôle — seul le Propriétaire peut retirer un Admin.
    if (targetRole === 'ADMIN' && callerRole !== 'OWNER') {
      return NextResponse.json({ error: 'Seul le Propriétaire peut supprimer un Administrateur' }, { status: 403 });
    }

    // ── Cas 1 : le Propriétaire supprime directement — pas de double
    // vérification pour lui (il est le payeur final, personne au-dessus).
    // Transparence : les Admins du tenant sont notifiés après coup.
    if (callerRole === 'OWNER') {
      await performDeletion(tenantId, uid);
      await notifyRole(tenantId, 'ADMIN', {
        type: 'USER_DELETION_RESOLVED', severity: 'MEDIUM',
        title: 'Suppression effectuée par le Propriétaire',
        message: `Le Propriétaire a supprimé le compte de ${targetName} (${targetRole}).`,
      });
      return NextResponse.json({ success: true });
    }

    // ── Cas 2 : un Admin veut supprimer un Manager/Caissier ────────────────
    // Fix (demande explicite) : double vérification obligatoire — un Admin ne
    // peut jamais supprimer seul un Manager/Caissier sans validation du Propriétaire.
    if (requestId) {
      // Finalisation d'une demande déjà approuvée par le Propriétaire.
      const reqRef = adminDb.doc(`tenants/${tenantId}/user_deletion_requests/${requestId}`);
      const reqSnap = await reqRef.get();
      if (!reqSnap.exists) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
      const reqData = reqSnap.data()!;
      if (reqData.requestedBy !== decoded.uid) {
        return NextResponse.json({ error: 'Cette demande ne vous appartient pas' }, { status: 403 });
      }
      if (reqData.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Cette demande n\'a pas encore été approuvée par le Propriétaire' }, { status: 400 });
      }
      await performDeletion(tenantId, uid);
      await reqRef.update({ status: 'COMPLETED', completedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true });
    }

    // Nouvelle demande de suppression — justification obligatoire.
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Merci de justifier cette suppression (au moins quelques mots).' }, { status: 400 });
    }
    const requestRef = adminDb.collection(`tenants/${tenantId}/user_deletion_requests`).doc();
    await requestRef.set({
      tenantId, targetUserId: uid, targetUserName: targetName, targetUserRole: targetRole,
      requestedBy: decoded.uid, requestedByName: decoded.name || decoded.email || decoded.uid,
      reason: reason.trim(),
      status: 'PENDING',
      createdAt: FieldValue.serverTimestamp(),
      resolvedBy: null, resolvedByName: null, resolvedAt: null, resolutionNote: null,
    });
    await notifyRole(tenantId, 'OWNER', {
      type: 'USER_DELETION_REQUEST', severity: 'HIGH',
      title: 'Demande de suppression en attente de votre validation',
      message: `Un administrateur souhaite supprimer le compte de ${targetName} (${targetRole}). Motif : "${reason.trim()}"`,
      referenceId: requestRef.id,
    });

    return NextResponse.json({ success: true, pending: true, requestId: requestRef.id });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
