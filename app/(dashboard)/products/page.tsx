'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Plus, Search, Edit, Trash2, Package,
  AlertTriangle, RefreshCw, X, ChevronDown, Upload
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection, query, orderBy, onSnapshot,
  doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import { checkPlanLimitClient } from '@/lib/firebase/plan-limits-client';
import type { Product, Category } from '@/lib/types';

// ─── Types form ───────────────────────────────────────────────────────────────

interface ProductForm {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  taxRate: string;
  alertThreshold: string;
  isActive: boolean;
  trackInventory: boolean;
}

const EMPTY_FORM: ProductForm = {
  sku: '', barcode: '', name: '', description: '',
  categoryId: '', unit: 'piece',
  purchasePrice: '', sellingPrice: '',
  taxRate: '0', alertThreshold: '10',
  isActive: true, trackInventory: true,
};

const UNITS = [
  { value: 'piece', label: 'Pièce' },
  { value: 'sac', label: 'Sac' },
  { value: 'kg', label: 'Kilogramme' },
  { value: 'm', label: 'Mètre' },
  { value: 'm2', label: 'Mètre carré' },
  { value: 'm3', label: 'Mètre cube' },
  { value: 'litre', label: 'Litre' },
  { value: 'barre', label: 'Barre' },
  { value: 'carton', label: 'Carton' },
  { value: 'boite', label: 'Boîte' },
  { value: 'rouleau', label: 'Rouleau' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProductsPageInner() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const searchParams = useSearchParams();
  const router = useRouter();

  // Ouvrir le dialog si ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') openAdd();
  }, [searchParams]);

  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Firestore listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return;

    // Produits
    const qProducts = query(
      collection(db, tenantCol(tenantId, 'products')),
      orderBy('name', 'asc')
    );
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
      })) as Product[];
      setProducts(data);
      setIsLoading(false);
    });

    // Catégories
    const qCats = query(
      collection(db, tenantCol(tenantId, 'categories')),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const unsubCats = onSnapshot(qCats, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Category[];
      setCategories(data);
    });

    return () => { unsubProducts(); unsubCats(); };
  }, [tenantId]);

  // ─── Filtres ─────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode || '').includes(searchQuery);
    const matchCat = filterCategory === 'all' || p.categoryId === filterCategory;
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && p.isActive) ||
      (filterStatus === 'inactive' && !p.isActive);
    return matchSearch && matchCat && matchStatus;
  });

  const lowStock = products.filter(
    (p) => p.isActive && p.trackInventory &&
      (p.inventory?.[0]?.quantity ?? 0) <= p.alertThreshold
  ).length;

  // ─── Dialog helpers ───────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowDialog(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      description: p.description || '',
      categoryId: p.categoryId || '',
      unit: p.unit,
      purchasePrice: String(p.purchasePrice),
      sellingPrice: String(p.sellingPrice),
      taxRate: String(p.taxRate),
      alertThreshold: String(p.alertThreshold),
      isActive: p.isActive,
      trackInventory: p.trackInventory,
    });
    setFormError(null);
    setShowDialog(true);
  };

  const f = (field: keyof ProductForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!tenantId) return;
    if (!form.name.trim() || !form.sku.trim()) {
      setFormError('Nom et SKU sont obligatoires');
      return;
    }
    if (!form.purchasePrice || Number(form.purchasePrice) <= 0) {
      setFormError('Le prix d\'achat doit être supérieur à 0');
      return;
    }
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) {
      setFormError('Le prix de vente doit être supérieur à 0');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    if (!editingProduct) {
      const limitCheck = await checkPlanLimitClient(tenantId, 'maxProducts');
      if (!limitCheck.allowed) {
        setFormError(limitCheck.reason);
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      tenantId,
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      categoryId: form.categoryId || null,
      unit: form.unit,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice),
      taxRate: Number(form.taxRate) || 0,
      alertThreshold: Number(form.alertThreshold) || 10,
      isActive: form.isActive,
      trackInventory: form.trackInventory,
      imageData: null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingProduct) {
        await updateDoc(
          doc(db, tenantCol(tenantId, 'products'), editingProduct.id),
          payload
        );
      } else {
        await addDoc(collection(db, tenantCol(tenantId, 'products')), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      setShowDialog(false);
    } catch (err) {
      setFormError('Erreur lors de la sauvegarde. Réessayez.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tenantId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, tenantCol(tenantId, 'products'), deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (p: Product) => {
    if (!tenantId) return;
    await updateDoc(doc(db, tenantCol(tenantId, 'products'), p.id), {
      isActive: !p.isActive,
      updatedAt: serverTimestamp(),
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? '—';

  const margin = (p: Product) =>
    p.purchasePrice > 0
      ? Math.round(((p.sellingPrice - p.purchasePrice) / p.purchasePrice) * 100)
      : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
            <p className="text-sm text-gray-500 mt-1">
              {products.length} produit{products.length !== 1 ? 's' : ''} au total
              {lowStock > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {lowStock} en stock faible
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/products/import')}>
              <Upload className="h-4 w-4 mr-2" />
              Importer en masse
            </Button>
            <Button onClick={openAdd} className="bg-primary-600 hover:bg-primary-700">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau produit
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, SKU ou code-barres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="h-6 w-6 animate-spin mr-3" />
                Chargement des produits...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Package className="h-12 w-12 mb-4 opacity-30" />
                <p className="font-medium">Aucun produit trouvé</p>
                {!searchQuery && products.length === 0 && (
                  <Button onClick={openAdd} variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter votre premier produit
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Prix achat</TableHead>
                    <TableHead className="text-right">Prix vente</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const m = margin(p);
                    const stock = p.inventory?.[0]?.quantity ?? null;
                    const isLow = stock !== null && stock <= p.alertThreshold;
                    return (
                      <TableRow key={p.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                              {isLow && (
                                <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  Stock faible ({stock})
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{p.sku}</code>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{catName(p.categoryId)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(p.purchasePrice)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(p.sellingPrice)}</TableCell>
                        <TableCell className="text-right">
                          {m !== null ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              m >= 25 ? 'bg-green-100 text-green-700' :
                              m >= 10 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {m}%
                            </span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={p.isActive}
                            onCheckedChange={() => toggleStatus(p)}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(p)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(p)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog ajout/édition */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) setShowDialog(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>SKU / Référence *</Label>
              <Input
                placeholder="ex: CM-PT-50" autoFocus
                value={form.sku}
                onChange={(e) => f('sku', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Code-barres</Label>
              <Input
                placeholder="ex: 1234567890123"
                value={form.barcode}
                onChange={(e) => f('barcode', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Nom du produit *</Label>
              <Input
                placeholder="Nom du produit"
                value={form.name}
                onChange={(e) => f('name', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Description du produit..."
                value={form.description}
                onChange={(e) => f('description', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={form.categoryId} onValueChange={(v) => f('categoryId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sans catégorie</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={form.unit} onValueChange={(v) => f('unit', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prix d'achat (FCFA) *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.purchasePrice}
                onChange={(e) => f('purchasePrice', e.target.value)}
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Prix de vente (FCFA) *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.sellingPrice}
                onChange={(e) => f('sellingPrice', e.target.value)}
                min="0"
              />
            </div>
            {form.purchasePrice && form.sellingPrice && Number(form.purchasePrice) > 0 && (
              <div className="col-span-2 bg-green-50 rounded-lg px-4 py-2 text-sm text-green-700">
                Marge : {Math.round(((Number(form.sellingPrice) - Number(form.purchasePrice)) / Number(form.purchasePrice)) * 100)}%
                · Bénéfice : {formatCurrency(Number(form.sellingPrice) - Number(form.purchasePrice))} / unité
              </div>
            )}
            <div className="space-y-2">
              <Label>TVA (%)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.taxRate}
                onChange={(e) => f('taxRate', e.target.value)}
                min="0"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label>Seuil d'alerte stock</Label>
              <Input
                type="number"
                placeholder="10"
                value={form.alertThreshold}
                onChange={(e) => f('alertThreshold', e.target.value)}
                min="0"
              />
            </div>
            <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Produit actif</p>
                <p className="text-xs text-gray-500">Visible dans le POS et les ventes</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => f('isActive', v)}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Suivi de stock</p>
                <p className="text-xs text-gray-500">Décrémenter le stock lors des ventes</p>
              </div>
              <Switch
                checked={form.trackInventory}
                onCheckedChange={(v) => f('trackInventory', v)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary-600 hover:bg-primary-700">
              {isSaving ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</>
              ) : editingProduct ? 'Enregistrer' : 'Créer le produit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> sera définitivement supprimé.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageInner />
    </Suspense>
  );
}
