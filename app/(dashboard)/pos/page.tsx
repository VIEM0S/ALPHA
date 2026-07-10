'use client';

import { useState, useEffect } from 'react';
import {
  Search, ShoppingCart, Trash2, Plus, Minus,
  User, X, CheckCircle2, RefreshCw, Package,
  CreditCard, Banknote, Smartphone, AlertTriangle,
  WifiOff, Wifi, CloudUpload
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/helpers';
import { useAuthStore, useCartStore } from '@/hooks/store';
import {
  collection, query, where, orderBy, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import type { Product, Customer } from '@/lib/types';
import {
  enqueueSale, getQueue, syncOfflineQueue, type QueuedSale,
} from '@/lib/offline-queue';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces', icon: Banknote },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
  { value: 'CARD', label: 'Carte bancaire', icon: CreditCard },
  { value: 'CREDIT', label: 'Crédit client', icon: User },
];

export default function POSPage() {
  const { tenant, currentStore, user } = useAuthStore();
  const tenantId = tenant?.id;
  const storeId = currentStore?.id;

  const {
    items, addItem, removeItem, updateItemQuantity,
    clearCart, setCustomer, customer,
    getSubtotal, getTax, getTotal, getItemCount,
    discountPercent, setDiscount,
  } = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // ─── Mode hors-ligne ───────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueue, setPendingQueue] = useState<QueuedSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wasOfflineSale, setWasOfflineSale] = useState(false);

  const refreshQueue = () => setPendingQueue(getQueue());

  const runSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOfflineQueue();
    } finally {
      refreshQueue();
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshQueue();
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => { setIsOnline(true); runSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Nouvelle tentative périodique — utile si le navigateur ne détecte pas
    // toujours fidèlement le retour de connexion (fréquent en 3G/4G instable)
    const interval = setInterval(() => {
      if (navigator.onLine) runSync();
    }, 30000);

    // Tentative de sync au chargement de la page, au cas où des ventes
    // seraient restées en attente d'une session précédente
    if (typeof navigator !== 'undefined' && navigator.onLine) runSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Raccourcis clavier POS
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // F2 ou Ctrl+F → focus recherche produit
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="produit"]');
        searchInput?.focus();
      }
      // Escape → fermer les dialogs ouverts
      if (e.key === 'Escape') {
        if (showPayment) { setShowPayment(false); setCheckoutError(null); }
        if (showCustomerPicker) setShowCustomerPicker(false);
        if (showSuccess) setShowSuccess(false);
      }
      // Ctrl+Entrée → valider le paiement si dialog ouvert
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showPayment && !isProcessing) {
        handleCheckout();
      }
      // Ctrl+Suppr → vider le panier
      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete' && !showPayment) {
        if (items.length > 0 && window.confirm('Vider le panier ?')) clearCart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showPayment, showCustomerPicker, showSuccess, isProcessing, items.length]);

  // ─── Listeners ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const unsubP = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'products')),
        where('isActive', '==', true), orderBy('name')),
      snap => { setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]); setIsLoading(false); }
    );
    const unsubC = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'customers')),
        where('isActive', '==', true), orderBy('createdAt', 'desc')),
      snap => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[])
    );
    const unsubI = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'inventory')), where('storeId', '==', storeId || '')),
      snap => {
        const inv: Record<string, number> = {};
        snap.docs.forEach(d => { inv[d.data().productId] = d.data().quantity || 0; });
        setInventory(inv);
      }
    );
    return () => { unsubP(); unsubC(); unsubI(); };
  }, [tenantId, storeId]);

  // ─── Calculs ────────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search)
  );

  const filteredCustomers = customers.filter(c => {
    const name = `${c.firstName || ''} ${c.lastName || ''} ${c.companyName || ''}`.toLowerCase();
    return !customerSearch || name.includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch);
  });

  const subtotal = getSubtotal();
  const discountAmount = subtotal * (discountPercent / 100);
  const tax = getTax();
  const total = getTotal();
  const change = amountReceived ? Math.max(0, Number(amountReceived) - total) : 0;
  const acompte = paymentMethod === 'CREDIT' ? (Number(amountReceived) || 0) : total;
  const soldeCredit = paymentMethod === 'CREDIT' ? Math.max(0, total - acompte) : 0;

  // ─── Ajout au panier avec vérification stock ─────────────────────────────
  const handleAddItem = (p: Product) => {
    if (!p.trackInventory) { addItem(p); return; }
    const cartQty = items.find(i => i.product.id === p.id)?.quantity || 0;
    const stockDisponible = (inventory[p.id] ?? 0) - cartQty;
    if (stockDisponible <= 0) {
      setCheckoutError(`Stock insuffisant pour "${p.name}" (${inventory[p.id] ?? 0} disponible)`);
      setTimeout(() => setCheckoutError(null), 3000);
      return;
    }
    addItem(p);
  };

  // ─── Checkout via l'API serveur (prix/coût recalculés côté serveur) ───────
  const handleCheckout = async () => {
    if (!tenantId || !storeId || !user || items.length === 0) return;
    if (paymentMethod === 'CREDIT' && !customer) {
      setCheckoutError('Sélectionnez un client pour un paiement en crédit');
      return;
    }
    if (paymentMethod === 'CASH' && amountReceived && Number(amountReceived) < total) {
      setCheckoutError('Montant insuffisant');
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    const checkoutPayload = {
      tenantId, storeId,
      items: items.map(i => ({ productId: i.product.id, quantity: i.quantity, discount: i.discount })),
      customerId: customer?.id || null,
      paymentMethod,
      amountReceived: Number(amountReceived) || undefined,
      discountPercent,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    };

    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la finalisation');

      setLastSaleId(data.saleId);
      setWasOfflineSale(false);
      clearCart();
      setAmountReceived('');
      setShowPayment(false);
      setShowSuccess(true);

    } catch (e: unknown) {
      // Une requête qui n'atteint même pas le serveur (pas de réseau) lève
      // une TypeError ("Failed to fetch") plutôt qu'une réponse HTTP — c'est
      // ce qui distingue "pas de connexion" d'une vraie erreur métier
      // (stock insuffisant, etc.), qu'on ne veut surtout pas mettre en file
      // d'attente silencieusement.
      const isNetworkFailure = e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetworkFailure) {
        enqueueSale(checkoutPayload, total);
        refreshQueue();
        setIsOnline(false);
        setLastSaleId(null);
        setWasOfflineSale(true);
        clearCart();
        setAmountReceived('');
        setShowPayment(false);
        setShowSuccess(true);
      } else {
        const msg = e instanceof Error ? e.message : 'Erreur lors de la finalisation';
        setCheckoutError(msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const displayCustomerName = (c: Customer) =>
    c.customerType === 'BUSINESS' ? c.companyName! : `${c.firstName || ''} ${c.lastName || ''}`.trim();

  return (
    <DashboardLayout>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">

        {/* ── Catalogue ── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {(!isOnline || pendingQueue.length > 0) && (
            <div className={`flex items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm ${
              !isOnline ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center gap-2">
                {!isOnline ? <WifiOff className="h-4 w-4 flex-shrink-0" /> : <Wifi className="h-4 w-4 flex-shrink-0" />}
                <span>
                  {!isOnline
                    ? 'Hors connexion — les ventes sont enregistrées localement et se synchroniseront au retour du réseau.'
                    : `${pendingQueue.length} vente${pendingQueue.length > 1 ? 's' : ''} en attente de synchronisation.`}
                </span>
              </div>
              {isOnline && pendingQueue.length > 0 && (
                <Button size="sm" variant="outline" onClick={runSync} disabled={isSyncing} className="h-7 text-xs">
                  {isSyncing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <CloudUpload className="h-3 w-3 mr-1" />}
                  Synchroniser
                </Button>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher un produit ou scanner un code-barres..."
              value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-4 w-4" /></button>}
          </div>

          {/* Erreur stock */}
          {checkoutError && !showPayment && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />{checkoutError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map(p => {
                  const stock = inventory[p.id] ?? 0;
                  const outOfStock = p.trackInventory && stock <= 0;
                  const cartQty = items.find(i => i.product.id === p.id)?.quantity || 0;
                  const stockLeft = stock - cartQty;
                  const almostOut = p.trackInventory && stockLeft > 0 && stockLeft <= p.alertThreshold;
                  return (
                    <button key={p.id} onClick={() => handleAddItem(p)} disabled={outOfStock}
                      className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                        outOfStock
                          ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-50'
                          : cartQty > 0
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-primary-400 hover:shadow-md active:scale-95'
                      }`}>
                      {cartQty > 0 && (
                        <span className="absolute -top-2 -right-2 h-6 w-6 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold shadow">
                          {cartQty}
                        </span>
                      )}
                      {outOfStock && (
                        <span className="absolute top-1 right-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Rupture</span>
                      )}
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-2 ${outOfStock ? 'bg-gray-100' : 'bg-primary-100'}`}>
                        <Package className={`h-5 w-5 ${outOfStock ? 'text-gray-300' : 'text-primary-500'}`} />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.sku}</p>
                      <p className="text-sm font-bold text-primary-600 mt-2">{formatCurrency(p.sellingPrice)}</p>
                      {p.trackInventory && (
                        <p className={`text-xs mt-1 font-medium ${outOfStock ? 'text-red-500' : almostOut ? 'text-amber-500' : 'text-gray-400'}`}>
                          {outOfStock ? 'Rupture' : `${stockLeft} restant${stockLeft > 1 ? 's' : ''}`}
                        </p>
                      )}
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="col-span-4 flex flex-col items-center justify-center py-16 text-gray-400">
                    <Package className="h-12 w-12 mb-4 opacity-30" />
                    <p>Aucun produit trouvé</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Panier ── */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-xl border-2 border-gray-100 shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary-600" />
                Panier <Badge className="bg-primary-100 text-primary-700">{getItemCount()}</Badge>
              </h2>
              {items.length > 0 && (
                <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 font-medium">Vider</button>
              )}
            </div>
            <button onClick={() => setShowCustomerPicker(true)}
              className="w-full flex items-center gap-2 text-sm p-2.5 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-400 transition-colors">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              {customer ? (
                <span className="text-gray-900 font-semibold truncate">{displayCustomerName(customer)}</span>
              ) : (
                <span className="text-gray-400">Client comptoir (cliquer pour choisir)</span>
              )}
              {customer && (
                <button onClick={e => { e.stopPropagation(); setCustomer(null); }} className="ml-auto text-gray-300 hover:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </button>
          </div>

          {/* Articles */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Panier vide</p>
                <p className="text-xs mt-1">Cliquez sur un produit</p>
              </div>
            ) : items.map(item => (
              <div key={item.product.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 leading-tight">{item.product.name}</p>
                  <button onClick={() => removeItem(item.product.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => item.quantity > 1 ? updateItemQuantity(item.product.id, item.quantity - 1) : removeItem(item.product.id)}
                      className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => {
                        const stockLeft = (inventory[item.product.id] ?? 0) - item.quantity;
                        if (item.product.trackInventory && stockLeft <= 0) return;
                        updateItemQuantity(item.product.id, item.quantity + 1);
                      }}
                      className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-primary-600">{formatCurrency(item.total)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatCurrency(item.unitPrice)} / {item.product.unit}</p>
              </div>
            ))}
          </div>

          {/* Totaux + payer */}
          {items.length > 0 && (
            <div className="p-4 border-t space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Sous-total</span><span>{formatCurrency(subtotal)}</span></div>
                {discountPercent > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Remise ({discountPercent}%)</span><span>-{formatCurrency(subtotal * discountPercent / 100)}</span></div>}
                {tax > 0 && <div className="flex justify-between text-gray-600"><span>TVA</span><span>{formatCurrency(tax)}</span></div>}
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t-2">
                  <span>TOTAL</span><span className="text-primary-600">{formatCurrency(total)}</span>
                </div>
              </div>
              {/* Remise libre */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-gray-500 flex-shrink-0">Remise :</span>
                {[0, 5, 10, 15, 20].map(d => (
                  <button key={d} onClick={() => setDiscount(d, d > 0 ? `Remise ${d}%` : null)}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors flex-shrink-0 ${discountPercent === d ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-400'}`}>
                    {d === 0 ? 'Aucune' : `${d}%`}
                  </button>
                ))}
                <div className="relative flex-1">
                  <input type="number" min="0" max="100" placeholder="%" value={discountPercent || ''}
                    onChange={e => { const v = Math.min(100, Math.max(0, Number(e.target.value))); setDiscount(v, v > 0 ? `Remise ${v}%` : null); }}
                    className="w-full text-xs border-2 border-gray-200 rounded-lg px-2 py-1 text-center focus:border-primary-400 focus:outline-none" />
                </div>
              </div>
              <Button onClick={() => { setCheckoutError(null); setAmountReceived(''); setShowPayment(true); }}
                className="w-full bg-primary-600 hover:bg-primary-700 h-10 font-bold text-base">
                Payer {formatCurrency(total)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog paiement ── */}
      <Dialog open={showPayment} onOpenChange={o => { if (!o) { setShowPayment(false); setCheckoutError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Finaliser le paiement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-primary-50 border-2 border-primary-100 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Montant à payer</p>
              <p className="text-4xl font-bold text-primary-700">{formatCurrency(total)}</p>
              {customer && <p className="text-sm text-gray-600 mt-2 font-medium">Client : {displayCustomerName(customer)}</p>}
            </div>

            {checkoutError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />{checkoutError}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Mode de paiement</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.value} onClick={() => { setPaymentMethod(m.value); setAmountReceived(''); }}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      paymentMethod === m.value
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    <m.icon className="h-4 w-4" />{m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Montant reçu (FCFA)</Label>
                <Input type="number" placeholder={String(total)} value={amountReceived}
                  onChange={e => setAmountReceived(e.target.value)} className="text-xl font-bold h-12 border-2" autoFocus />
                {amountReceived && Number(amountReceived) >= total && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600 font-medium">Monnaie à rendre</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(change)}</p>
                  </div>
                )}
                {amountReceived && Number(amountReceived) < total && (
                  <p className="text-sm text-red-600 font-medium text-center flex items-center justify-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Insuffisant — manque {formatCurrency(total - Number(amountReceived))}
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'CREDIT' && (
              <div className="space-y-3">
                {!customer ? (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium text-center">
                    ⚠️ Sélectionnez un client avant de continuer en crédit
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
                      <p className="font-semibold text-blue-900">{displayCustomerName(customer)}</p>
                      {(customer.creditLimit || 0) > 0 && (
                        <div className="mt-1 text-blue-700">
                          <span>Limite : {formatCurrency(customer.creditLimit)}</span>
                          <span className="mx-2">·</span>
                          <span>Utilisé : {formatCurrency(customer.creditUsed || 0)}</span>
                          {soldeCredit > 0 && (customer.creditUsed || 0) + soldeCredit > (customer.creditLimit || 0) && (
                            <p className="text-amber-700 font-semibold mt-1">⚠️ Dépassement de limite prévu</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">Acompte versé maintenant (FCFA)</Label>
                      <Input type="number" min="0" max={total} placeholder="0"
                        value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="h-12 text-xl font-bold border-2" />
                    </div>
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-xs text-amber-600 font-medium">Solde à rembourser</p>
                      <p className="text-2xl font-bold text-amber-700">{formatCurrency(soldeCredit)}</p>
                      <p className="text-xs text-amber-600 mt-1">Échéance : 30 jours</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPayment(false); setCheckoutError(null); }} className="border-2">Annuler</Button>
            <Button onClick={handleCheckout}
              disabled={
                isProcessing ||
                (paymentMethod === 'CASH' && !!amountReceived && Number(amountReceived) < total) ||
                (paymentMethod === 'CREDIT' && !customer)
              }
              className="bg-green-600 hover:bg-green-700 font-bold px-6">
              {isProcessing
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Traitement...</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmer la vente</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog sélection client ── */}
      <Dialog open={showCustomerPicker} onOpenChange={o => { if (!o) setShowCustomerPicker(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sélectionner un client</DialogTitle></DialogHeader>
          <Input placeholder="Rechercher..." value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)} autoFocus className="border-2" />
          <div className="max-h-72 overflow-y-auto space-y-1 mt-2">
            <button onClick={() => { setCustomer(null); setShowCustomerPicker(false); }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 text-sm text-gray-500 font-medium">
              ✕ Client comptoir (sans compte)
            </button>
            {filteredCustomers.map(c => (
              <button key={c.id} onClick={() => { setCustomer(c); setShowCustomerPicker(false); setCustomerSearch(''); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary-50 text-sm transition-colors ${customer?.id === c.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-800'}`}>
                <p className="font-semibold">{displayCustomerName(c)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.phone || c.email || c.code}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog succès ── */}
      <Dialog open={showSuccess} onOpenChange={o => { if (!o) setShowSuccess(false); }}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-6">
            <div className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 ${wasOfflineSale ? 'bg-amber-100' : 'bg-green-100'}`}>
              {wasOfflineSale
                ? <WifiOff className="h-10 w-10 text-amber-600" />
                : <CheckCircle2 className="h-10 w-10 text-green-600" />}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {wasOfflineSale ? 'Vente enregistrée hors-ligne' : 'Vente enregistrée !'}
            </h3>
            {wasOfflineSale ? (
              <p className="text-sm text-gray-500 px-2">
                Le reçu peut être imprimé normalement. Elle sera confirmée dans le système dès le retour de la connexion.
              </p>
            ) : (
              lastSaleId && <p className="text-sm text-gray-500 font-mono">N° {lastSaleId.slice(0, 8).toUpperCase()}</p>
            )}
            <Button onClick={() => setShowSuccess(false)} className="mt-6 w-full bg-primary-600 hover:bg-primary-700 h-12 text-lg font-bold">
              Nouvelle vente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
