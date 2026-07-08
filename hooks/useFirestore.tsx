/**
 * Hooks Firestore centralisés avec gestion d'erreur intégrée
 */
import { useState, useEffect } from 'react';
import {
  Query, DocumentData, onSnapshot,
  CollectionReference
} from 'firebase/firestore';

interface UseCollectionOptions {
  enabled?: boolean;
}

interface UseCollectionResult<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
}

export function useCollection<T = DocumentData>(
  query: Query<DocumentData> | CollectionReference<DocumentData> | null,
  options: UseCollectionOptions = {}
): UseCollectionResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = onSnapshot(
      query,
      (snap) => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })) as T[]);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore listener error:', err.code, err.message);
        setIsLoading(false);
        if (err.code === 'permission-denied') {
          setError('Accès refusé. Vérifiez vos permissions.');
        } else if (err.code === 'unavailable') {
          setError('Connexion Firestore perdue. Reconnexion en cours...');
        } else if (err.code === 'failed-precondition') {
          setError("Index Firestore manquant. Contactez l'administrateur.");
        } else {
          setError('Erreur de chargement. Réessayez.');
        }
      }
    );

    return () => unsub();
  }, [query, enabled]);

  return { data, isLoading, error };
}

export function FirestoreErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {error}
    </div>
  );
}
