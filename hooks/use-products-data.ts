import { useEffect, useState } from 'react';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import type { Product, Category } from '@/lib/types';

export function useProductsData(tenantId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

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

    const qCats = query(
      collection(db, tenantCol(tenantId, 'categories')),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const unsubCats = onSnapshot(qCats, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[];
      setCategories(data);
    });

    return () => { unsubProducts(); unsubCats(); };
  }, [tenantId]);

  return { products, categories, isLoading };
}
