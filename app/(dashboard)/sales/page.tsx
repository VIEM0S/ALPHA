'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, X, ShoppingBag, RefreshCw, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDateTime } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import type { Sale } from '@/lib/types';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Complétée', color: 'bg-green-100 text-green-700' },
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Remboursée', color: 'bg-gray-100 text-gray-700' },
};

export default function SalesPage() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<Sale | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, tenantCol(tenantId, 'sales')), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Sale[]);
      setIsLoading(false);
    });
  }, [tenantId]);

  const filtered = sales.filter((s) => {
    const matchSearch = !search || s.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + (s.total || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historique des ventes</h1>
            <p className="text-sm text-gray-500 mt-1">{filtered.length} vente{filtered.length !== 1 ? 's' : ''} · Revenu : {formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        <Card><CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Rechercher par n° de vente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium">Aucune vente trouvée</p>
              <p className="text-sm mt-1">Les ventes apparaîtront ici après utilisation du POS</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Vente</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-center">Paiement</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const st = STATUS_LABELS[s.status] ?? STATUS_LABELS.PENDING;
                  const date = formatDateTime(s.createdAt);
                  return (
                    <TableRow key={s.id} className="hover:bg-gray-50">
                      <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{s.id.slice(0, 8).toUpperCase()}</code></TableCell>
                      <TableCell className="text-sm text-gray-500">{date}</TableCell>
                      <TableCell className="text-sm">{(s as unknown as { customerName?: string }).customerName || 'Client comptoir'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(s.total)}</TableCell>
                      <TableCell className="text-center"><span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span></TableCell>
                      <TableCell className="text-center text-sm text-gray-500">{(s as unknown as { paymentMethod?: string }).paymentMethod || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(s)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Détail de la vente</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">N° Vente</p><p className="font-mono font-medium">{selected.id.slice(0, 8).toUpperCase()}</p></div>
                <div><p className="text-gray-500">Statut</p><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[selected.status]?.color}`}>{STATUS_LABELS[selected.status]?.label}</span></div>
                <div><p className="text-gray-500">Total</p><p className="font-bold text-lg text-primary-600">{formatCurrency(selected.total)}</p></div>
                <div><p className="text-gray-500">Remise</p><p>{formatCurrency((selected as unknown as { discountAmount?: number }).discountAmount || 0)}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
