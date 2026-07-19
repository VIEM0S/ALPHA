import { Shield, Crown, UserCheck, User } from 'lucide-react';
import type { UserProfile } from './types';

export const ROLE_CONFIG = {
  OWNER:   { label: 'Propriétaire', color: 'bg-purple-100 text-purple-700', icon: Crown,     desc: 'Accès complet, gestion de l\'abonnement' },
  ADMIN:   { label: 'Administrateur', color: 'bg-red-100 text-red-700',    icon: Shield,    desc: 'Accès complet sauf abonnement' },
  MANAGER: { label: 'Responsable',    color: 'bg-blue-100 text-blue-700',  icon: UserCheck, desc: 'Ventes, stocks, clients, crédits, rapports' },
  CASHIER: { label: 'Caissier',       color: 'bg-green-100 text-green-700',icon: User,      desc: 'POS uniquement' },
};

export function RoleBadge({ role }: { role: UserProfile['role'] }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.CASHIER;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}
