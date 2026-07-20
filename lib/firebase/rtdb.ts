/**
 * STRUCTURE REALTIME DATABASE — Yerkoy ERP
 * -------------------------------------------
 * RTDB = données qui changent fréquemment et nécessitent du temps réel
 *
 * /stock_live/{tenantId}/{productId}/{storeId}
 *   quantity: number
 *   updatedAt: number (timestamp ms)
 *
 * /notifications_live/{tenantId}/{userId}/{notifId}
 *   title: string
 *   message: string
 *   type: string
 *   isRead: boolean
 *   createdAt: number
 *
 * /cash_register_live/{tenantId}/{registerId}
 *   status: 'OPEN' | 'CLOSED'
 *   currentBalance: number
 *   openedBy: string (userId)
 *   openedAt: number
 *   transactionCount: number
 *   lastTransactionAt: number | null
 *
 * /alerts_live/{tenantId}/{alertId}
 *   type: string
 *   severity: string
 *   title: string
 *   message: string
 *   isRead: boolean
 *   createdAt: number
 *
 * /pos_sessions/{tenantId}/{storeId}/{userId}
 *   cartItemCount: number
 *   lastActivity: number
 *   status: 'active' | 'idle'
 *
 * Règles de sécurité RTDB :
 * - Lecture/écriture uniquement si auth.token.tenantId === tenantId (custom claim)
 * - SUPER_ADMIN accès total via auth.token.role === 'SUPER_ADMIN'
 */

// ─── Helpers de chemin RTDB ───────────────────────────────────────────────────

export const RTDB_PATHS = {
  /** Stock en temps réel d'un produit dans un magasin */
  stockItem: (tenantId: string, productId: string, storeId: string) =>
    `stock_live/${tenantId}/${productId}/${storeId}`,

  /** Tout le stock d'un tenant */
  stockTenant: (tenantId: string) =>
    `stock_live/${tenantId}`,

  /** Tout le stock d'un produit (tous magasins) */
  stockProduct: (tenantId: string, productId: string) =>
    `stock_live/${tenantId}/${productId}`,

  /** Notifications temps réel d'un utilisateur */
  userNotifications: (tenantId: string, userId: string) =>
    `notifications_live/${tenantId}/${userId}`,

  /** État d'une caisse en temps réel */
  cashRegister: (tenantId: string, registerId: string) =>
    `cash_register_live/${tenantId}/${registerId}`,

  /** Toutes les caisses d'un tenant */
  cashRegistersTenant: (tenantId: string) =>
    `cash_register_live/${tenantId}`,

  /** Alertes temps réel d'un tenant */
  alerts: (tenantId: string) =>
    `alerts_live/${tenantId}`,

  /** Session POS d'un utilisateur dans un magasin */
  posSession: (tenantId: string, storeId: string, userId: string) =>
    `pos_sessions/${tenantId}/${storeId}/${userId}`,
} as const;

// ─── Types RTDB ───────────────────────────────────────────────────────────────

export interface RtdbStockItem {
  quantity: number;
  updatedAt: number;
}

export interface RtdbNotification {
  title: string;
  message: string;
  type: string;
  reference?: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: number;
}

export interface RtdbCashRegister {
  status: 'OPEN' | 'CLOSED';
  currentBalance: number;
  openedBy: string;
  openedAt: number;
  transactionCount: number;
  lastTransactionAt: number | null;
}

export interface RtdbAlert {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  reference?: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: number;
}

export interface RtdbPosSession {
  cartItemCount: number;
  lastActivity: number;
  status: 'active' | 'idle';
}
