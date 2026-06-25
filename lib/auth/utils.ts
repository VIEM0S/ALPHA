import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { decrypt } from './crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const TOKEN_COOKIE = 'erp_session';
export const REFRESH_COOKIE = 'erp_refresh';
export const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  tenantSlug?: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(TOKEN_COOKIE);

  if (!sessionCookie) return null;

  try {
    const decrypted = await decrypt(sessionCookie.value);
    const session = JSON.parse(decrypted);

    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export function generateReference(prefix: string): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${year}-${timestamp}${random}`;
}

export function hasPermission(userRole: string, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    SUPER_ADMIN: ['all'],
    OWNER: [
      'view_purchase_price',
      'manage_users',
      'manage_settings',
      'view_reports',
      'manage_products',
      'manage_inventory',
      'process_sales',
      'manage_credits',
      'manage_suppliers',
      'manage_cash_register',
    ],
    MANAGER: [
      'view_reports',
      'manage_products',
      'manage_inventory',
      'process_sales',
      'manage_credits',
      'manage_suppliers',
      'manage_cash_register',
    ],
    CASHIER: ['process_sales', 'manage_cash_register'],
  };

  const rolePermissions = permissions[userRole] || [];
  return rolePermissions.includes('all') || rolePermissions.includes(permission);
}

export function canViewPurchasePrice(userRole: string): boolean {
  return userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
}

export function formatCurrency(amount: number, currency: string = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
