'use client';

import { useState, useEffect } from 'react';
import { Search, X, RefreshCw, ArrowUpCircle, ArrowDownCircle, Settings } from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';

interface Movement {
  id: string;
  productId: string;
  productName?: string;
  storeId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  saleId?: string;
  createdAt: unknown;
}

const TYPE_CONFIG = {
  IN:         { label: 'Entrée',      color: 'bg-green-100 text-green-700',  icon: ArrowUpCircle,   sign: '+' },
  OUT:        { label: 'Sortie',      color: 'bg-red-100 text-red-700',      icon: ArrowDownCircle, sign: '-' },
  ADJUSTMENT: { label: 'Ajustement', color: 'bg-blue-100 text-blue-700',    icon: Settings,        sign: '±' },
  SALE:       { label: 'Vente',       color: 'bg-orange-100 text-orange-700',icon: ArrowDownCircle, sign: '-' },
};

export default function MovementsPage() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!tenantId) return;
    // Charger les noms de produits
    const unsubP = onSnapshot(collection(db, tenantCol(tenantId, 'products')), snap => {
      const map: Record<string, string> = {};
      snap.docs.forEach(d => { map[d.id] = d.data().name; });
      setProducts(map);
    });
    // Charger les mouvements
    const unsubM = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'inventory_movements')), orderBy('createdAt', 'desc'), limit(500)),
      snap => {
        setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Movement[]);
        setIsLoading(false);
      }
    );
    return () => { unsubP(); unsubM(); };
  }, [tenantId]);

  const filtered = movements.filter(m => {
    const name = products[m.productId] || '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || m.type === filterType;
    return matchSearch && matchType;
  });

  // Stats
  const totalEntrees = movements.filter(m => m.type === 'IN').reduce((s, m) => s + Math.abs(m.quantity), 0);
  const totalSorties = movements.filter(m => ['OUT', 'SALE'].includes(m.type)).reduce((s, m) => s + Math.abs(m.quantity), 0);
  const totalAjustements = movements.filter(m => m.type === 'ADJUSTMENT').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mouvements de stock</h1>
          <p className="text-sm text-gray-500 mt-1">Historique complet des entrées, sorties et ajustements</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total entrées', value: totalEntrees, icon: ArrowUpCircle, color: 'text-green-600' },
            { label: 'Total sorties', value: totalSorties, icon: ArrowDownCircle, color: 'text-red-600' },
            { label: 'Ajustements', value: totalAjustements, icon: Settings, color: 'text-blue-600' },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4">
              <div className="flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
                <div><p className="text-xs text-gray-500">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
              </div>
            </CardContent></Card>
          ))}
        </div>

        {/* Filtres */}
        <Card><CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-4 w-4" /></button>}
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="IN">Entrées</SelectItem>
                <SelectItem value="OUT">Sorties</SelectItem>
                <SelectItem value="SALE">Ventes</SelectItem>
                <SelectItem value="ADJUSTMENT">Ajustements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>

        {/* Table */}
        <Card><CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ArrowUpCircle className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium">Aucun mouvement trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Stock avant</TableHead>
                  <TableHead className="text-right">Stock après</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => {
                  const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.ADJUSTMENT;
                  const Icon = cfg.icon;
                  const isPositive = m.type === 'IN' || (m.type === 'ADJUSTMENT' && m.quantity > 0);
                  return (
                    <TableRow key={m.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                      <TableCell className="font-medium text-sm">{products[m.productId] || m.productId}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                          <Icon className="h-3 w-3" />{cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : '-'}{Math.abs(m.quantity)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">{m.previousQuantity}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{m.newQuantity}</TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                        {m.reason || (m.saleId ? `Vente #${m.saleId.slice(0,6).toUpperCase()}` : '—')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
