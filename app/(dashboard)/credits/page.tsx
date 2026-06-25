'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  User,
  Calendar
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
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate, cn } from '@/lib/utils/helpers';

interface Credit {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  saleReference: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: Date;
  daysOverdue: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

const mockCredits: Credit[] = [
  { id: 'cr1', reference: 'CRE-2024-0001', customerName: 'Construction Express SARL', customerPhone: '+223 79 98 76 54', saleReference: 'SAL-2024-000145', totalAmount: 350000, paidAmount: 150000, remainingAmount: 200000, dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), daysOverdue: 0, status: 'PARTIALLY_PAID' },
  { id: 'cr2', reference: 'CRE-2024-0002', customerName: 'Mamadou Traore', customerPhone: '+223 77 55 44 33', saleReference: 'SAL-2024-000142', totalAmount: 125000, paidAmount: 50000, remainingAmount: 75000, dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), daysOverdue: 5, status: 'OVERDUE' },
  { id: 'cr3', reference: 'CRE-2024-0003', customerName: 'Amadou Diallo', customerPhone: '+223 70 12 34 56', saleReference: 'SAL-2024-000139', totalAmount: 85000, paidAmount: 85000, remainingAmount: 0, dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), daysOverdue: 0, status: 'PAID' },
  { id: 'cr4', reference: 'CRE-2024-0004', customerName: 'Materiaux du Sud', customerPhone: '+223 20 30 40 50', saleReference: 'SAL-2024-000137', totalAmount: 750000, paidAmount: 0, remainingAmount: 750000, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), daysOverdue: 0, status: 'PENDING' },
  { id: 'cr5', reference: 'CRE-2024-0005', customerName: 'Fatou Keita', customerPhone: '+223 66 11 22 33', saleReference: 'SAL-2024-000135', totalAmount: 45000, paidAmount: 45000, remainingAmount: 0, dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), daysOverdue: 0, status: 'PAID' },
  { id: 'cr6', reference: 'CRE-2024-0006', customerName: 'Alioune Diarra', customerPhone: '+223 65 43 21 98', saleReference: 'SAL-2024-000130', totalAmount: 180000, paidAmount: 60000, remainingAmount: 120000, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), daysOverdue: 0, status: 'PARTIALLY_PAID' },
];

export default function CreditsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const filteredCredits = mockCredits.filter((credit) => {
    const matchesSearch = credit.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      credit.reference.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || credit.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalCredits = mockCredits.reduce((sum, c) => sum + c.remainingAmount, 0);
  const overdueCredits = mockCredits.filter(c => c.status === 'OVERDUE');
  const overdueAmount = overdueCredits.reduce((sum, c) => sum + c.remainingAmount, 0);

  const getStatusConfig = (status: Credit['status']) => {
    switch (status) {
      case 'PENDING':
        return { label: 'En attente', color: 'warning' };
      case 'PARTIALLY_PAID':
        return { label: 'Partiel', color: 'accent' };
      case 'PAID':
        return { label: 'Payé', color: 'success' };
      case 'OVERDUE':
        return { label: 'En retard', color: 'danger' };
    }
  };

  const handlePayment = () => {
    setSelectedCredit(null);
    setShowPaymentDialog(false);
    setPaymentAmount(0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des crédits</h1>
            <p className="text-gray-500">Suivez les créances clients et paiements</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Crédits actifs</p>
                  <p className="text-2xl font-bold">{mockCredits.filter(c => c.status !== 'PAID').length}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total impayé</p>
                  <p className="text-2xl font-bold text-warning-600">{formatCurrency(totalCredits)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-warning-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En retard</p>
                  <p className="text-2xl font-bold text-danger-600">{overdueCredits.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-danger-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Montant en retard</p>
                  <p className="text-2xl font-bold text-danger-600">{formatCurrency(overdueAmount)}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-danger-200" />
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
                  placeholder="Rechercher par client ou référence..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Tous' },
                  { value: 'OVERDUE', label: 'En retard', color: 'danger' },
                  { value: 'PARTIALLY_PAID', label: 'Partiel', color: 'accent' },
                  { value: 'PENDING', label: 'En attente', color: 'warning' },
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={selectedStatus === filter.value ? 'default' : 'outline'}
                    onClick={() => setSelectedStatus(filter.value)}
                    className={filter.color && selectedStatus !== filter.value ? `text-${filter.color}-600` : ''}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Créance</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Montant total</TableHead>
                  <TableHead>Payé</TableHead>
                  <TableHead>Reste</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCredits.map((credit) => {
                  const statusConfig = getStatusConfig(credit.status);
                  const progress = (credit.paidAmount / credit.totalAmount) * 100;

                  return (
                    <TableRow key={credit.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{credit.reference}</p>
                          <p className="text-xs text-gray-500">{credit.saleReference}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{credit.customerName}</p>
                            <p className="text-xs text-gray-500">{credit.customerPhone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(credit.totalAmount)}</TableCell>
                      <TableCell>{formatCurrency(credit.paidAmount)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className={cn(
                            'font-semibold',
                            credit.remainingAmount > 0 ? 'text-warning-600' : 'text-success-600'
                          )}>
                            {formatCurrency(credit.remainingAmount)}
                          </p>
                          <div className="h-1 w-16 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className={cn(
                              'text-sm',
                              credit.daysOverdue > 0 && 'text-danger-600 font-medium'
                            )}>
                              {formatDate(credit.dueDate)}
                            </p>
                            {credit.daysOverdue > 0 && (
                              <p className="text-xs text-danger-500">
                                {credit.daysOverdue} jours de retard
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          statusConfig.color === 'danger' && 'border-danger-300 text-danger-600',
                          statusConfig.color === 'warning' && 'border-warning-300 text-warning-600',
                          statusConfig.color === 'success' && 'border-success-300 text-success-600',
                          statusConfig.color === 'accent' && 'border-accent-300 text-accent-600'
                        )}>
                          {statusConfig.label}
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
                            {credit.status !== 'PAID' && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedCredit(credit);
                                setPaymentAmount(credit.remainingAmount);
                                setShowPaymentDialog(true);
                              }}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Enregistrer paiement
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Phone className="h-4 w-4 mr-2" />
                              Appeler client
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Envoyer rappel
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

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
              <DialogDescription>
                Créance: {selectedCredit?.reference} - {selectedCredit?.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Montant total</span>
                  <span className="font-medium">{selectedCredit && formatCurrency(selectedCredit.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Déjà payé</span>
                  <span>{selectedCredit && formatCurrency(selectedCredit.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Reste à payer</span>
                  <span className="text-warning-600">{selectedCredit && formatCurrency(selectedCredit.remainingAmount)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Montant du paiement</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex gap-2">
                {[selectedCredit?.remainingAmount && selectedCredit.remainingAmount * 0.5, selectedCredit?.remainingAmount]?.map((amount, i) => (
                  amount && (
                    <Button key={i} variant="outline" size="sm" onClick={() => setPaymentAmount(amount)}>
                      {formatCurrency(amount)}
                    </Button>
                  )
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handlePayment}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmer le paiement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
