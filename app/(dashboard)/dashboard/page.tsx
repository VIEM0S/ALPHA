'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  AlertTriangle,
  ShoppingCart,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calendar
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatRelativeTime } from '@/lib/utils/helpers';

interface DashboardStats {
  todaySales: number;
  yesterdaySales: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  totalProfit: number;
  totalProducts: number;
  lowStockCount: number;
  activeCredits: number;
  overdueCredits: number;
  recentSales: Array<{
    id: string;
    reference: string;
    total: number;
    customer_name: string;
    created_at: string;
    payment_method: string;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    quantity_sold: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    date: string;
    sales: number;
    revenue: number;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const todayChange = stats ? ((stats.todaySales - stats.yesterdaySales) / (stats.yesterdaySales || 1)) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500">Bienvenue sur votre espace de gestion</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Ventes aujourd'hui</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats ? formatCurrency(stats.todaySales) : '---'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {todayChange >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-success-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-danger-500" />
                    )}
                    <span className={`text-xs ${todayChange >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {Math.abs(todayChange).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">vs hier</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Revenus du mois</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats ? formatCurrency(stats.monthlyRevenue) : '---'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Semaine: {stats ? formatCurrency(stats.weeklyRevenue) : '---'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Produits actifs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.totalProducts ?? '---'}
                  </p>
                  {stats?.lowStockCount ? (
                    <p className="text-xs text-warning-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {stats.lowStockCount} en alerte stock
                    </p>
                  ) : null}
                </div>
                <div className="h-12 w-12 rounded-xl bg-accent-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-accent-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Crédits actifs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.activeCredits ?? '---'}
                  </p>
                  {stats?.overdueCredits ? (
                    <p className="text-xs text-danger-600 mt-1">
                      {stats.overdueCredits} en retard
                    </p>
                  ) : null}
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning-100 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-warning-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sales */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ventes récentes</CardTitle>
                  <CardDescription>Les dernières transactions</CardDescription>
                </div>
                <a href="/sales" className="text-sm text-primary-600 hover:text-primary-700">
                  Voir tout
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-gray-200 rounded" />
                        <div className="h-3 w-32 bg-gray-100 rounded" />
                      </div>
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : stats?.recentSales?.length ? (
                <div className="space-y-2">
                  {stats.recentSales.map((sale) => (
                    <a
                      key={sale.id}
                      href={`/sales/${sale.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {sale.reference}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {sale.payment_method}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {sale.customer_name || 'Client anonyme'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(sale.total)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatRelativeTime(sale.created_at)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucune vente récente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top produits</CardTitle>
                  <CardDescription>Les plus vendus ce mois</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-full bg-gray-200 rounded" />
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.topProducts?.length ? (
                <div className="space-y-4">
                  {stats.topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {product.quantity_sold} u
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(product.revenue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucune donnée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a
            href="/pos"
            className="flex items-center gap-4 p-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
          >
            <ShoppingCart className="h-8 w-8" />
            <div>
              <p className="font-semibold">Point de vente</p>
              <p className="text-sm text-primary-200">Nouvelle vente</p>
            </div>
          </a>

          <a
            href="/products/new"
            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Package className="h-8 w-8 text-gray-600" />
            <div>
              <p className="font-semibold text-gray-900">Nouveau produit</p>
              <p className="text-sm text-gray-500">Ajouter au catalogue</p>
            </div>
          </a>

          <a
            href="/customers/new"
            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Users className="h-8 w-8 text-gray-600" />
            <div>
              <p className="font-semibold text-gray-900">Nouveau client</p>
              <p className="text-sm text-gray-500">Ajouter au CRM</p>
            </div>
          </a>

          <a
            href="/inventory/alerts"
            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <AlertTriangle className="h-8 w-8 text-warning-500" />
            <div>
              <p className="font-semibold text-gray-900">Alertes stock</p>
              <p className="text-sm text-gray-500">
                {stats?.lowStockCount || 0} produits en alerte
              </p>
            </div>
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
