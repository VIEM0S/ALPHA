'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Download, Search, X, RefreshCw,
  CheckCircle2, Eye, Plus, ShoppingBag
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, toFirestoreDate, formatDate, formatDateTime } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import {
  collection, query, orderBy, onSnapshot,
  limit, getDocs, doc, getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import { generateInvoicePDF } from '@/lib/utils/pdf';
import type { InvoiceData } from '@/lib/utils/pdf';

interface Sale {
  id: string; total: number; subtotal: number; status: string;
  paymentMethod?: string; customerName?: string; customerId?: string;
  discountPercent?: number; discountAmount?: number; tax?: number;
  acompte?: number; soldeCredit?: number; amountReceived?: number; change?: number;
  createdAt: unknown;
}

interface SaleItem {
  productName: string; productSku: string;
  quantity: number; unitPrice: number; total: number;
}

interface Quote {
  id: string; total: number; status: string;
  customerName?: string; customerId?: string;
  dateValidite?: string; note?: string;
  items?: QuoteItem[];
  createdAt: unknown;
}

interface QuoteItem {
  productName: string; productSku: string;
  quantity: number; unitPrice: number; total: number;
}


export default function InvoicesPage() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [tab, setTab] = useState<'sales' | 'quotes'>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [previewItems, setPreviewItems] = useState<SaleItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let done = 0;
    const check = () => { done++; if (done >= 2) setIsLoading(false); };

    const unsubS = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'sales')),
        orderBy('createdAt', 'desc'), limit(200)),
      snap => { setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[]); check(); }
    );
    const unsubQ = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'quotes')), orderBy('createdAt', 'desc')),
      snap => { setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Quote[]); check(); }
    );
    return () => { unsubS(); unsubQ(); };
  }, [tenantId]);

  const filteredSales = sales.filter(s =>
    s.status === 'COMPLETED' &&
    (!search || (s.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredQuotes = quotes.filter(q =>
    (!search || (q.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      q.id.toLowerCase().includes(search.toLowerCase()))
  );

  const getTenantConfig = () => ({
    companyName: (tenant as unknown as Record<string, string>)?.name || 'Mon Entreprise',
    companyEmail: (tenant as unknown as Record<string, string>)?.email || '',
    companyPhone: (tenant as unknown as Record<string, string>)?.phone || '',
    companyAddress: (tenant as unknown as Record<string, string>)?.address || '',
    companyCity: (tenant as unknown as Record<string, string>)?.city || '',
    companyRccm: (tenant as unknown as Record<string, string>)?.rccm || '',
    companyNif: (tenant as unknown as Record<string, string>)?.nif || '',
    currency: (tenant as unknown as Record<string, string>)?.currency || 'FCFA',
  });

  const generateSaleInvoice = async (sale: Sale) => {
    if (!tenantId) return;
    setIsGenerating(sale.id);
    try {
      const itemsSnap = await getDocs(
        collection(db, `tenants/${tenantId}/sales/${sale.id}/sale_items`)
      );
      const items: SaleItem[] = itemsSnap.docs.map(d => d.data() as SaleItem);
      const date = toFirestoreDate(sale.createdAt);

      const invoiceData: InvoiceData = {
        ...getTenantConfig(),
        invoiceNumber: `FAC-${sale.id.slice(0, 8).toUpperCase()}`,
        type: 'FACTURE',
        date: date.toLocaleDateString('fr-FR'),
        customerName: sale.customerName || 'Client comptoir',
        items: items.map(i => ({
          description: `${i.productName} (${i.productSku || ''})`,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        subtotal: sale.subtotal || sale.total,
        discountPercent: sale.discountPercent,
        discountAmount: sale.discountAmount,
        tax: sale.tax,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        amountReceived: sale.amountReceived,
        change: sale.change,
        soldeCredit: sale.soldeCredit,
      };

      generateInvoicePDF(invoiceData);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(null);
    }
  };

  const generateQuoteInvoice = async (quote: Quote) => {
    if (!tenantId) return;
    setIsGenerating(quote.id);
    try {
      const items = quote.items || [];
      const date = toFirestoreDate(quote.createdAt);
      const validite = quote.dateValidite
        ? new Date(quote.dateValidite).toLocaleDateString('fr-FR')
        : undefined;

      const invoiceData: InvoiceData = {
        ...getTenantConfig(),
        invoiceNumber: `DEV-${quote.id.slice(0, 8).toUpperCase()}`,
        type: 'DEVIS',
        date: date.toLocaleDateString('fr-FR'),
        dueDate: validite,
        customerName: quote.customerName || 'Client',
        items: items.map((i: QuoteItem) => ({
          description: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.quantity * i.unitPrice,
        })),
        subtotal: quote.total,
        total: quote.total,
        notes: quote.note || undefined,
      };

      generateInvoicePDF(invoiceData);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(null);
    }
  };

  const openPreview = async (sale: Sale) => {
    if (!tenantId) return;
    setPreviewSale(sale);
    setLoadingPreview(true);
    try {
      const itemsSnap = await getDocs(
        collection(db, `tenants/${tenantId}/sales/${sale.id}/sale_items`)
      );
      setPreviewItems(itemsSnap.docs.map(d => d.data() as SaleItem));
    } finally {
      setLoadingPreview(false);
    }
  };

  const PM_LABELS: Record<string, string> = {
    CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money',
    CARD: 'Carte', CREDIT: 'Crédit',
  };

  const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
    PENDING:   { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
    ACCEPTED:  { label: 'Accepté',    color: 'bg-blue-100 text-blue-700' },
    CONVERTED: { label: 'Converti',   color: 'bg-green-100 text-green-700' },
    REFUSED:   { label: 'Refusé',     color: 'bg-red-100 text-red-700' },
    EXPIRED:   { label: 'Expiré',     color: 'bg-gray-100 text-gray-500' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Factures & Devis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Générez des PDF pour vos ventes et devis
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { key: 'sales', label: `Factures (${filteredSales.length})`, icon: FileText },
            { key: 'quotes', label: `Devis (${filteredQuotes.length})`, icon: FileText },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as 'sales' | 'quotes')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <Card><CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher par client ou numéro..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-4 w-4" /></button>}
          </div>
        </CardContent></Card>

        {/* Table Factures */}
        {tab === 'sales' && (
          <Card><CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
                <p className="font-medium">Aucune vente trouvée</p>
                <p className="text-sm mt-1">Les factures sont générées depuis les ventes complétées</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Facture</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map(s => (
                    <TableRow key={s.id} className="hover:bg-gray-50">
                      <TableCell>
                        <code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                          FAC-{s.id.slice(0, 8).toUpperCase()}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{formatDateTime(s.createdAt)}</TableCell>
                      <TableCell className="text-sm font-medium">{s.customerName || 'Client comptoir'}</TableCell>
                      <TableCell className="text-sm text-gray-500">{PM_LABELS[s.paymentMethod || 'CASH'] || s.paymentMethod}</TableCell>
                      <TableCell className="text-right font-bold text-primary-600">{formatCurrency(s.total)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => openPreview(s)} title="Aperçu">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-600"
                            onClick={() => generateSaleInvoice(s)}
                            disabled={isGenerating === s.id}
                            title="Télécharger PDF">
                            {isGenerating === s.id
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        )}

        {/* Table Devis */}
        {tab === 'quotes' && (
          <Card><CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText className="h-12 w-12 mb-4 opacity-30" />
                <p className="font-medium">Aucun devis trouvé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Devis</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center w-24">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map(q => {
                    const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.PENDING;
                    return (
                      <TableRow key={q.id} className="hover:bg-gray-50">
                        <TableCell>
                          <code className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-medium">
                            DEV-{q.id.slice(0, 8).toUpperCase()}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{formatDate(q.createdAt)}</TableCell>
                        <TableCell className="text-sm font-medium">{q.customerName}</TableCell>
                        <TableCell className="text-sm text-gray-500">{q.dateValidite ? formatDate(q.dateValidite) : '—'}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(q.total)}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-600"
                            onClick={() => generateQuoteInvoice(q)}
                            disabled={isGenerating === q.id}
                            title="Télécharger PDF">
                            {isGenerating === q.id
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        )}
      </div>

      {/* Modal aperçu facture */}
      <Dialog open={!!previewSale} onOpenChange={o => { if (!o) { setPreviewSale(null); setPreviewItems([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Aperçu — FAC-{previewSale?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
            </div>
          ) : previewSale && (
            <div className="space-y-4">
              {/* Infos */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Client</p>
                  <p className="font-medium">{previewSale.customerName || 'Client comptoir'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Date</p>
                  <p className="font-medium">{formatDateTime(previewSale.createdAt)}</p>
                </div>
              </div>

              {/* Articles */}
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Articles</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs">
                      <tr>
                        <th className="text-left px-3 py-2">Article</th>
                        <th className="text-center px-3 py-2">Qté</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-gray-400">{formatCurrency(item.unitPrice)} / unité</p>
                          </td>
                          <td className="text-center px-3 py-2">{item.quantity}</td>
                          <td className="text-right px-3 py-2 font-medium">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totaux */}
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 space-y-1 text-sm">
                {(previewSale.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Remise ({previewSale.discountPercent}%)</span>
                    <span>-{formatCurrency(previewSale.discountAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-primary-700 pt-1">
                  <span>TOTAL</span>
                  <span>{formatCurrency(previewSale.total)}</span>
                </div>
              </div>

              {/* Bouton télécharger */}
              <Button
                onClick={() => { generateSaleInvoice(previewSale); setPreviewSale(null); setPreviewItems([]); }}
                disabled={isGenerating === previewSale.id}
                className="w-full bg-primary-600 hover:bg-primary-700">
                {isGenerating === previewSale.id
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Génération...</>
                  : <><Download className="h-4 w-4 mr-2" />Télécharger la facture PDF</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
