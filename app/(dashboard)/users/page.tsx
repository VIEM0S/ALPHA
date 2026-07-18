'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, User, Shield, RefreshCw, Eye, EyeOff,
  CheckCircle2, XCircle, Crown, UserCheck, AlertCircle,
  Pencil, Trash2, ShieldAlert, Check, X, Clock, Activity
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils/helpers';
import { useAuthStore } from '@/hooks/store';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';

interface UserProfile {
  id: string; uid: string; email: string;
  firstName: string; lastName: string; phone?: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';
  isActive: boolean; lastLoginAt?: string; createdAt: unknown;
  workingHours?: { start: string; end: string } | null;
  deletedAt?: unknown; deletedBy?: string;
}

interface DeletionRequest {
  id: string; targetUserId: string; targetUserName: string; targetUserRole: string;
  requestedBy: string; requestedByName: string; reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: unknown;
}

const ROLE_CONFIG = {
  OWNER:   { label: 'Propriétaire', color: 'bg-purple-100 text-purple-700', icon: Crown,     desc: 'Accès complet, gestion de l\'abonnement' },
  ADMIN:   { label: 'Administrateur', color: 'bg-red-100 text-red-700',    icon: Shield,    desc: 'Accès complet sauf abonnement' },
  MANAGER: { label: 'Responsable',    color: 'bg-blue-100 text-blue-700',  icon: UserCheck, desc: 'Ventes, stocks, clients, crédits, rapports' },
  CASHIER: { label: 'Caissier',       color: 'bg-green-100 text-green-700',icon: User,      desc: 'POS uniquement' },
};

interface UserForm {
  email: string; password: string; confirmPassword: string;
  firstName: string; lastName: string; phone: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
}
const EMPTY_FORM: UserForm = {
  email: '', password: '', confirmPassword: '',
  firstName: '', lastName: '', phone: '', role: 'MANAGER',
};

interface EditForm {
  uid: string; email: string; firstName: string; lastName: string;
  phone: string; role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  newPassword: string; confirmNewPassword: string;
  workStart: string; workEnd: string;
}
const EMPTY_EDIT_FORM: EditForm = {
  uid: '', email: '', firstName: '', lastName: '',
  phone: '', role: 'MANAGER', newPassword: '', confirmNewPassword: '',
  workStart: '', workEnd: '',
};

export default function UsersPage() {
  const router = useRouter();
  const { tenant, user: currentUser } = useAuthStore();
  const tenantId = tenant?.id;
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Édition ──────────────────────────────────────────────────────────────
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ─── Suppression ──────────────────────────────────────────────────────────
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [respondingTo, setRespondingTo] = useState<{ req: DeletionRequest; action: 'approve' | 'reject' | 'delete_now' | 'revoke_approval' } | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, tenantCol(tenantId, 'users')), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[]);
      setIsLoading(false);
    });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, tenantCol(tenantId, 'user_deletion_requests')), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setDeletionRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as DeletionRequest[]);
    });
  }, [tenantId]);

  const f = (field: keyof UserForm, value: string) => setForm(p => ({ ...p, [field]: value }));

  const handleCreate = async () => {
    if (!tenantId) return;
    if (!form.firstName.trim() || !form.lastName.trim()) { setFormError('Prénom et nom obligatoires'); return; }
    if (!form.email.trim()) { setFormError('Email obligatoire'); return; }
    if (form.password.length < 6) { setFormError('Mot de passe : 6 caractères minimum'); return; }
    if (form.password !== form.confirmPassword) { setFormError('Les mots de passe ne correspondent pas'); return; }

    setIsSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');
      setShowDialog(false);
      setForm(EMPTY_FORM);
      setSuccessMsg(`Compte créé pour ${form.firstName} ${form.lastName}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur interne');
    } finally { setIsSaving(false); }
  };

  const toggleActive = async (u: UserProfile) => {
    if (!tenantId || u.role === 'OWNER' || u.id === currentUser?.id) return;
    try {
      const res = await fetch('/api/users/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, uid: u.id, isActive: !u.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast({
        title: !u.isActive ? 'Utilisateur activé' : 'Utilisateur désactivé',
        description: !u.isActive
          ? `${u.firstName} ${u.lastName} peut à nouveau se connecter.`
          : `${u.firstName} ${u.lastName} est désactivé et son accès a été révoqué immédiatement.`,
      });
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Erreur interne',
        variant: 'destructive',
      });
    }
  };

  const ef = (field: keyof EditForm, value: string) => setEditForm(p => ({ ...p, [field]: value }));

  const handleOpenEdit = (u: UserProfile) => {
    setEditForm({
      uid: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone || '',
      role: (u.role === 'OWNER' ? 'ADMIN' : u.role) as EditForm['role'],
      newPassword: '',
      confirmNewPassword: '',
      workStart: u.workingHours?.start || '',
      workEnd: u.workingHours?.end || '',
    });
    setEditError(null);
    setShowEditPassword(false);
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!tenantId) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) { setEditError('Prénom et nom obligatoires'); return; }
    if (!editForm.email.trim()) { setEditError('Email obligatoire'); return; }
    if (editForm.newPassword && editForm.newPassword.length < 6) { setEditError('Nouveau mot de passe : 6 caractères minimum'); return; }
    if (editForm.newPassword && editForm.newPassword !== editForm.confirmNewPassword) { setEditError('Les mots de passe ne correspondent pas'); return; }

    setIsEditSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          uid: editForm.uid,
          email: editForm.email,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phone: editForm.phone,
          role: editForm.role,
          newPassword: editForm.newPassword || undefined,
          workingHours: (editForm.workStart && editForm.workEnd)
            ? { start: editForm.workStart, end: editForm.workEnd } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');
      setShowEditDialog(false);
      setEditForm(EMPTY_EDIT_FORM);
      toast({ title: 'Utilisateur modifié', description: `${editForm.firstName} ${editForm.lastName} a été mis à jour.` });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Erreur interne');
    } finally { setIsEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!tenantId || !deletingUser) return;
    const requiresJustification = currentUser?.role === 'ADMIN' && ['MANAGER', 'CASHIER'].includes(deletingUser.role);
    if (requiresJustification && deleteReason.trim().length < 5) {
      toast({ title: 'Justification requise', description: 'Explique en quelques mots pourquoi cette suppression est nécessaire.', variant: 'destructive' });
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, uid: deletingUser.id, reason: requiresJustification ? deleteReason.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');
      if (data.pending) {
        toast({ title: 'Demande envoyée', description: `La suppression de ${deletingUser.firstName} ${deletingUser.lastName} attend la validation du Propriétaire.` });
      } else {
        toast({ title: 'Utilisateur supprimé', description: `${deletingUser.firstName} ${deletingUser.lastName} a été retiré du compte.` });
      }
      setDeletingUser(null);
      setDeleteReason('');
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Erreur interne',
        variant: 'destructive',
      });
    } finally { setIsDeleting(false); }
  };

  const handlePurge = async () => {
    if (!tenantId || !purgingUser) return;
    setIsPurging(true);
    try {
      const res = await fetch('/api/users/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, uid: purgingUser.id, confirmName: purgeConfirmText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la purge');
      toast({ title: 'Compte purgé définitivement', description: `${purgingUser.firstName} ${purgingUser.lastName} a été effacé — cette action ne peut plus être annulée.` });
      setPurgingUser(null);
      setPurgeConfirmText('');
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur interne', variant: 'destructive' });
    } finally { setIsPurging(false); }
  };

  const handleRestore = async (u: UserProfile) => {
    if (!tenantId) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/users/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, uid: u.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la restauration');
      toast({ title: 'Compte restauré', description: `${u.firstName} ${u.lastName} peut à nouveau se connecter.` });
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur interne', variant: 'destructive' });
    } finally { setIsDeleting(false); }
  };

  const [purgingUser, setPurgingUser] = useState<UserProfile | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const [isCancellingRequest, setIsCancellingRequest] = useState(false);

  const handleCancelOwnRequest = async (req: DeletionRequest) => {
    setIsCancellingRequest(true);
    try {
      const res = await fetch('/api/users/deletion-requests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: req.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast({ title: 'Demande retirée', description: `Ta demande concernant ${req.targetUserName} a été annulée.` });
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur interne', variant: 'destructive' });
    } finally { setIsCancellingRequest(false); }
  };

  const handleFinalizeApproved = async (req: DeletionRequest) => {
    if (!tenantId) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, uid: req.targetUserId, requestId: req.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');
      toast({ title: 'Compte désactivé', description: `${req.targetUserName} a été désactivé (restaurable depuis la liste).` });
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur interne', variant: 'destructive' });
    } finally { setIsDeleting(false); }
  };

  const handleRespondToRequest = async () => {
    if (!respondingTo) return;
    setIsResponding(true);
    try {
      const res = await fetch('/api/users/deletion-requests/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: respondingTo.req.id, action: respondingTo.action, note: responseNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      const labels = { approve: 'approuvée', reject: 'refusée', delete_now: 'traitée directement', revoke_approval: 'ramenée en attente' };
      toast({ title: 'Demande ' + labels[respondingTo.action], description: `${respondingTo.req.targetUserName}` });
      setRespondingTo(null);
      setResponseNote('');
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur interne', variant: 'destructive' });
    } finally { setIsResponding(false); }
  };

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(currentUser?.role || '');
  const isManagerPlus = ['OWNER', 'ADMIN', 'MANAGER'].includes(currentUser?.role || '');

  const byRole = (role: string) => users.filter(u => u.role === role);

  const RoleBadge = ({ role }: { role: UserProfile['role'] }) => {
    const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.CASHIER;
    const Icon = cfg.icon;
    return <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}><Icon className="h-3 w-3" />{cfg.label}</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
            <p className="text-sm text-gray-500 mt-1">{users.filter(u => u.isActive).length} actif{users.filter(u => u.isActive).length !== 1 ? 's' : ''} sur {users.length}</p>
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={() => { setShowDialog(true); setForm(EMPTY_FORM); setFormError(null); }} className="bg-primary-600 hover:bg-primary-700">
              <Plus className="h-4 w-4 mr-2" />Nouveau compte
            </Button>
          )}
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />{successMsg}
          </div>
        )}

        {/* Demandes de suppression en attente / à finaliser */}
        {(() => {
          const pendingForOwner = currentUser?.role === 'OWNER'
            ? deletionRequests.filter(r => r.status === 'PENDING') : [];
          const approvedPendingFinalization = currentUser?.role === 'OWNER'
            ? deletionRequests.filter(r => r.status === 'APPROVED') : [];
          const approvedForAdmin = currentUser?.role === 'ADMIN'
            ? deletionRequests.filter(r => r.status === 'APPROVED' && r.requestedBy === currentUser?.id) : [];
          const myPending = currentUser?.role === 'ADMIN'
            ? deletionRequests.filter(r => r.status === 'PENDING' && r.requestedBy === currentUser?.id) : [];
          if (pendingForOwner.length === 0 && approvedPendingFinalization.length === 0 && approvedForAdmin.length === 0 && myPending.length === 0) return null;
          return (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                  <ShieldAlert className="h-4 w-4" /> Demandes de suppression
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingForOwner.map(req => (
                  <div key={req.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {req.targetUserName} <span className="text-gray-400 font-normal">({req.targetUserRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">Demandé par {req.requestedByName} — "{req.reason}"</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRespondingTo({ req, action: 'reject' })}>
                        <X className="h-3 w-3 mr-1" />Refuser
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRespondingTo({ req, action: 'approve' })}>
                        <Check className="h-3 w-3 mr-1" />Approuver
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => setRespondingTo({ req, action: 'delete_now' })}>
                        Supprimer moi-même
                      </Button>
                    </div>
                  </div>
                ))}
                {approvedPendingFinalization.map(req => (
                  <div key={req.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-green-200 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {req.targetUserName} <span className="text-gray-400 font-normal">({req.targetUserRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">Approuvé — en attente que {req.requestedByName} finalise</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={() => setRespondingTo({ req, action: 'revoke_approval' })}>
                      Retirer l'approbation
                    </Button>
                  </div>
                ))}
                {approvedForAdmin.map(req => (
                  <div key={req.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-green-200 px-3 py-2.5 text-sm">
                    <p className="text-gray-900">
                      <strong>{req.targetUserName}</strong> — approuvé par le Propriétaire, tu peux finaliser
                    </p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" disabled={isCancellingRequest} onClick={() => handleCancelOwnRequest(req)}>
                        Annuler
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" disabled={isDeleting} onClick={() => handleFinalizeApproved(req)}>
                        Finaliser la suppression
                      </Button>
                    </div>
                  </div>
                ))}
                {myPending.map(req => (
                  <div key={req.id} className="flex items-center justify-between gap-2 text-sm text-gray-600 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      Demande pour <strong className="mx-1">{req.targetUserName}</strong> en attente de validation du Propriétaire.
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" disabled={isCancellingRequest} onClick={() => handleCancelOwnRequest(req)}>
                      Retirer ma demande
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* Rôles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
            const count = byRole(role).length;
            const Icon = cfg.icon;
            return (
              <Card key={role}><CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${cfg.color.replace('text-', 'text-').replace('bg-', 'bg-')} flex items-center justify-center`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-gray-500">{cfg.label}{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </CardContent></Card>
            );
          })}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    {isManagerPlus && <TableHead className="w-36 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${u.role === 'OWNER' ? 'bg-purple-500' : u.role === 'ADMIN' ? 'bg-red-500' : u.role === 'MANAGER' ? 'bg-blue-500' : 'bg-green-500'}`}>
                            {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{u.firstName} {u.lastName}</p>
                            {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                            {u.id === currentUser?.id && <Badge variant="outline" className="text-xs mt-0.5">Vous</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{u.email}</TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell className="text-sm text-gray-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Jamais'}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          u.deletedAt ? 'bg-red-100 text-red-700' : u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.deletedAt ? 'Supprimé' : u.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </TableCell>
                      {isManagerPlus && (
                        <TableCell>
                          {u.deletedAt ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-400">{formatDate(u.deletedAt)}</span>
                              {currentUser?.role === 'OWNER' && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isDeleting} onClick={() => handleRestore(u)}>
                                    Restaurer
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => setPurgingUser(u)}>
                                    Purger
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir l'activité" onClick={() => router.push(`/users/${u.id}/activity`)}>
                              <Activity className="h-4 w-4 text-gray-400" />
                            </Button>
                            {isOwnerOrAdmin && u.role !== 'OWNER' && u.id !== currentUser?.id && (
                              <Switch checked={u.isActive} onCheckedChange={() => toggleActive(u)} />
                            )}
                            {isOwnerOrAdmin && u.role !== 'OWNER' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(u)}>
                                <Pencil className="h-4 w-4 text-gray-500" />
                              </Button>
                            )}
                            {isOwnerOrAdmin && u.role !== 'OWNER' && u.id !== currentUser?.id && !(currentUser?.role === 'ADMIN' && u.role === 'ADMIN') && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingUser(u)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Permissions par rôle</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={role} className={`rounded-lg p-3 border ${cfg.color.includes('purple') ? 'border-purple-200 bg-purple-50' : cfg.color.includes('red') ? 'border-red-200 bg-red-50' : cfg.color.includes('blue') ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${cfg.color.replace('bg-', '').split(' ')[0].replace('100', '600')}`} />
                      <span className="font-medium text-sm">{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-600">{cfg.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog création */}
      <Dialog open={showDialog} onOpenChange={o => { if (!o) setShowDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau compte utilisateur</DialogTitle></DialogHeader>
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input value={form.firstName} onChange={e => f('firstName', e.target.value)} placeholder="Amadou" />
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={form.lastName} onChange={e => f('lastName', e.target.value)} placeholder="Coulibaly" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="utilisateur@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+223 70 00 00 00" />
            </div>
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={form.role} onValueChange={v => f('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                  <SelectItem value="MANAGER">Responsable</SelectItem>
                  <SelectItem value="CASHIER">Caissier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mot de passe *</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => f('password', e.target.value)} placeholder="6 caractères min." className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmer *</Label>
              <Input type="password" value={form.confirmPassword}
                onChange={e => f('confirmPassword', e.target.value)} placeholder="••••••••" />
              {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              ℹ️ L'utilisateur recevra ses identifiants par email. Il pourra modifier son mot de passe depuis les paramètres.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>Annuler</Button>
            <Button onClick={handleCreate} disabled={isSaving} className="bg-primary-600 hover:bg-primary-700">
              {isSaving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Création...</> : 'Créer le compte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Modification */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {editError && (
              <div className="col-span-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{editError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Prénom *</Label>
              <Input value={editForm.firstName} onChange={e => ef('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={editForm.lastName} onChange={e => ef('lastName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={editForm.email} onChange={e => ef('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={editForm.phone} onChange={e => ef('phone', e.target.value)} placeholder="+223 ..." />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Rôle</Label>
              <Select value={editForm.role} onValueChange={v => ef('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                  <SelectItem value="MANAGER">Responsable</SelectItem>
                  <SelectItem value="CASHIER">Caissier</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Ex. : promouvoir un Caissier en Responsable, ou l'inverse.</p>
            </div>
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Horaires habituels (optionnel)</p>
              <p className="text-xs text-gray-400 mb-2">Affiche juste un avertissement dans le POS hors de ces heures — ne bloque jamais l'accès. Laisser vide pour un poste sans horaire fixe (ex. boutique ouverte en continu).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Début</Label>
              <Input type="time" value={editForm.workStart} onChange={e => ef('workStart', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Input type="time" value={editForm.workEnd} onChange={e => ef('workEnd', e.target.value)} />
            </div>
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-medium text-gray-700 mb-2">Réinitialiser le mot de passe (optionnel)</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nouveau mot de passe</Label>
              <div className="relative">
                <Input type={showEditPassword ? 'text' : 'password'} value={editForm.newPassword}
                  onChange={e => ef('newPassword', e.target.value)} placeholder="Laisser vide pour ne pas changer" />
                <button type="button" onClick={() => setShowEditPassword(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmer</Label>
              <Input type="password" value={editForm.confirmNewPassword}
                onChange={e => ef('confirmNewPassword', e.target.value)} placeholder="••••••••" />
              {editForm.newPassword && editForm.confirmNewPassword && editForm.newPassword !== editForm.confirmNewPassword && (
                <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isEditSaving}>Annuler</Button>
            <Button onClick={handleUpdate} disabled={isEditSaving} className="bg-primary-600 hover:bg-primary-700">
              {isEditSaving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Suppression */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) { setDeletingUser(null); setDeleteReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingUser && currentUser?.role === 'ADMIN' && ['MANAGER', 'CASHIER'].includes(deletingUser.role) ? (
                <>Le compte de <strong>{deletingUser.firstName} {deletingUser.lastName}</strong> ({deletingUser.email}) ne sera pas supprimé immédiatement : ta demande, avec justification, sera envoyée au Propriétaire pour validation.</>
              ) : deletingUser && (
                <>Le compte de <strong>{deletingUser.firstName} {deletingUser.lastName}</strong> ({deletingUser.email}) sera désactivé — accès et connexion révoqués immédiatement. Le compte reste restaurable ensuite depuis cette page.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletingUser && currentUser?.role === 'ADMIN' && ['MANAGER', 'CASHIER'].includes(deletingUser.role) && (
            <div className="space-y-1.5">
              <Label>Justification (obligatoire)</Label>
              <Textarea
                value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                placeholder="Pourquoi cette suppression est-elle nécessaire ?"
                rows={3}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Traitement...</> :
                (deletingUser && currentUser?.role === 'ADMIN' && ['MANAGER', 'CASHIER'].includes(deletingUser.role) ? 'Envoyer la demande' : 'Désactiver le compte')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Réponse du Propriétaire à une demande de suppression */}
      <AlertDialog open={!!respondingTo} onOpenChange={(open) => { if (!open) { setRespondingTo(null); setResponseNote(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {respondingTo?.action === 'approve' && 'Approuver la demande ?'}
              {respondingTo?.action === 'reject' && 'Refuser la demande ?'}
              {respondingTo?.action === 'delete_now' && 'Traiter directement ?'}
              {respondingTo?.action === 'revoke_approval' && "Retirer l'approbation ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {respondingTo?.action === 'approve' && <>L'Admin pourra finaliser la suppression de <strong>{respondingTo.req.targetUserName}</strong> depuis sa fiche.</>}
              {respondingTo?.action === 'reject' && <>La demande concernant <strong>{respondingTo.req.targetUserName}</strong> sera classée sans suite.</>}
              {respondingTo?.action === 'delete_now' && <>Le compte de <strong>{respondingTo.req.targetUserName}</strong> sera désactivé immédiatement (connexion bloquée), et restaurable à tout moment depuis la liste des utilisateurs. L'Admin qui a fait la demande sera informé que c'est réglé.</>}
              {respondingTo?.action === 'revoke_approval' && <>L'approbation pour <strong>{respondingTo.req.targetUserName}</strong> est annulée — {respondingTo.req.requestedByName} ne pourra plus finaliser cette suppression. Utile si une réconciliation a eu lieu entre-temps.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label>Note (optionnelle)</Label>
            <Textarea value={responseNote} onChange={e => setResponseNote(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResponding}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRespondToRequest} disabled={isResponding} className={['reject', 'revoke_approval'].includes(respondingTo?.action || '') ? '' : 'bg-red-600 hover:bg-red-700'}>
              {isResponding ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Purge définitive — confirmation renforcée */}
      <AlertDialog open={!!purgingUser} onOpenChange={(open) => { if (!open) { setPurgingUser(null); setPurgeConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Purger définitivement ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              {purgingUser && (
                <>
                  Contrairement à la désactivation, cette action <strong>ne peut pas être annulée</strong> — le profil de{' '}
                  <strong>{purgingUser.firstName} {purgingUser.lastName}</strong> sera effacé définitivement. Son historique de ventes et transactions passées reste conservé séparément (non affecté).
                  <br /><br />
                  Pour confirmer, tape son nom complet : <strong>{purgingUser.firstName} {purgingUser.lastName}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={purgeConfirmText}
            onChange={e => setPurgeConfirmText(e.target.value)}
            placeholder="Nom complet exact"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPurging}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurge}
              disabled={isPurging || !purgingUser || purgeConfirmText.trim().toLowerCase() !== `${purgingUser.firstName} ${purgingUser.lastName}`.trim().toLowerCase()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPurging ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 'Purger définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
