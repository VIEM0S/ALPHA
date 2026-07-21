/**
 * STRUCTURE FIRESTORE — Kafora
 * ------------------------------------
 * Firestore = données métier persistantes (multi-tenant)
 *
 * tenants/{tenantId}
 *   subscriptions/{tenantId}          ← sous-collection (1-1)
 *   stores/{storeId}
 *   users/{userId}                    ← miroir de Firebase Auth (profil enrichi)
 *   categories/{categoryId}
 *   products/{productId}
 *   inventory/{productId_storeId}     ← clé composite pour unicité
 *   inventory_movements/{movementId}
 *   customers/{customerId}
 *   suppliers/{supplierId}
 *   sales/{saleId}
 *     sale_items/{itemId}             ← sous-collection
 *     payments/{paymentId}            ← sous-collection
 *   quotes/{quoteId}
 *     quote_items/{itemId}
 *   credits/{creditId}
 *     credit_payments/{paymentId}
 *   cash_registers/{registerId}
 *   cash_sessions/{sessionId}
 *   invoices/{invoiceId}
 *   alerts/{alertId}
 *   audit_logs/{logId}
 *   notifications/{notificationId}
 *
 * Collection racine :
 * _super_admin/config               ← config globale (SUPER_ADMIN uniquement)
 *
 * Notes :
 * - tenantId = UID du document tenant (auto-généré Firestore)
 * - userId Firestore = Firebase Auth UID (même ID, simplifie les règles)
 * - inventory clé = `${productId}_${storeId}` pour requête directe
 */

// ─── Helpers de chemin ────────────────────────────────────────────────────────

export const COLLECTIONS = {
  // Racine
  tenants: 'tenants',
  superAdmin: '_super_admin',

  // Sous-collections d'un tenant (appellées avec tenantPath())
  stores: 'stores',
  users: 'users',
  categories: 'categories',
  products: 'products',
  inventory: 'inventory',
  inventoryMovements: 'inventory_movements',
  customers: 'customers',
  suppliers: 'suppliers',
  sales: 'sales',
  saleItems: 'sale_items',
  salePayments: 'payments',
  quotes: 'quotes',
  quoteItems: 'quote_items',
  credits: 'credits',
  creditPayments: 'credit_payments',
  cashRegisters: 'cash_registers',
  cashSessions: 'cash_sessions',
  invoices: 'invoices',
  alerts: 'alerts',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  subscriptions: 'subscriptions',
  purchaseOrders: 'purchase_orders',
  saleReturns: 'sale_returns',
} as const;

/** Chemin vers une sous-collection d'un tenant */
export function tenantCol(tenantId: string, collection: string): string {
  return `tenants/${tenantId}/${collection}`;
}

/** Chemin vers une sous-collection d'une vente */
export function saleCol(tenantId: string, saleId: string, collection: string): string {
  return `tenants/${tenantId}/sales/${saleId}/${collection}`;
}

/** Chemin vers une sous-collection d'un crédit */
export function creditCol(tenantId: string, creditId: string, collection: string): string {
  return `tenants/${tenantId}/credits/${creditId}/${collection}`;
}

/** Clé composite pour l'inventaire */
export function inventoryKey(productId: string, storeId: string): string {
  return `${productId}_${storeId}`;
}
