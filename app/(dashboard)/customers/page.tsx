'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  User,
  Building2,
  Phone,
  Mail,
  CreditCard,
  DollarSign,
  Receipt,
  Filter
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { formatCurrency, cn } from '@/lib/utils/helpers';
import type { Customer } from '@/lib/types';

const mockCustomers: Customer[] = [
  { id: 'c1', tenantId: 't1', code: 'CLI-001', firstName: 'Amadou', lastName: 'Diallo', companyName: null, email: 'amadou@email.com', phone: '+223 70 12 34 56', address: 'Badalabougou', city: 'Bamako', customerType: 'INDIVIDUAL', creditLimit: 100000, creditUsed: 25000, notes: 'Client régulier', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'c2', tenantId: 't1', code: 'CLI-002', firstName: null, lastName: null, companyName: 'Construction Express SARL', email: 'contact@construction-express.ml', phone: '+223 79 98 76 54', address: 'Zone Industrielle', city: 'Bamako', customerType: 'BUSINESS', creditLimit: 500000, creditUsed: 150000, notes: 'Client VIP - conditions spéciales', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'c3', tenantId: 't1', code: 'CLI-003', firstName: 'Fatou', lastName: 'Keita', companyName: null, email: 'fatou.k@mail.com', phone: '+223 66 11 22 33', address: 'Hamdallaye', city: 'Bamako', customerType: 'INDIVIDUAL', creditLimit: 50000, creditUsed: 0, notes: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'c4', tenantId: 't1', code: 'CLI-004', firstName: 'Mamadou', lastName: 'Traore', companyName: null, email: 'm.traore@gmail.com', phone: '+223 77 55 44 33', address: 'Kalabancoura', city: 'Bamako', customerType: 'INDIVIDUAL', creditLimit: 75000, creditUsed: 45000, notes: 'Semble retard dans paiements', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'c5', tenantId: 't1', code: 'CLI-005', firstName: null, lastName: null, companyName: 'Materiaux du Sud', email: 'info@materiaux-sud.ml', phone: '+223 20 30 40 50', address: 'Route de Ségou', city: 'Bamako', customerType: 'BUSINESS', creditLimit: 1000000, creditUsed: 250000, notes: 'Gros client - achats mensuels', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'c6', tenantId: 't1', code: 'CLI-006', firstName: 'Aissata', lastName: 'Coulibaly', companyName: null, email: null, phone: '+223 90 12 34 56', address: 'Niamakoro', city: 'Bamako', customerType: 'INDIVIDUAL', creditLimit: 30000, creditUsed: 0, notes: null, isActive: false, createdAt: new Date(), updatedAt: new Date() },
];

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = mockCustomers.filter((c) => {
    const matchesSearch =
      c.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || c.customerType === selectedType;
    return matchesSearch && matchesType;
  });

  const getCreditUsagePercent = (customer: Customer) => {
    if (customer.creditLimit === 0) return 0;
    return (customer.creditUsed / customer.creditLimit) * 100;
  };

  const getCreditStatus = (customer: Customer) => {
    const percent = getCreditUsagePercent(customer);
    if (percent >= 80) return { label: 'Limite atteinte', color: 'danger' };
    if (percent >= 50) return { label: 'Utilisation élevée', color: 'warning' };
    return { label: 'Normal', color: 'success' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-500">Gérez votre base de données clients</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau client
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total clients</p>
                  <p className="text-2xl font-bold">{mockCustomers.filter(c => c.isActive).length}</p>
                </div>
                <User className="h-8 w-8 text-primary-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Particuliers</p>
                  <p className="text-2xl font-bold">
                    {mockCustomers.filter(c => c.customerType === 'INDIVIDUAL' && c.isActive).length}
                  </p>
                </div>
                <User className="h-8 w-8 text-success-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Entreprises</p>
                  <p className="text-2xl font-bold">
                    {mockCustomers.filter(c => c.customerType === 'BUSINESS' && c.isActive).length}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-accent-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Crédits utilisés</p>
                  <p className="text-2xl font-bold text-warning-600">
                    {formatCurrency(mockCustomers.reduce((sum, c) => sum + c.creditUsed, 0))}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-warning-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, téléphone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="INDIVIDUAL">Particuliers</SelectItem>
                  <SelectItem value="BUSINESS">Entreprises</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Limite crédit</TableHead>
                  <TableHead>Crédit utilisé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const creditStatus = getCreditStatus(customer);

                  return (
                    <TableRow key={customer.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-primary-600">
                              {customer.companyName?.charAt(0) || customer.firstName?.charAt(0) || 'A'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                            </p>
                            <p className="text-xs text-gray-500">{customer.code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span>{customer.phone}</span>
                          </div>
                          {customer.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[200px]">{customer.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.customerType === 'BUSINESS' ? 'secondary' : 'outline'}>
                          {customer.customerType === 'BUSINESS' ? 'Entreprise' : 'Particulier'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(customer.creditLimit)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              'font-medium',
                              customer.creditUsed > 0 ? 'text-warning-600' : 'text-gray-900'
                            )}>
                              {formatCurrency(customer.creditUsed)}
                            </span>
                          </div>
                          <div className="h-1 w-20 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                creditStatus.color === 'danger' ? 'bg-danger-500' :
                                  creditStatus.color === 'warning' ? 'bg-warning-500' : 'bg-success-500'
                              )}
                              style={{ width: `${getCreditUsagePercent(customer)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                          {customer.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Receipt className="h-4 w-4 mr-2" />
                              Historique achats
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Gérer crédits
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

        {/* Add/Edit Customer Dialog */}
        <Dialog open={showAddDialog || !!editingCustomer} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingCustomer(null);
          }
        }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? 'Modifier le client' : 'Nouveau client'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type de client</Label>
                <Select defaultValue={editingCustomer?.customerType || 'INDIVIDUAL'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Particulier</SelectItem>
                    <SelectItem value="BUSINESS">Entreprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code client</Label>
                <Input id="code" placeholder="Auto-généré" defaultValue={editingCustomer?.code} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" placeholder="Prénom" defaultValue={editingCustomer?.firstName || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" placeholder="Nom" defaultValue={editingCustomer?.lastName || ''} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="company">Nom de l'entreprise</Label>
                <Input id="company" placeholder="Si entreprise" defaultValue={editingCustomer?.companyName || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input id="phone" type="tel" placeholder="+223 XX XX XX XX" defaultValue={editingCustomer?.phone || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="email@exemple.com" defaultValue={editingCustomer?.email || ''} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" placeholder="Adresse" defaultValue={editingCustomer?.address || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" placeholder="Bamako" defaultValue={editingCustomer?.city || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Limite de crédit (FCFA)</Label>
                <Input id="creditLimit" type="number" placeholder="0" defaultValue={editingCustomer?.creditLimit || 0} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" placeholder="Notes internes..." defaultValue={editingCustomer?.notes || ''} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false);
                setEditingCustomer(null);
              }}>
                Annuler
              </Button>
              <Button>
                {editingCustomer ? 'Enregistrer' : 'Créer le client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
