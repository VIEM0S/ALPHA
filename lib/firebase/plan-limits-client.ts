import { collection, doc, getDoc, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/constants';

type LimitedResource = 'maxUsers' | 'maxStores' | 'maxProducts' | 'maxCustomers';

const RESOURCE_TO_COLLECTION: Record<LimitedResource, string> = {
  maxUsers: 'users',
  maxStores: 'stores',
  maxProducts: 'products',
  maxCustomers: 'customers',
};

/**
 * Équivalent client de lib/firebase/plan-limits.ts, pour les collections encore
 * créées directement depuis le navigateur (stores, products) plutôt que via une
 * route API. Donne un message d'erreur clair avant l'écriture Firestore.
 *
 * ⚠️ Ceci est une vérification UX, pas une frontière de sécurité : un utilisateur
 * technique peut toujours appeler Firestore directement en contournant l'UI. Les
 * règles Firestore actuelles n'imposent pas ces quotas. Pour une garantie réelle,
 * il faudra migrer ces créations vers des routes API (comme users/create) ou
 * ajouter un compteur dénormalisé vérifiable dans les règles Firestore.
 */
export async function checkPlanLimitClient(
  tenantId: string,
  resource: LimitedResource,
  count: number = 1
): Promise<{ allowed: true } | { allowed: false; reason: string; available: number }> {
  const subSnap = await getDoc(doc(db, `tenants/${tenantId}/subscriptions`, tenantId));
  const planId = subSnap.exists() ? (subSnap.data()?.plan as PlanId | undefined) : undefined;
  const plan = planId && planId in SUBSCRIPTION_PLANS ? SUBSCRIPTION_PLANS[planId] : SUBSCRIPTION_PLANS.BUSINESS;
  const max = plan.features[resource];

  if (max === -1) return { allowed: true };

  const collectionName = RESOURCE_TO_COLLECTION[resource];
  const countSnap = await getCountFromServer(collection(db, tenantCol(tenantId, collectionName)));
  const current = countSnap.data().count;
  const available = Math.max(0, max - current);

  if (current + count > max) {
    return {
      allowed: false,
      available,
      reason: available > 0
        ? `Le forfait ${plan.name} n'autorise que ${available} ${collectionName} de plus (${max} au total). Réduis ta sélection ou passe à un forfait supérieur.`
        : `Limite du forfait ${plan.name} déjà atteinte (${max} ${collectionName} max). Passe à un forfait supérieur pour continuer.`,
    };
  }
  return { allowed: true };
}
