'use client';

import { useState, useEffect } from 'react';
import {
  Bell, CheckCircle2, AlertTriangle, CreditCard,
  Package, ShoppingCart, RefreshCw, Check, Trash2, BellOff
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/store';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/lib/utils/helpers';
import {
  collection, query, orderBy, onSnapshot, where,
  doc, updateDoc, deleteDoc, limit, writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';

interface Notification {
  id: string;
  userId?: string;
  type: 'STOCK_LOW' | 'STOCK_RUPTURE' | 'CREDIT_OVERDUE' | 'CREDIT_DUE_SOON' | 'SALE' | 'SYSTEM';
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: unknown;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  STOCK_LOW:        { icon: Package,      color: 'text-amber-600', bg: 'bg-amber-100' },
  STOCK_RUPTURE:     { icon: AlertTriangle,color: 'text-red-600',   bg: 'bg-red-100' },
  CREDIT_OVERDUE:    { icon: CreditCard,   color: 'text-red-600',   bg: 'bg-red-100' },
  CREDIT_DUE_SOON:   { icon: CreditCard,   color: 'text-amber-600', bg: 'bg-amber-100' },
  SALE:              { icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100' },
  SYSTEM:            { icon: Bell,         color: 'text-blue-600',  bg: 'bg-blue-100' },
};

// Génère des notifications dérivées en temps réel (sans collection dédiée)
function useDerivedNotifications(tenantId: string | undefined, storeId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let products: Record<string, { name: string; alertThreshold: number; trackInventory: boolean }> = {};
    let inventory: { productId: string; storeId: string; quantity: number }[] = [];
    let credits: { id: string; customerName: string; solde: number; dateEcheance: string; status: string }[] = [];

    const buildNotifications = () => {
      const notifs: Notification[] = [];
      const now = Date.now();

      // Stock faible / rupture
      inventory.forEach(inv => {
        if (inv.storeId !== storeId) return;
        const p = products[inv.productId];
        if (!p || !p.trackInventory) return;
        if (inv.quantity === 0) {
          notifs.push({
            id: `stock-rupture-${inv.productId}`, type: 'STOCK_RUPTURE',
            title: 'Rupture de stock', message: `${p.name} est en rupture de stock`,
            isRead: false, link: '/inventory/alerts', createdAt: { seconds: now / 1000 },
          });
        } else if (inv.quantity <= p.alertThreshold) {
          notifs.push({
            id: `stock-low-${inv.productId}`, type: 'STOCK_LOW',
            title: 'Stock faible', message: `${p.name} : ${inv.quantity} restant(s)`,
            isRead: false, link: '/inventory/alerts', createdAt: { seconds: now / 1000 },
          });
        }
      });

      // Crédits en retard / échéance proche
      credits.forEach(c => {
        if (!['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(c.status)) return;
        const echeance = new Date(c.dateEcheance).getTime();
        const diff = echeance - now;
        if (diff < 0) {
          notifs.push({
            id: `credit-overdue-${c.id}`, type: 'CREDIT_OVERDUE',
            title: 'Crédit en retard', message: `${c.customerName} doit ${c.solde.toLocaleString()} FCFA`,
            isRead: false, link: '/credits', createdAt: { seconds: now / 1000 },
          });
        } else if (diff < 48 * 60 * 60 * 1000) {
          notifs.push({
            id: `credit-due-${c.id}`, type: 'CREDIT_DUE_SOON',
            title: 'Échéance proche', message: `${c.customerName} — échéance dans moins de 48h`,
            isRead: false, link: '/credits', createdAt: { seconds: now / 1000 },
          });
        }
      });

      setNotifications(notifs);
      setIsLoading(false);
    };

    const unsubP = onSnapshot(collection(db, tenantCol(tenantId, 'products')), snap => {
      products = {};
      snap.docs.forEach(d => {
        products[d.id] = {
          name: d.data().name,
          alertThreshold: d.data().alertThreshold || 10,
          trackInventory: d.data().trackInventory,
        };
      });
      buildNotifications();
    });

    const unsubI = onSnapshot(collection(db, tenantCol(tenantId, 'inventory')), snap => {
      inventory = snap.docs.map(d => ({
        productId: d.data().productId, storeId: d.data().storeId, quantity: d.data().quantity || 0,
      }));
      buildNotifications();
    });

    const unsubC = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'credits')),
        where('status', 'in', ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'])),
      snap => {
        credits = snap.docs.map(d => ({
          id: d.id, customerName: d.data().customerName,
          solde: d.data().solde, dateEcheance: d.data().dateEcheance, status: d.data().status,
        }));
        buildNotifications();
      }
    );

    return () => { unsubP(); unsubI(); unsubC(); };
  }, [tenantId, storeId]);

  return { notifications, isLoading };
}

export default function NotificationsPage() {
  const { tenant, currentStore } = useAuthStore();
  const router = useRouter();
  const tenantId = tenant?.id;
  const storeId = currentStore?.id;

  const { notifications, isLoading } = useDerivedNotifications(tenantId, storeId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = notifications.filter(n => !dismissed.has(n.id));

  const dismiss = (id: string) => setDismissed(prev => new Set(prev).add(id));
  const dismissAll = () => setDismissed(new Set(notifications.map(n => n.id)));

  const handleClick = (n: Notification) => {
    if (n.link) router.push(n.link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">
              {visible.length} notification{visible.length !== 1 ? 's' : ''} active{visible.length !== 1 ? 's' : ''}
            </p>
          </div>
          {visible.length > 0 && (
            <Button variant="outline" size="sm" onClick={dismissAll}>
              <Check className="h-4 w-4 mr-2" />Tout marquer comme lu
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
          </div>
        ) : visible.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
            <BellOff className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium text-gray-500">Aucune notification</p>
            <p className="text-sm mt-1">Vous êtes à jour ! Les alertes stock et crédits apparaîtront ici.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {visible.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.SYSTEM;
              const Icon = cfg.icon;
              return (
                <Card key={n.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => handleClick(n)}>
                        <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                      <button onClick={() => dismiss(n.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
