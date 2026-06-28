'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Receipt,
  Users,
  Truck,
  CreditCard,
  FileText,
  DollarSign,
  FactoryIcon,
  Settings,
  Users2,
  Bell,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Store,
  LogOut,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/helpers';
import { useAuthStore, useUIStore } from '@/hooks/store';
import { useLogout } from '@/hooks/useAuth';
import { COMPANY_COLORS } from '@/lib/constants';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  badge?: number;
  children?: NavItem[];
  permission?: string;
}

const navItems: NavItem[] = [
  {
    title: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Ventes',
    icon: ShoppingCart,
    children: [
      { title: 'Point de vente', href: '/pos', icon: Receipt },
      { title: 'Historique', href: '/sales', icon: FileText },
      { title: 'Devis', href: '/quotes', icon: FileText },
    ],
  },
  {
    title: 'Produits',
    icon: Package,
    children: [
      { title: 'Catalogue', href: '/products', icon: Package },
      { title: 'Catégories', href: '/products/categories', icon: Package },
    ],
  },
  {
    title: 'Stock',
    icon: Warehouse,
    children: [
      { title: 'Inventaire', href: '/inventory', icon: Warehouse },
      { title: 'Mouvements', href: '/inventory/movements', icon: Warehouse },
      { title: 'Alertes', href: '/inventory/alerts', icon: Bell, badge: 0, badgeKey: 'lowStock' },
    ],
  },
  {
    title: 'Clients',
    href: '/customers',
    icon: Users,
  },
  {
    title: 'Crédits',
    href: '/credits',
    icon: CreditCard,
    badge: 0, badgeKey: 'overdueCredits',
  },
  {
    title: 'Fournisseurs',
    href: '/suppliers',
    icon: Truck,
  },
  {
    title: 'Caisse',
    href: '/cash-register',
    icon: DollarSign,
  },
  {
    title: 'Factures',
    href: '/invoices',
    icon: FileText,
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    title: 'Magasins',
    href: '/stores',
    icon: Store,
  },
  {
    title: 'Notifications',
    href: '/notifications',
    icon: Bell,
    badge: 0,
  },
];

const adminItems: NavItem[] = [
  {
    title: 'Utilisateurs',
    href: '/users',
    icon: Users2,
    permission: 'manage_users',
  },
  {
    title: 'Paramètres',
    href: '/settings',
    icon: Settings,
    permission: 'manage_settings',
  },
];

function NavItemComponent({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isActive = item.href === pathname || (item.children?.some((child) => child.href && pathname.startsWith(child.href)));

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            isActive
              ? 'bg-primary-500/10 text-primary-600'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.title}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
        {!collapsed && isOpen && (
          <div className="mt-1 ml-4 space-y-1">
            {item.children.filter((child) => child.href).map((child) => (
              <Link
                key={child.href}
                href={child.href!}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
                  pathname === child.href
                    ? 'bg-primary-500/10 text-primary-600'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <child.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{child.title}</span>
                {getBadge((child as NavItem & { badgeKey?: string }).badgeKey, child.badge) > 0 && (
                  <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {getBadge((child as NavItem & { badgeKey?: string }).badgeKey, child.badge)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!item.href) return null;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
        isActive
          ? 'bg-primary-500/10 text-primary-600'
          : 'text-gray-600 hover:bg-gray-100'
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.title}</span>
          {getBadge((item as NavItem & { badgeKey?: string }).badgeKey, item.badge) > 0 && (
            <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
              {getBadge((item as NavItem & { badgeKey?: string }).badgeKey, item.badge)}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { sidebarCollapsed } = useUIStore();
  const { user, tenant, currentStore } = useAuthStore();
  const handleLogout = useLogout();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  // Badges live Firestore
  useEffect(() => {
    const tenantId = tenant?.id;
    const storeId = currentStore?.id;
    if (!tenantId || !storeId) return;

    // Stock faible — écoute inventaire
    const unsubInv = onSnapshot(
      collection(db, tenantCol(tenantId, 'inventory')),
      async (invSnap) => {
        const prodSnap = await import('firebase/firestore').then(({ getDocs }) =>
          getDocs(collection(db, tenantCol(tenantId, 'products')))
        );
        const thresholds: Record<string, number> = {};
        prodSnap.docs.forEach(d => { thresholds[d.id] = d.data().alertThreshold || 10; });
        const low = invSnap.docs.filter(d => {
          const data = d.data();
          return data.storeId === storeId && (data.quantity || 0) <= (thresholds[data.productId] || 10);
        }).length;
        setLowStockCount(low);
      }
    );

    // Crédits en retard
    const unsubCred = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'credits')), where('status', '==', 'OVERDUE')),
      snap => setOverdueCount(snap.size)
    );

    return () => { unsubInv(); unsubCred(); };
  }, [tenant?.id, currentStore?.id]);

  // Injecter les badges dynamiques
  const getBadge = (badgeKey?: string, staticBadge?: number) => {
    if (badgeKey === 'lowStock') return lowStockCount;
    if (badgeKey === 'overdueCredits') return overdueCount;
    return staticBadge || 0;
  };

  const canShowAdminItems = user?.role && ['SUPER_ADMIN', 'OWNER'].includes(user.role);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="h-full flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Store className="h-5 w-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-bold text-gray-900">ProAlpha</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <NavItemComponent key={item.title} item={item} collapsed={sidebarCollapsed} />
          ))}

          {canShowAdminItems && (
            <>
              <div className="my-4 border-t border-gray-200 pt-4">
                {!sidebarCollapsed && (
                  <span className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Administration
                  </span>
                )}
              </div>
              {adminItems.map((item) => (
                <NavItemComponent key={item.title} item={item} collapsed={sidebarCollapsed} />
              ))}
            </>
          )}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-gray-200">
          {user && !sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-600">
                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : user && sidebarCollapsed ? (
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
              <span className="text-sm font-semibold text-primary-600">
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
