'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/store';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/lib/types';

/**
 * Garde-fou de rôle au niveau d'une page du dashboard.
 *
 * Fix : avant ce composant, rien (ni middleware.ts, ni un layout, ni les
 * pages elles-mêmes) ne redirigeait un utilisateur non autorisé qui accédait
 * directement à une URL sensible (ex. un CASHIER tapant /users). Seul
 * sidebar-nav.tsx cachait le lien, ce qui n'est qu'un confort visuel, pas
 * une protection.
 *
 * Note importante : les données restaient déjà protégées côté serveur (API
 * Admin SDK + firestore.rules) — donc ce n'était pas une fuite de données,
 * juste une mauvaise UX (page vide ou erreurs de lecture au lieu d'un vrai
 * message d'accès refusé). Ce composant corrige l'UX ; il ne remplace pas
 * la sécurité côté serveur, qui reste la vraie ligne de défense.
 *
 * Usage, en tête de la page concernée :
 *   export default function UsersPage() {
 *     const allowed = useRequireRole(['OWNER', 'ADMIN']);
 *     if (!allowed) return null;
 *     ...
 *   }
 */
export function useRequireRole(roles: UserRole[]): boolean {
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasWarned = useRef(false);

  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (isLoading) return; // attendre la fin du chargement de session avant de juger
    if (!user) return; // pas connecté : laissé au middleware/redirection de login existants
    if (!allowed && !hasWarned.current) {
      hasWarned.current = true;
      toast({
        title: 'Accès non autorisé',
        description: "Vous n'avez pas les droits nécessaires pour accéder à cette page.",
        variant: 'destructive',
      });
      router.replace('/dashboard');
    }
  }, [isLoading, user, allowed, router, toast]);

  return isLoading ? false : allowed;
}

/** Variante composant, pour envelopper directement le JSX d'une page si préféré au hook. */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const allowed = useRequireRole(roles);
  if (!allowed) return null;
  return <>{children}</>;
}
