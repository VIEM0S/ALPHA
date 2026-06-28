'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, ShoppingCart, Trash2, Plus, Minus,
  User, X, CheckCircle2, RefreshCw, Package, CreditCard, Banknote, Smartphone
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
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, runTransaction, getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import type { Product, Customer } from '@/lib/types';

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

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // ─── Listeners Firestore ─────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return;

    const unsubP = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'products')), where('isActive', '==', true), orderBy('name')),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]);
        setIsLoading(false);
      }
    );

    const unsubC = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'customers')), where('isActive', '==', true), orderBy('createdAt', 'desc')),
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Customer[])
    );

    const unsubI = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'inventory')), where('storeId', '==', storeId || '')),
      (snap) => {
        const inv: Record<string, number> = {};
        snap.docs.forEach((d) => { inv[d.data().productId] = d.data().quantity || 0; });
        setInventory(inv);
      }
    );

    return () => { unsubP(); unsubC(); unsubI(); };
  }, [tenantId, storeId]);

  // ─── Filtres produits ────────────────────────────────────────────────────

  const filteredProducts = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search)
  );

  const filteredCustomers = customers.filter((c) => {
    const name = `${c.firstName || ''} ${c.lastName || ''} ${c.companyName || ''}`.toLowerCase();
    return !customerSearch || name.includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch);
  });

  // ─── Calculs ─────────────────────────────────────────────────────────────

  const subtotal = getSubtotal();
  const discountAmount = subtotal * (discountPercent / 100);
  const tax = getTax();
  const total = getTotal();
  const change = amountReceived ? Math.max(0, Number(amountReceived) - total) : 0;

  // ─── Finaliser la vente ──────────────────────────────────────────────────

  const handleCheckout = async () => {
    if (!tenantId || !storeId || !user || items.length === 0) return;
    if (paymentMethod === 'CREDIT' && !customer) {
      alert('Sélectionnez un client pour un paiement en crédit');
      return;
    }
    setIsProcessing(true);
    try {
      const acompte = paymentMethod === 'CREDIT' ? (Number(amountReceived) || 0) : total;
      const soldeCredit = paymentMethod === 'CREDIT' ? Math.max(0, total - acompte) : 0;
      const customerName = customer
        ? (customer.customerType === 'BUSINESS' ? customer.companyName : `${customer.firstName || ''} ${customer.lastName || ''}`.trim())
        : null;
      const saleRef = await addDoc(collection(db, tenantCol(tenantId, 'sales')), {
        tenantId, storeId, userId: user.id,
        customerId: customer?.id || null,
        customerName,
        subtotal, discountPercent, discountAmount, tax, total,
        status: 'COMPLETED',
        paymentMethod,
        acompte,
        soldeCredit,
        amountReceived: paymentMethod === 'CASH' ? Number(amountReceived) || total : acompte,
        change: paymentMethod === 'CASH' ? change : 0,
        itemCount: getItemCount(),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });

      // Enregistrer les articles de vente et décrémenter le stock
      await Promise.all(items.map(async (item) => {
        // Sale item
        await addDoc(collection(db, `tenants/${tenantId}/sales/${saleRef.id}/sale_items`), {
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          tax: item.tax,
          total: item.total,
          costPrice: item.product.purchasePrice,
          costTotal: item.quantity * item.product.purchasePrice,
        });

        // Décrémenter le stock si trackInventory
        if (item.product.trackInventory) {
          const invSnap = await getDocs(
            query(collection(db, tenantCol(tenantId, 'inventory')),
              where('productId', '==', item.product.id),
              where('storeId', '==', storeId))
          );
          if (!invSnap.empty) {
            const invDoc = invSnap.docs[0];
            const newQty = Math.max(0, (invDoc.data().quantity || 0) - item.quantity);
            await updateDoc(invDoc.ref, { quantity: newQty, updatedAt: serverTimestamp() });
            // Mouvement de stock
            await addDoc(collection(db, tenantCol(tenantId, 'inventory_movements')), {
              tenantId, productId: item.product.id, storeId,
              type: 'SALE', quantity: -item.quantity,
              previousQuantity: invDoc.data().quantity,
              newQuantity: newQty, saleId: saleRef.id,
              reason: 'Vente POS', createdAt: serverTimestamp(),
            });
          }
        }
      }));

      // Enregistrer le paiement
      await addDoc(collection(db, `tenants/${tenantId}/sales/${saleRef.id}/payments`), {
        method: paymentMethod, amount: total,
        amountReceived: paymentMethod === 'CASH' ? Number(amountReceived) || total : total,
        change: paymentMethod === 'CASH' ? change : 0,
        createdAt: serverTimestamp(),
      });

      // Créer le crédit si paiement en crédit et solde > 0
      if (paymentMethod === 'CREDIT' && soldeCredit > 0 && customer) {
        const echeance = new Date();
        echeance.setDate(echeance.getDate() + 30);
        const creditRef = await addDoc(collection(db, tenantCol(tenantId, 'credits')), {
          tenantId, saleId: saleRef.id,
          customerId: customer.id,
          customerName,
          customerPhone: customer.phone || null,
          montantTotal: total,
          acompte,
          solde: soldeCredit,
          dateEcheance: echeance.toISOString().split('T')[0],
          status: soldeCredit > 0 ? 'PENDING' : 'PAID',
          userId: user.id,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        // Mettre à jour le crédit utilisé du client
        const cSnap = await getDocs(
          query(collection(db, tenantCol(tenantId, 'customers')), where('__name__', '==', customer.id))
        );
        if (!cSnap.empty) {
          const currentUsed = cSnap.docs[0].data().creditUsed || 0;
          await updateDoc(cSnap.docs[0].ref, {
            creditUsed: currentUsed + soldeCredit,
            updatedAt: serverTimestamp(),
          });
        }
        // Si un acompte a été versé, l'enregistrer comme premier versement
        if (acompte > 0) {
          await addDoc(collection(db, `tenants/${tenantId}/credits/${creditRef.id}/credit_payments`), {
            creditId: creditRef.id,
            montant: acompte,
            soldeAvant: total,
            soldeApres: soldeCredit,
            userId: user.id,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            note: 'Acompte versé lors de la vente',
            createdAt: serverTimestamp(),
          });
        }
      }

      setLastSaleId(saleRef.id);
      clearCart();
      setShowPayment(false);
      setShowSuccess(true);
    } catch (e) {
      console.error('Checkout error:', e);
      alert('Erreur lors de la finalisation. Réessayez.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const displayCustomerName = (c: Customer) =>
    c.customerType === 'BUSINESS' ? c.companyName! : `${c.firstName || ''} ${c.lastName || ''}`.trim();

  return (
    <DashboardLayout>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">

        {/* ── Panneau gauche : catalogue ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un produit ou scanner un code-barres..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-4 w-4" /></button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((p) => {
                  const stock = inventory[p.id] ?? 0;
                  const outOfStock = p.trackInventory && stock <= 0;
                  const cartQty = items.find(i => i.product.id === p.id)?.quantity || 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !outOfStock && addItem(p)}
                      disabled={outOfStock}
                      className={`relative text-left p-3 rounded-xl border transition-all ${
                        outOfStock ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-primary-400 hover:shadow-md active:scale-95'
                      } ${cartQty > 0 ? 'border-primary-400 ring-1 ring-primary-400' : ''}`}
                    >
                      {cartQty > 0 && (
                        <span className="absolute -top-2 -right-2 h-5 w-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {cartQty}
                        </span>
                      )}
                      <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{p.sku}</p>
                      <p className="text-sm font-bold text-primary-600 mt-2">{formatCurrency(p.sellingPrice)}</p>
                      {p.trackInventory && (
                        <p className={`text-xs mt-1 ${stock <= p.alertThreshold ? 'text-amber-500' : 'text-gray-400'}`}>
                          Stock : {stock} {p.unit}
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

        {/* ── Panneau droit : panier ── */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-xl border shadow-sm">
          {/* Header panier */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Panier <Badge variant="secondary">{getItemCount()}</Badge>
              </h2>
              {items.length > 0 && (
                <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">Vider</button>
              )}
            </div>
            {/* Client */}
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="w-full flex items-center gap-2 text-sm p-2 rounded-lg border border-dashed border-gray-300 hover:border-primary-400 transition-colors"
            >
              <User className="h-4 w-4 text-gray-400" />
              {customer ? (
                <span className="text-gray-900 font-medium truncate">{displayCustomerName(customer)}</span>
              ) : (
                <span className="text-gray-400">Client comptoir (cliquer pour choisir)</span>
              )}
              {customer && <button onClick={(e) => { e.stopPropagation(); setCustomer(null); }} className="ml-auto text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>}
            </button>
          </div>

          {/* Articles */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Cliquez sur un produit pour l'ajouter</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.product.id} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{item.product.name}</p>
                    <button onClick={() => removeItem(item.product.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => item.quantity > 1 ? updateItemQuantity(item.product.id, item.quantity - 1) : removeItem(item.product.id)}
                        className="h-6 w-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                        className="h-6 w-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-primary-600">{formatCurrency(item.total)}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(item.unitPrice)} / {item.product.unit}</p>
                </div>
              ))
            )}
          </div>

          {/* Totaux + checkout */}
          {items.length > 0 && (
            <div className="p-4 border-t space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Sous-total</span><span>{formatCurrency(subtotal)}</span></div>
                {discountPercent > 0 && <div className="flex justify-between text-green-600"><span>Remise ({discountPercent}%)</span><span>-{formatCurrency(discountAmount)}</span></div>}
                {tax > 0 && <div className="flex justify-between text-gray-600"><span>TVA</span><span>{formatCurrency(tax)}</span></div>}
                <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t">
                  <span>TOTAL</span><span className="text-primary-600">{formatCurrency(total)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={String(discountPercent)} onValueChange={(v) => setDiscount(Number(v), v !== '0' ? `Remise ${v}%` : null)}>
                  <SelectTrigger className="flex-1 h-9 text-xs"><SelectValue placeholder="Remise" /></SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 20, 25, 30].map((d) => <SelectItem key={d} value={String(d)}>{d === 0 ? 'Sans remise' : `${d}%`}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => { setAmountReceived(''); setShowPayment(true); }} className="flex-1 bg-primary-600 hover:bg-primary-700 h-9">
                  Payer {formatCurrency(total)}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog paiement ── */}
      <Dialog open={showPayment} onOpenChange={(o) => { if (!o) setShowPayment(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Finaliser le paiement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Montant à payer</p>
              <p className="text-3xl font-bold text-primary-600">{formatCurrency(total)}</p>
              {customer && <p className="text-sm text-gray-500 mt-1">Client : <strong>{displayCustomerName(customer)}</strong></p>}
            </div>

            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === m.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'}`}>
                    <m.icon className="h-4 w-4" />{m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <Label>Montant reçu (FCFA)</Label>
                <Input type="number" placeholder={String(total)} value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)} className="text-lg font-bold" autoFocus />
                {amountReceived && Number(amountReceived) >= total && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-green-600">Monnaie à rendre</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(change)}</p>
                  </div>
                )}
                {amountReceived && Number(amountReceived) < total && (
                  <p className="text-sm text-red-500 text-center">Montant insuffisant ({formatCurrency(total - Number(amountReceived))} manquant)</p>
                )}
              </div>
            )}

            {paymentMethod === 'CREDIT' && (
              <div className="space-y-3">
                {!customer && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    ⚠️ Sélectionnez un client avant de continuer en crédit
                  </div>
                )}
                {customer && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      Client : <strong>{customer.customerType === 'BUSINESS' ? customer.companyName : `${customer.firstName || ''} ${customer.lastName || ''}`.trim()}</strong>
                      {(customer.creditLimit || 0) > 0 && (
                        <p className="mt-1">Limite crédit : {formatCurrency(customer.creditLimit)} · Utilisé : {formatCurrency(customer.creditUsed || 0)}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Acompte versé maintenant (FCFA) — optionnel</Label>
                      <Input type="number" min="0" max={total} placeholder="0"
                        value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-600 mb-1">Solde à rembourser (crédit)</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {formatCurrency(Math.max(0, total - (Number(amountReceived) || 0)))}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">Échéance : 30 jours</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Annuler</Button>
            <Button
              onClick={handleCheckout}
              disabled={
                isProcessing ||
                (paymentMethod === 'CASH' && !!amountReceived && Number(amountReceived) < total) ||
                (paymentMethod === 'CREDIT' && !customer)
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Traitement...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmer la vente</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog sélection client ── */}
      <Dialog open={showCustomerPicker} onOpenChange={(o) => { if (!o) setShowCustomerPicker(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sélectionner un client</DialogTitle></DialogHeader>
          <Input placeholder="Rechercher..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} autoFocus />
          <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
            <button onClick={() => { setCustomer(null); setShowCustomerPicker(false); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm text-gray-500">
              ✕ Client comptoir (sans compte)
            </button>
            {filteredCustomers.map((c) => (
              <button key={c.id} onClick={() => { setCustomer(c); setShowCustomerPicker(false); setCustomerSearch(''); }}
                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-primary-50 hover:text-primary-700 text-sm ${customer?.id === c.id ? 'bg-primary-50 text-primary-700 font-medium' : ''}`}>
                <p className="font-medium">{displayCustomerName(c)}</p>
                <p className="text-xs text-gray-400">{c.phone || c.email || c.code}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog succès ── */}
      <Dialog open={showSuccess} onOpenChange={(o) => { if (!o) setShowSuccess(false); }}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Vente enregistrée !</h3>
            {lastSaleId && <p className="text-sm text-gray-500">N° {lastSaleId.slice(0, 8).toUpperCase()}</p>}
            <Button onClick={() => setShowSuccess(false)} className="mt-6 w-full bg-primary-600 hover:bg-primary-700">
              Nouvelle vente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
