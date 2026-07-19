import { useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Product } from '@/lib/types';

interface DeleteProductDialogProps {
  tenantId: string | undefined;
  product: Product | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProductDialog({ tenantId, product, onOpenChange }: DeleteProductDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!tenantId || !product) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, tenantCol(tenantId, 'products'), product.id));
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={!!product} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{product?.name}</strong> sera définitivement supprimé.
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
