import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';

interface OrderItemInput {
  productId: string;
  quantityOrdered: number;
  unitCost: number;
}

// Crée un bon de commande fournisseur en statut DRAFT ou SENT.
// N'impacte JAMAIS le stock — le stock n'est mis à jour qu'à la réception,
// via /api/purchase-orders/receive (cf. la même logique que checkout : le
// stock ne bouge que sur un endpoint serveur dédié et transactionnel).
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const callerRole = decoded.role as string;
    const callerTenantId = decoded.tenantId as string;
    const callerUid = decoded.uid as string;

    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(callerRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const {
      tenantId, storeId, supplierId, items, notes, expectedDate, status, createdByName,
    }: {
      tenantId: string; storeId: string; supplierId: string; items: OrderItemInput[];
      notes?: string; expectedDate?: string; status?: 'DRAFT' | 'SENT'; createdByName?: string;
    } = await request.json();

    if (!tenantId || !storeId || !supplierId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Données manquantes ou commande vide' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supplierSnap = await adminDb.doc(`tenants/${tenantId}/suppliers/${supplierId}`).get();
    if (!supplierSnap.exists) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });
    }

    // ── Récupérer les produits réels pour figer nom/SKU au moment de la commande ──
    const productSnaps = await Promise.all(
      items.map(it => adminDb.doc(`tenants/${tenantId}/products/${it.productId}`).get())
    );
    for (let i = 0; i < productSnaps.length; i++) {
      if (!productSnaps[i].exists) {
        return NextResponse.json({ error: `Produit introuvable (${items[i].productId})` }, { status: 404 });
      }
    }

    const lines = items.map((it, i) => {
      const p = productSnaps[i].data()!;
      const quantityOrdered = Math.max(1, Math.floor(Number(it.quantityOrdered) || 0));
      const unitCost = Math.max(0, Number(it.unitCost) || 0);
      return {
        productId: it.productId,
        productName: p.name,
        productSku: p.sku,
        quantityOrdered,
        quantityReceived: 0,
        unitCost,
        total: quantityOrdered * unitCost,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);

    // Référence lisible : BC-2026-0001 (numéro séquentiel simple basé sur le compteur du tenant)
    const counterRef = adminDb.doc(`tenants/${tenantId}/_counters/purchase_orders`);
    const reference = await adminDb.runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const next = (counterSnap.exists ? counterSnap.data()!.value : 0) + 1;
      tx.set(counterRef, { value: next }, { merge: true });
      const year = new Date().getFullYear();
      return `BC-${year}-${String(next).padStart(4, '0')}`;
    });

    const poRef = adminDb.collection(`tenants/${tenantId}/purchase_orders`).doc();
    await poRef.set({
      tenantId, reference, supplierId, storeId,
      status: status === 'SENT' ? 'SENT' : 'DRAFT',
      items: lines,
      subtotal,
      notes: notes || null,
      expectedDate: expectedDate || null,
      createdBy: callerUid,
      createdByName: createdByName || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      receivedAt: null,
    });

    return NextResponse.json({ success: true, id: poRef.id, reference });
  } catch (error) {
    console.error('Create purchase order error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
