import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export type AuditAction =
  | 'LOGIN'
  | 'ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'USER_RESTORED'
  | 'USER_PURGED'
  | 'SALE_CANCELLED'
  | 'DELETION_REQUEST_CREATED'
  | 'DELETION_REQUEST_APPROVED'
  | 'DELETION_REQUEST_REJECTED';

/**
 * Journal d'audit — trace qui a fait quoi sur les actions sensibles.
 * La collection `audit_logs` existait déjà dans le schéma (utilisée
 * uniquement pour LOGIN) ; ce helper l'étend aux actions qui comptent
 * vraiment pour un audit (rôles, suppressions, annulations de vente).
 */
export async function writeAuditLog(params: {
  tenantId: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  details?: string;
}) {
  try {
    await adminDb.collection(`tenants/${params.tenantId}/audit_logs`).add({
      userId: params.userId,
      userName: params.userName || null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // Un échec du journal d'audit ne doit jamais faire échouer l'action
    // métier elle-même — juste le signaler.
    console.error('writeAuditLog error:', e);
  }
}
