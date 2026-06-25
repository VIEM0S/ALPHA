'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Barcode,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Percent,
  Receipt,
  Printer,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCartStore, useAuthStore } from '@/hooks/store';
import { formatCurrency, cn } from '@/lib/utils/helpers';
import type { Product, Customer } from '@/lib/types';

const mockProducts: Product[] = [
  { id: '1', tenantId: 't1', sku: 'CM-PT-50', barcode: '1234567890123', name: 'Ciment Portland 50kg', description: null, categoryId: '1', unit: 'sac', purchasePrice: 12000, sellingPrice: 15000, taxRate: 0, alertThreshold: 50, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i1', tenantId: 't1', productId: '1', storeId: 's1', quantity: 150, minQuantity: 20 }] },
  { id: '2', tenantId: 't1', sku: 'FR-12', barcode: '1234567890124', name: 'Fer à béton 12mm', description: null, categoryId: '2', unit: 'barre', purchasePrice: 5500, sellingPrice: 7000, taxRate: 0, alertThreshold: 100, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i2', tenantId: 't1', productId: '2', storeId: 's1', quantity: 250 }] },
  { id: '3', tenantId: 't1', sku: 'PT-BL-20', barcode: '1234567890125', name: 'Peinture blanche 20L', description: null, categoryId: '3', unit: 'seau', purchasePrice: 12000, sellingPrice: 15000, taxRate: 0, alertThreshold: 10, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i3', tenantId: 't1', productId: '3', storeId: 's1', quantity: 45 }] },
  { id: '4', tenantId: 't1', sku: 'CL-10', barcode: '1234567890126', name: 'Clous 10cm (kg)', description: null, categoryId: '4', unit: 'kg', purchasePrice: 2500, sellingPrice: 3500, taxRate: 0, alertThreshold: 20, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i4', tenantId: 't1', productId: '4', storeId: 's1', quantity: 80 }] },
  { id: '5', tenantId: 't1', sku: 'MQ-STD', barcode: '1234567890127', name: 'Marteau standard', description: null, categoryId: '5', unit: 'piece', purchasePrice: 3500, sellingPrice: 5000, taxRate: 0, alertThreshold: 15, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i5', tenantId: 't1', productId: '5', storeId: 's1', quantity: 35 }] },
  { id: '6', tenantId: 't1', sku: 'PV-BX', barcode: '1234567890128', name: 'Pelle en bois', description: null, categoryId: '5', unit: 'piece', purchasePrice: 2000, sellingPrice: 3000, taxRate: 0, alertThreshold: 10, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i6', tenantId: 't1', productId: '6', storeId: 's1', quantity: 60 }] },
];

const mockCustomers: Customer[] = [
  { id: 'c1', tenantId: 't1', code: 'CLI-001', firstName: 'Amadou', lastName: 'Diallo', companyName: null, email: 'amadou@email.com', phone: '+223 70 12 34 56', address: 'Badalabougou', city: 'Bamako', customerType: 'INDIVIDUAL', creditLimit: 100000, creditUsed: 25000, notes: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'c2', tenantId: 't1', code: 'CLI-002', firstName: null, lastName: null, companyName: 'Construction Express SARL', email: 'contact@construction-express.ml', phone: '+223 79 98 76 54', address: 'Zone Industrielle', city: 'Bamako', customerType: 'BUSINESS', creditLimit: 500000, creditUsed: 150000, notes: 'Client VIP', isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

const categories = [
  { id: '1', name: 'Ciment & Béton', color: 'bg-gray-100' },
  { id: '2', name: 'Fer & Acier', color: 'bg-blue-100' },
  { id: '3', name: 'Peinture', color: 'bg-green-100' },
  { id: '4', name: 'Quincaillerie', color: 'bg-accent-100' },
  { id: '5', name: 'Outillage', color: 'bg-purple-100' },
];

export default function POSPage() {
  const {
    items,
    customer,
    discountPercent,
    notes,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemPrice,
    clearCart,
    setCustomer,
    setDiscount,
    setNotes,
    getSubtotal,
    getTax,
    getTotal,
    getItemCount
  } = useCartStore();
  const { currentStore } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleReference, setSaleReference] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountInput, setDiscountInput] = useState('0');
  const [discountReasonInput, setDiscountReasonInput] = useState('');

  useEffect(() => {
    let filtered = mockProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }
    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory]);

  const handleAddProduct = useCallback((product: Product) => {
    const inventory = product.inventory?.[0];
    if (inventory && inventory.quantity <= 0) {
      return;
    }
    addItem(product, 1);
  }, [addItem]);

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const reference = `SAL-2024-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`;
      setSaleReference(reference);
      setShowPaymentDialog(false);
      setShowSuccessDialog(true);
      clearCart();
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();
  const change = amountReceived - total;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-7rem)] flex gap-4">
        {/* Left Panel - Product Search & Selection */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un produit (nom, SKU, code-barres)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Barcode className="h-4 w-4" />
              Scanner
            </Button>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              Tout
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Product Grid */}
          <Card className="flex-1 min-h-0">
            <CardContent className="p-4 h-full">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => {
                    const inventory = product.inventory?.[0];
                    const isLowStock = inventory && inventory.quantity <= product.alertThreshold;
                    const isOutOfStock = inventory && inventory.quantity <= 0;

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        disabled={isOutOfStock}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all hover:shadow-md hover:border-primary-300',
                          isOutOfStock ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white hover:bg-primary-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                          {isLowStock && !isOutOfStock && (
                            <Badge variant="outline" className="text-warning-600 border-warning-300 text-xs">
                              Stock bas
                            </Badge>
                          )}
                          {isOutOfStock && (
                            <Badge variant="outline" className="text-danger-600 border-danger-300 text-xs">
                              Rupture
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">{product.sku}</p>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-primary-600">
                            {formatCurrency(product.sellingPrice)}
                          </p>
                          {inventory && !isOutOfStock && (
                            <p className="text-xs text-gray-400">{inventory.quantity} en stock</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Cart */}
        <Card className="w-96 flex flex-col">
          <CardHeader className="border-b px-4 py-3 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Panier</CardTitle>
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-danger-600 hover:text-danger-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Customer Selection */}
            <div className="border-b p-4">
              <button
                onClick={() => setShowCustomerSelect(true)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  {customer ? (
                    <span className="text-sm font-semibold text-primary-600">
                      {customer.companyName?.charAt(0) || customer.firstName?.charAt(0) || 'A'}
                    </span>
                  ) : (
                    <User className="h-5 w-5 text-primary-600" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  {customer ? (
                    <>
                      <p className="font-medium text-gray-900">
                        {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                      </p>
                      <p className="text-xs text-gray-500">{customer.phone}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Sélectionner un client (optionnel)</p>
                  )}
                </div>
                {customer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomer(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </button>
            </div>

            {/* Cart Items */}
            <ScrollArea className="flex-1 p-4">
              {items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Panier vide</p>
                  <p className="text-sm">Cliquez sur un produit pour l'ajouter</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-3 p-2 rounded-lg bg-gray-50">
                      <div className="h-12 w-12 rounded bg-white flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-danger-600"
                            onClick={() => removeItem(item.product.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                updateItemQuantity(item.product.id, Math.max(1, item.quantity - 1))
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQuantity(item.product.id, Math.max(1, parseInt(e.target.value) || 1))
                              }
                              className="h-7 w-14 text-center text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="font-semibold text-sm">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Totals & Checkout */}
            <div className="border-t p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Remise ({discountPercent}%)</span>
                  <span className="text-danger-600">-{formatCurrency(subtotal * discountPercent / 100)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">TVA</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary-600">{formatCurrency(total)}</span>
              </div>

              {/* Discount Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDiscountDialog(true)}
              >
                <Percent className="h-4 w-4 mr-2" />
                {discountPercent > 0 ? `Remise: ${discountPercent}%` : 'Ajouter une remise'}
              </Button>

              {/* Pay Button */}
              <Button
                className="w-full h-12 text-lg"
                disabled={items.length === 0}
                onClick={() => setShowPaymentDialog(true)}
              >
                <CreditCard className="h-5 w-5 mr-2" />
                Paiement ({formatCurrency(total)})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Selection Dialog */}
      <Dialog open={showCustomerSelect} onOpenChange={setShowCustomerSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sélectionner un client</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {mockCustomers.map((cust) => (
              <button
                key={cust.id}
                onClick={() => {
                  setCustomer(cust);
                  setShowCustomerSelect(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary-600">
                    {cust.companyName?.charAt(0) || cust.firstName?.charAt(0) || 'A'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {cust.companyName || `${cust.firstName} ${cust.lastName}`}
                  </p>
                  <p className="text-sm text-gray-500">{cust.phone}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomerSelect(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paiement</DialogTitle>
            <DialogDescription>
              Total à payer: {formatCurrency(total)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Payment Methods */}
            <div>
              <p className="text-sm font-medium mb-2">Mode de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'CASH', label: 'Espèces', icon: Banknote },
                  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
                  { value: 'BANK_TRANSFER', label: 'Virement', icon: Building2 },
                  { value: 'CREDIT', label: 'Crédit', icon: CreditCard },
                ].map((method) => (
                  <button
                    key={method.value}
                    onClick={() => setSelectedPaymentMethod(method.value)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 transition-colors',
                      selectedPaymentMethod === method.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <method.icon className={cn(
                      'h-5 w-5',
                      selectedPaymentMethod === method.value ? 'text-primary-600' : 'text-gray-400'
                    )} />
                    <span className="font-medium text-sm">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Received (for Cash) */}
            {selectedPaymentMethod === 'CASH' && (
              <div>
                <p className="text-sm font-medium mb-2">Montant reçu</p>
                <Input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="text-xl h-12"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {change >= 0 ? `Monnaie à rendre: ${formatCurrency(change)}` : `Reste à payer: ${formatCurrency(-change)}`}
                </p>
                <div className="flex gap-2 mt-2">
                  {[5000, 10000, 20000, 50000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmountReceived(amount)}
                    >
                      {formatCurrency(amount)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handlePayment}
              disabled={
                selectedPaymentMethod === 'CASH' && amountReceived < total
              }
              className="min-w-32"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Valider
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="py-4">
            <div className="h-16 w-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Paiement réussi !
            </h2>
            <p className="text-gray-500 mb-4">
              Vente {saleReference} enregistrée
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
              <Button variant="outline">
                <Send className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)}>
              Nouvelle vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer une remise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Pourcentage de remise</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  max={100}
                  min={0}
                  className="flex-1"
                />
                <span className="flex items-center px-3 bg-gray-100 rounded-lg text-gray-500">%</span>
              </div>
              <div className="flex gap-2 mt-2">
                {[5, 10, 15, 20].map((percent) => (
                  <Button
                    key={percent}
                    variant="outline"
                    size="sm"
                    onClick={() => setDiscountInput(String(percent))}
                  >
                    {percent}%
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Raison de la remise (optionnel)</p>
              <Input
                value={discountReasonInput}
                onChange={(e) => setDiscountReasonInput(e.target.value)}
                placeholder="Ex: Client fidèle, promotion..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                setDiscount(parseInt(discountInput) || 0, discountReasonInput || null);
                setShowDiscountDialog(false);
              }}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Package({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
