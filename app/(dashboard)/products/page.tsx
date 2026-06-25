'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  Barcode,
  Upload,
  Download,
  Eye,
  Copy
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, cn } from '@/lib/utils/helpers';
import type { Product, Category } from '@/lib/types';

const mockProducts: Product[] = [
  { id: '1', tenantId: 't1', sku: 'CM-PT-50', barcode: '1234567890123', name: 'Ciment Portland 50kg', description: 'Ciment Portland de haute qualité pour construction', categoryId: '1', unit: 'sac', purchasePrice: 12000, sellingPrice: 15000, taxRate: 0, alertThreshold: 50, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i1', tenantId: 't1', productId: '1', storeId: 's1', quantity: 150, minQuantity: 20 }] },
  { id: '2', tenantId: 't1', sku: 'FR-12', barcode: '1234567890124', name: 'Fer à béton 12mm', description: 'Fer à béton de construction diamètre 12mm', categoryId: '2', unit: 'barre', purchasePrice: 5500, sellingPrice: 7000, taxRate: 0, alertThreshold: 100, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i2', tenantId: 't1', productId: '2', storeId: 's1', quantity: 250 }] },
  { id: '3', tenantId: 't1', sku: 'PT-BL-20', barcode: '1234567890125', name: 'Peinture blanche 20L', description: 'Peinture acrylique blanche premium', categoryId: '3', unit: 'seau', purchasePrice: 12000, sellingPrice: 15000, taxRate: 18, alertThreshold: 10, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i3', tenantId: 't1', productId: '3', storeId: 's1', quantity: 8 }] },
  { id: '4', tenantId: 't1', sku: 'CL-10', barcode: '1234567890126', name: 'Clous 10cm (kg)', description: 'Clous de charpente 10cm vendus au kg', categoryId: '4', unit: 'kg', purchasePrice: 2500, sellingPrice: 3500, taxRate: 0, alertThreshold: 20, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i4', tenantId: 't1', productId: '4', storeId: 's1', quantity: 80 }] },
  { id: '5', tenantId: 't1', sku: 'MQ-STD', barcode: '1234567890127', name: 'Marteau standard', description: 'Marteau de menuisier', categoryId: '5', unit: 'piece', purchasePrice: 3500, sellingPrice: 5000, taxRate: 0, alertThreshold: 15, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i5', tenantId: 't1', productId: '5', storeId: 's1', quantity: 35 }] },
  { id: '6', tenantId: 't1', sku: 'PV-BX', barcode: '1234567890128', name: 'Pelle en bois', description: 'Pelle traditionnelle manche bois', categoryId: '5', unit: 'piece', purchasePrice: 2000, sellingPrice: 3000, taxRate: 0, alertThreshold: 10, imageData: null, isActive: true, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i6', tenantId: 't1', productId: '6', storeId: 's1', quantity: 3 }] },
  { id: '7', tenantId: 't1', sku: 'TUI-40', barcode: '1234567890129', name: 'Tuiles terracotta', description: 'Tuiles traditionnelles en terre cuite', categoryId: '6', unit: 'piece', purchasePrice: 800, sellingPrice: 1200, taxRate: 0, alertThreshold: 500, imageData: null, isActive: false, trackInventory: true, createdAt: new Date(), updatedAt: new Date(), inventory: [{ id: 'i7', tenantId: 't1', productId: '7', storeId: 's1', quantity: 1200 }] },
];

const mockCategories: Category[] = [
  { id: '1', tenantId: 't1', name: 'Ciment & Béton', slug: 'ciment-beton', description: null, parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', tenantId: 't1', name: 'Fer & Acier', slug: 'fer-acier', description: null, parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', tenantId: 't1', name: 'Peinture', slug: 'peinture', description: null, parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', tenantId: 't1', name: 'Quincaillerie', slug: 'quincaillerie', description: null, parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', tenantId: 't1', name: 'Outillage', slug: 'outillage', description: null, parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '6', tenantId: 't1', name: 'Toiture', slug: 'toiture', description: null, parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockFilter, setStockFilter] = useState<string>('all');

  const filteredProducts = mockProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const inventory = p.inventory?.[0];
    const matchesStock = stockFilter === 'all' ||
      (stockFilter === 'low' && inventory && inventory.quantity <= p.alertThreshold && inventory.quantity > 0) ||
      (stockFilter === 'out' && (!inventory || inventory.quantity <= 0));
    return matchesSearch && matchesCategory && matchesStock;
  });

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Non classé';
    return mockCategories.find((c) => c.id === categoryId)?.name || 'Non classé';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
            <p className="text-gray-500">Gérez votre catalogue de produits</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau produit
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total produits</p>
                  <p className="text-2xl font-bold">{mockProducts.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Produits actifs</p>
                  <p className="text-2xl font-bold text-success-600">
                    {mockProducts.filter((p) => p.isActive).length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-success-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Stock bas</p>
                  <p className="text-2xl font-bold text-warning-600">
                    {mockProducts.filter((p) => {
                      const inv = p.inventory?.[0];
                      return inv && inv.quantity <= p.alertThreshold && inv.quantity > 0;
                    }).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Rupture de stock</p>
                  <p className="text-2xl font-bold text-danger-600">
                    {mockProducts.filter((p) => !p.inventory?.[0] || p.inventory[0].quantity <= 0).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-danger-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, SKU, code-barres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {mockCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les stocks</SelectItem>
                  <SelectItem value="low">Stock bas</SelectItem>
                  <SelectItem value="out">Rupture</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix d'achat</TableHead>
                  <TableHead>Prix de vente</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const inventory = product.inventory?.[0];
                  const isLowStock = inventory && inventory.quantity <= product.alertThreshold && inventory.quantity > 0;
                  const isOutOfStock = !inventory || inventory.quantity <= 0;

                  return (
                    <TableRow key={product.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleSelectProduct(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>SKU: {product.sku}</span>
                              {product.barcode && (
                                <>
                                  <span>•</span>
                                  <Barcode className="h-3 w-3" />
                                  <span>{product.barcode}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryName(product.categoryId)}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(product.purchasePrice)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(product.sellingPrice)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-medium',
                            isOutOfStock ? 'text-danger-600' :
                              isLowStock ? 'text-warning-600' : 'text-gray-900'
                          )}>
                            {inventory?.quantity ?? 0}
                          </span>
                          {isLowStock && !isOutOfStock && (
                            <AlertTriangle className="h-4 w-4 text-warning-500" />
                          )}
                          {isOutOfStock && (
                            <AlertTriangle className="h-4 w-4 text-danger-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? 'default' : 'secondary'}>
                          {product.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir détails
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-danger-600">
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
          </CardContent>
        </Card>

        {/* Add/Edit Product Dialog */}
        <Dialog open={showAddDialog || !!editingProduct} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingProduct(null);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Référence *</Label>
                <Input id="sku" placeholder="ex: CM-PT-50" defaultValue={editingProduct?.sku} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Code-barres</Label>
                <Input id="barcode" placeholder="ex: 1234567890123" defaultValue={editingProduct?.barcode || ''} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nom du produit *</Label>
                <Input id="name" placeholder="Nom du produit" defaultValue={editingProduct?.name} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Description du produit..." defaultValue={editingProduct?.description || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select defaultValue={editingProduct?.categoryId || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unité</Label>
                <Select defaultValue={editingProduct?.unit || 'piece'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une unité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Pièce</SelectItem>
                    <SelectItem value="sac">Sac</SelectItem>
                    <SelectItem value="kg">Kilogramme</SelectItem>
                    <SelectItem value="m">Mètre</SelectItem>
                    <SelectItem value="m2">Mètre carré</SelectItem>
                    <SelectItem value="m3">Mètre cube</SelectItem>
                    <SelectItem value="litre">Litre</SelectItem>
                    <SelectItem value="barre">Barre</SelectItem>
                    <SelectItem value="carton">Carton</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Prix d'achat (FCFA) *</Label>
                <Input id="purchasePrice" type="number" placeholder="0" defaultValue={editingProduct?.purchasePrice} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Prix de vente (FCFA) *</Label>
                <Input id="sellingPrice" type="number" placeholder="0" defaultValue={editingProduct?.sellingPrice} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">TVA (%)</Label>
                <Input id="taxRate" type="number" placeholder="0" defaultValue={editingProduct?.taxRate || 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alertThreshold">Seuil d'alerte stock</Label>
                <Input id="alertThreshold" type="number" placeholder="10" defaultValue={editingProduct?.alertThreshold || 10} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="image">Image du produit</Label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Cliquez ou glissez une image</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false);
                setEditingProduct(null);
              }}>
                Annuler
              </Button>
              <Button>
                {editingProduct ? 'Enregistrer' : 'Créer le produit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
