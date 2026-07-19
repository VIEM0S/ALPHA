import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import type { Product, Customer } from '@/lib/types';

export function usePosData(tenantId: string | undefined, storeId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const unsubP = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'products')),
        where('isActive', '==', true), orderBy('name')),
      snap => { setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]); setIsLoading(false); }
    );
    const unsubC = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'customers')),
        where('isActive', '==', true), orderBy('createdAt', 'desc')),
      snap => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[])
    );
    const unsubI = onSnapshot(
      query(collection(db, tenantCol(tenantId, 'inventory')), where('storeId', '==', storeId || '')),
      snap => {
        const inv: Record<string, number> = {};
        snap.docs.forEach(d => { inv[d.data().productId] = d.data().quantity || 0; });
        setInventory(inv);
      }
    );
    return () => { unsubP(); unsubC(); unsubI(); };
  }, [tenantId, storeId]);

  return { products, customers, inventory, isLoading };
}
