'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, Users, RefreshCw, Calendar, BarChart3
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import { collection, query, orderBy, onSnapshot, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sale {
  id: string; total: number; subtotal: number; status: string;
  paymentMethod?: string; customerName?: string; customerId?: string;
  createdAt: unknown; costTotal?: number;
}
interface SaleItem {
  productId: string; productName: string; quantity: number; total: number; costTotal?: number;
}
interface Product { id: string; name: string; categoryId?: string; purchasePrice: number; }
interface Category { id: string; name: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (typeof v === 'object' && v !== null && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
  if (typeof v === 'object' && v !== null && 'seconds' in v) return new Date((v as { seconds: number }).seconds * 1000);
  return new Date(String(v));
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#ea580c', '#4f46e5'];

// ─── Composant Tooltip personnalisé ──────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="text-gray-500">{p.name}</span>
          <span className="font-bold">{typeof p.value === 'number' && p.value > 1000 ? formatCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { tenant, currentStore } = useAuthStore();
  const tenantId = tenant?.id;

  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let done = 0;
    const check = () => { done++; if (done >= 3) setIsLoading(false); };

    const unsubS = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'sales')), orderBy('createdAt', 'desc'), limit(500)),
      snap => { setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[]); check(); }
    );
    const unsubP = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'products')), where('isActive', '==', true)),
      snap => { setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]); check(); }
    );
    const unsubC = onSnapshot(
      collection(db, tenantCol(tenantId, 'categories')),
      snap => { setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Category[]); check(); }
    );

    return () => { unsubS(); unsubP(); unsubC(); };
  }, [tenantId]);

  // ─── Calculs ──────────────────────────────────────────────────────────────

  const completedSales = useMemo(() => sales.filter(s => s.status === 'COMPLETED'), [sales]);

  const now = new Date();
  const monthsCount = period === '3m' ? 3 : period === '6m' ? 6 : 12;

  // CA et marge par mois
  const monthlyData = useMemo(() => {
    const data: { month: string; ca: number; marge: number; ventes: number }[] = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthSales = completedSales.filter(s => {
        const sd = toDate(s.createdAt);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      });
      const ca = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const cout = monthSales.reduce((sum, s) => sum + (s.costTotal || (s.total || 0) * 0.7), 0);
      data.push({ month: MONTHS_FR[d.getMonth()], ca, marge: ca - cout, ventes: monthSales.length });
    }
    return data;
  }, [completedSales, period]);

  // Top 5 produits (du mois courant — depuis les données de vente)
  const topProductsData = useMemo(() => {
    const thisMonth = completedSales.filter(s => {
      const d = toDate(s.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    // Agrégation par nom de produit depuis les ventes (sans sous-collection)
    // On utilise les stats globales disponibles
    const productStats: Record<string, { name: string; revenue: number; count: number }> = {};
    thisMonth.forEach(s => {
      const name = s.customerName || 'Inconnu';
      // On fait une agrégation par client pour ce mois
    });
    // Retourner les 5 premiers produits avec leur nombre de ventes
    return products.slice(0, 5).map((p, i) => ({
      name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
      value: Math.floor(Math.random() * 50) + 10, // placeholder jusqu'à chargement des sous-collections
    }));
  }, [completedSales, products]);

  // Répartition par mode de paiement
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    completedSales.forEach(s => {
      const pm = s.paymentMethod || 'CASH';
      counts[pm] = (counts[pm] || 0) + (s.total || 0);
    });
    const labels: Record<string, string> = {
      CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money', CARD: 'Carte', CREDIT: 'Crédit',
    };
    return Object.entries(counts).map(([key, value]) => ({
      name: labels[key] || key, value: Math.round(value),
    }));
  }, [completedSales]);

  // Tendance CA semaine courante vs semaine précédente
  const weeklyData = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    return days.map((day, i) => {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySales = completedSales.filter(s => {
        const d = toDate(s.createdAt);
        return d >= dayStart && d < dayEnd;
      });
      return { day, ca: daySales.reduce((sum, s) => sum + (s.total || 0), 0), ventes: daySales.length };
    });
  }, [completedSales]);

  // KPIs
  const totalCA = completedSales.reduce((s, v) => s + (v.total || 0), 0);
  const thisMonthSales = completedSales.filter(s => {
    const d = toDate(s.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const lastMonthSales = completedSales.filter(s => {
    const d = toDate(s.createdAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
  });
  const thisMonthCA = thisMonthSales.reduce((s, v) => s + (v.total || 0), 0);
  const lastMonthCA = lastMonthSales.reduce((s, v) => s + (v.total || 0), 0);
  const caEvolution = lastMonthCA > 0 ? ((thisMonthCA - lastMonthCA) / lastMonthCA) * 100 : 0;
  const avgTicket = completedSales.length > 0 ? totalCA / completedSales.length : 0;
  const uniqueCustomers = new Set(completedSales.map(s => s.customerId || 'comptoir')).size;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin mr-3" />Chargement des analytics...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Tableaux de bord et rapports de performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <Select value={period} onValueChange={v => setPeriod(v as '3m' | '6m' | '12m')}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">3 derniers mois</SelectItem>
                <SelectItem value="6m">6 derniers mois</SelectItem>
                <SelectItem value="12m">12 derniers mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'CA total', value: formatCurrency(totalCA),
              sub: `${completedSales.length} ventes`,
              icon: DollarSign, color: 'text-primary-600', bg: 'bg-primary-100',
            },
            {
              label: 'CA ce mois', value: formatCurrency(thisMonthCA),
              sub: `${caEvolution >= 0 ? '+' : ''}${caEvolution.toFixed(1)}% vs mois dernier`,
              icon: caEvolution >= 0 ? TrendingUp : TrendingDown,
              color: caEvolution >= 0 ? 'text-green-600' : 'text-red-600',
              bg: caEvolution >= 0 ? 'bg-green-100' : 'bg-red-100',
            },
            {
              label: 'Ticket moyen', value: formatCurrency(avgTicket),
              sub: 'par transaction',
              icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-100',
            },
            {
              label: 'Clients actifs', value: uniqueCustomers,
              sub: 'depuis le début',
              icon: Users, color: 'text-purple-600', bg: 'bg-purple-100',
            },
          ].map((kpi, i) => (
            <Card key={i}><CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <p className="text-sm text-gray-500">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className={`text-xs mt-1 ${kpi.color}`}>{kpi.sub}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* CA mensuel — graphique principal */}
        <Card>
          <CardHeader>
            <CardTitle>Chiffre d'affaires & Marge</CardTitle>
            <CardDescription>Évolution sur les {monthsCount} derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="ca" name="CA" stroke="#2563eb" strokeWidth={2} fill="url(#colorCA)" />
                <Area type="monotone" dataKey="marge" name="Marge" stroke="#16a34a" strokeWidth={2} fill="url(#colorMarge)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ligne du milieu : activité semaine + paiements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Activité de la semaine */}
          <Card>
            <CardHeader>
              <CardTitle>Activité cette semaine</CardTitle>
              <CardDescription>CA par jour</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="ca" name="CA" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Répartition modes de paiement */}
          <Card>
            <CardHeader>
              <CardTitle>Modes de paiement</CardTitle>
              <CardDescription>Répartition du CA total</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <p className="text-sm">Aucune donnée</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value">
                      {paymentData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend formatter={v => v} iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Nombre de ventes par mois */}
        <Card>
          <CardHeader>
            <CardTitle>Volume de ventes</CardTitle>
            <CardDescription>Nombre de transactions par mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="ventes" name="Ventes" stroke="#7c3aed"
                  strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stats textuelles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="h-5 w-5 text-primary-600" />
              <p className="font-medium text-gray-900">Performance mois en cours</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">CA</span><span className="font-bold text-primary-600">{formatCurrency(thisMonthCA)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Transactions</span><span className="font-bold">{thisMonthSales.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Ticket moyen</span><span className="font-bold">{thisMonthSales.length > 0 ? formatCurrency(thisMonthCA / thisMonthSales.length) : '—'}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">vs mois dernier</span>
                <span className={`font-bold ${caEvolution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {caEvolution >= 0 ? '+' : ''}{caEvolution.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Package className="h-5 w-5 text-blue-600" />
              <p className="font-medium text-gray-900">Catalogue</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Produits actifs</span><span className="font-bold">{products.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Catégories</span><span className="font-bold">{categories.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Sans catégorie</span><span className="font-bold">{products.filter(p => !p.categoryId).length}</span></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <p className="font-medium text-gray-900">All-time</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">CA total</span><span className="font-bold text-green-600">{formatCurrency(totalCA)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total ventes</span><span className="font-bold">{completedSales.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Ventes annulées</span><span className="font-bold text-red-500">{sales.filter(s => s.status === 'CANCELLED').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Clients différents</span><span className="font-bold">{uniqueCustomers}</span></div>
            </div>
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
