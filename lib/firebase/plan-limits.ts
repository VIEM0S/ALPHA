import { adminDb } from '@/lib/firebase/admin';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/constants';

type LimitedResource = 'maxUsers' | 'maxStores' | 'maxProducts' | 'maxCustomers';

const RESOURCE_TO_COLLECTION: Record<LimitedResource, string> = {
  maxUsers: 'users',
  maxStores: 'stores',
  maxProducts: 'products',
  maxCustomers: 'customers',
};

/**
 * Vérifie qu'un tenant n'a pas dépassé la limite de son forfait pour une ressource donnée
 * avant d'en créer une nouvelle occurrence. -1 = illimité (Enterprise).
 *
 * Retourne { allowed: false, reason } si la limite est atteinte, sinon { allowed: true }.
 *
 * IMPORTANT : ce check ne protège que les créations qui passent par une route API
 * (Admin SDK). Les collections encore créées directement depuis le client (stores,
 * products) doivent AUSSI être protégées par un check équivalent côté client — voir
 * lib/firebase/plan-limits-client.ts — mais un check client seul reste contournable
 * par un utilisateur technique qui appelle Firestore directement. La protection
 * définitive nécessite de migrer ces créations vers des routes API, comme users/create.
 */
export async function checkPlanLimit(
  tenantId: string,
  resource: LimitedResource
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const subSnap = await adminDb
    .collection(`tenants/${tenantId}/subscriptions`)
    .doc(tenantId)
    .get();

  const planId = (subSnap.exists ? subSnap.data()?.plan : null) as PlanId | undefined;
  const plan = planId && planId in SUBSCRIPTION_PLANS ? SUBSCRIPTION_PLANS[planId] : SUBSCRIPTION_PLANS.BUSINESS;
  const max = plan.features[resource];

  if (max === -1) {
    return { allowed: true };
  }

  const collectionName = RESOURCE_TO_COLLECTION[resource];
  const countSnap = await adminDb
    .collection(`tenants/${tenantId}/${collectionName}`)
    .count()
    .get();
  const current = countSnap.data().count;

  if (current >= max) {
    return {
      allowed: false,
      reason: `Limite du forfait ${plan.name} atteinte (${max} ${collectionName} max). Passez à un forfait supérieur pour continuer.`,
    };
  }

  return { allowed: true };
}
