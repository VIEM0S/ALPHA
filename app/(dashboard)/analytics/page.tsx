'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, Users, RefreshCw, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, toFirestoreDate } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import {
  collection, query, orderBy, onSnapshot,
  limit, where, getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';

interface Sale {
  id: string; total: number; subtotal: number; status: string;
  paymentMethod?: string; customerId?: string; createdAt: unknown;
}
interface Product { id: string; name: string; sku: string; categoryId?: string; purchasePrice: number; }
interface Category { id: string; name: string; }


const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#ea580c','#4f46e5'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-gray-900">{p.value > 999 ? formatCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { tenant, currentStore } = useAuthStore();
  const tenantId = tenant?.id;

  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; qty: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);

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

  // ─── Top produits réels depuis les sous-collections ──────────────────────
  useEffect(() => {
    if (!tenantId || sales.length === 0) return;
    setLoadingTop(true);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSales = sales.filter(s => s.status === 'COMPLETED' && toFirestoreDate(s.createdAt) >= startOfMonth);

    if (monthSales.length === 0) { setTopProducts([]); setLoadingTop(false); return; }

    // Charger les sale_items des ventes du mois (max 20 ventes pour performance)
    const sampleSales = monthSales.slice(0, 20);
    Promise.all(
      sampleSales.map(s =>
        getDocs(collection(db, `tenants/${tenantId}/sales/${s.id}/sale_items`))
          .then(snap => snap.docs.map(d => d.data()))
      )
    ).then(allItems => {
      const stats: Record<string, { name: string; revenue: number; qty: number }> = {};
      allItems.flat().forEach((item: Record<string, unknown>) => {
        const pid = item.productId as string;
        const name = item.productName as string;
        if (!pid || !name) return;
        if (!stats[pid]) stats[pid] = { name, revenue: 0, qty: 0 };
        stats[pid].revenue += (item.total as number) || 0;
        stats[pid].qty += (item.quantity as number) || 0;
      });
      const sorted = Object.values(stats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      setTopProducts(sorted);
    }).finally(() => setLoadingTop(false));
  }, [tenantId, sales.length]);

  const completedSales = useMemo(() => sales.filter(s => s.status === 'COMPLETED'), [sales]);
  const now = new Date();
  const monthsCount = period === '3m' ? 3 : period === '6m' ? 6 : 12;

  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthSales = completedSales.filter(s => {
        const sd = toFirestoreDate(s.createdAt);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      });
      const ca = monthSales.reduce((s, v) => s + (v.total || 0), 0);
      const cout = monthSales.reduce((s, v) => s + (v.subtotal || v.total || 0) * 0.7, 0);
      data.push({ month: MONTHS_FR[d.getMonth()], ca, marge: Math.round(ca - cout), ventes: monthSales.length });
    }
    return data;
  }, [completedSales, period]);

  const weeklyData = useMemo(() => {
    const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const today = new Date();
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - dow); startOfWeek.setHours(0,0,0,0);
    return days.map((day, i) => {
      const dayStart = new Date(startOfWeek); dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const daySales = completedSales.filter(s => { const d = toFirestoreDate(s.createdAt); return d >= dayStart && d < dayEnd; });
      return { day, ca: daySales.reduce((s, v) => s + (v.total || 0), 0), ventes: daySales.length };
    });
  }, [completedSales]);

  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    completedSales.forEach(s => {
      const pm = s.paymentMethod || 'CASH';
      counts[pm] = (counts[pm] || 0) + (s.total || 0);
    });
    const labels: Record<string, string> = { CASH:'Espèces', MOBILE_MONEY:'Mobile Money', CARD:'Carte', CREDIT:'Crédit' };
    return Object.entries(counts).map(([k, v]) => ({ name: labels[k] || k, value: Math.round(v) }));
  }, [completedSales]);

  const thisMonthSales = completedSales.filter(s => { const d = toFirestoreDate(s.createdAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const lastMonthSales = completedSales.filter(s => { const d = toFirestoreDate(s.createdAt); const lm = new Date(now.getFullYear(), now.getMonth()-1,1); return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth(); });
  const thisMonthCA = thisMonthSales.reduce((s, v) => s + (v.total || 0), 0);
  const lastMonthCA = lastMonthSales.reduce((s, v) => s + (v.total || 0), 0);
  const caEvolution = lastMonthCA > 0 ? ((thisMonthCA - lastMonthCA) / lastMonthCA) * 100 : 0;
  const totalCA = completedSales.reduce((s, v) => s + (v.total || 0), 0);
  const avgTicket = completedSales.length > 0 ? totalCA / completedSales.length : 0;
  const uniqueCustomers = new Set(completedSales.map(s => s.customerId || 'comptoir')).size;

  if (isLoading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="h-6 w-6 animate-spin mr-3" />Chargement des analytics...
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Tableaux de bord et rapports de performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={period} onValueChange={v => setPeriod(v as '3m'|'6m'|'12m')}>
              <SelectTrigger className="w-40 border-2"><SelectValue /></SelectTrigger>
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
            { label:'CA total', value: formatCurrency(totalCA), sub:`${completedSales.length} ventes`, icon:DollarSign, color:'text-primary-600', bg:'bg-primary-100' },
            { label:'CA ce mois', value: formatCurrency(thisMonthCA), sub:`${caEvolution >= 0 ? '+' : ''}${caEvolution.toFixed(1)}% vs mois dernier`, icon: caEvolution >= 0 ? TrendingUp : TrendingDown, color: caEvolution >= 0 ? 'text-green-600' : 'text-red-600', bg: caEvolution >= 0 ? 'bg-green-100' : 'bg-red-100' },
            { label:'Ticket moyen', value: formatCurrency(avgTicket), sub:'par transaction', icon:ShoppingCart, color:'text-blue-600', bg:'bg-blue-100' },
            { label:'Clients actifs', value: uniqueCustomers, sub:'depuis le début', icon:Users, color:'text-purple-600', bg:'bg-purple-100' },
          ].map((kpi, i) => (
            <Card key={i}><CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className={`text-xs mt-1 font-medium ${kpi.color}`}>{kpi.sub}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* CA mensuel */}
        <Card>
          <CardHeader>
            <CardTitle>Chiffre d'affaires & Marge estimée</CardTitle>
            <CardDescription>Évolution sur les {monthsCount} derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top:5, right:10, left:10, bottom:5 }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize:12, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'#6b7280' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={10} />
                <Area type="monotone" dataKey="ca" name="CA" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorCA)" />
                <Area type="monotone" dataKey="marge" name="Marge" stroke="#16a34a" strokeWidth={2.5} fill="url(#colorMarge)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activité semaine */}
          <Card>
            <CardHeader>
              <CardTitle>Activité cette semaine</CardTitle>
              <CardDescription>CA par jour</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize:12, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#6b7280' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="ca" name="CA" fill="#2563eb" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Modes de paiement */}
          <Card>
            <CardHeader>
              <CardTitle>Modes de paiement</CardTitle>
              <CardDescription>Répartition du CA total</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="value">
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={10} formatter={v => <span className="text-sm text-gray-700">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top produits réels */}
          <Card>
            <CardHeader>
              <CardTitle>Top produits — ce mois</CardTitle>
              <CardDescription>Basé sur les ventes du mois en cours</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTop ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />Calcul...
                </div>
              ) : topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Package className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Aucune vente ce mois</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => {
                    const maxRev = topProducts[0].revenue;
                    const pct = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200 text-gray-600'}`}>{i+1}</span>
                            <span className="font-medium text-gray-800 truncate max-w-[160px]">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{formatCurrency(p.revenue)}</p>
                            <p className="text-xs text-gray-400">{p.qty} vendu{p.qty > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volume de ventes */}
          <Card>
            <CardHeader>
              <CardTitle>Volume de ventes</CardTitle>
              <CardDescription>Nombre de transactions par mois</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize:12, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="ventes" name="Ventes" stroke="#7c3aed" strokeWidth={2.5}
                    dot={{ fill:'#7c3aed', r:4 }} activeDot={{ r:6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Stats textuelles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title:'Ce mois', items:[
              { label:'CA', value: formatCurrency(thisMonthCA), color:'text-primary-600' },
              { label:'Transactions', value: thisMonthSales.length, color:'text-gray-900' },
              { label:'Ticket moyen', value: thisMonthSales.length > 0 ? formatCurrency(thisMonthCA/thisMonthSales.length) : '—', color:'text-gray-900' },
              { label:'vs mois dernier', value: `${caEvolution >= 0 ? '+' : ''}${caEvolution.toFixed(1)}%`, color: caEvolution >= 0 ? 'text-green-600' : 'text-red-600' },
            ]},
            { title:'Catalogue', items:[
              { label:'Produits actifs', value: products.length, color:'text-gray-900' },
              { label:'Catégories', value: categories.length, color:'text-gray-900' },
              { label:'Sans catégorie', value: products.filter(p => !p.categoryId).length, color:'text-amber-600' },
            ]},
            { title:'All-time', items:[
              { label:'CA total', value: formatCurrency(totalCA), color:'text-green-600' },
              { label:'Total ventes', value: completedSales.length, color:'text-gray-900' },
              { label:'Annulées', value: sales.filter(s => s.status === 'CANCELLED').length, color:'text-red-500' },
              { label:'Clients différents', value: uniqueCustomers, color:'text-gray-900' },
            ]},
          ].map((block, i) => (
            <Card key={i}><CardContent className="p-5">
              <p className="font-bold text-gray-900 mb-4 pb-3 border-b">{block.title}</p>
              <div className="space-y-2.5">
                {block.items.map((item, j) => (
                  <div key={j} className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{item.label}</span>
                    <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
