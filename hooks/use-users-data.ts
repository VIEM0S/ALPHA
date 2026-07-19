import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { tenantCol } from '@/lib/firebase/collections';
import type { UserProfile, DeletionRequest } from '@/components/users/types';

export function useUsersData(tenantId: string | undefined) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return { users, deletionRequests, isLoading };
}
