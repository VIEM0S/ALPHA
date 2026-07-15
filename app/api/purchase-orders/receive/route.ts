import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';

interface ReceiveLine {
  productId: string;
  quantityReceivedNow: number; // quantité reçue lors de CETTE réception (peut être partielle)
}

// Réceptionne tout ou partie d'un bon de commande fournisseur :
//  - incrémente le stock (inventory) du magasin de destination
//  - crée un mouvement de stock ('IN') par produit, pour garder l'historique
//  - met à jour purchasePrice du produit avec le dernier coût d'achat connu
//  - marque la ligne du PO comme reçue (quantityReceived cumulatif)
//  - passe le PO à RECEIVED si tout est reçu, sinon PARTIALLY_RECEIVED
//
// Tout se fait dans une transaction Firestore (lectures avant écritures),
// même logique défensive que /api/pos/checkout pour éviter les races sur le stock.
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
      tenantId, purchaseOrderId, lines,
    }: { tenantId: string; purchaseOrderId: string; lines: ReceiveLine[] } = await request.json();

    if (!tenantId || !purchaseOrderId || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const poRef = adminDb.doc(`tenants/${tenantId}/purchase_orders/${purchaseOrderId}`);
    const poSnap = await poRef.get();
    if (!poSnap.exists) return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 });
    const po = poSnap.data()!;
    if (!['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      return NextResponse.json({ error: `Impossible de réceptionner un bon ${po.status}` }, { status: 409 });
    }
    const storeId = po.storeId as string;

    type POLine = { productId: string; productName: string; productSku: string; quantityOrdered: number; quantityReceived: number; unitCost: number; total: number };
    const poItems: POLine[] = po.items;

    // Valider les quantités reçues demandées par rapport au reste à recevoir
    const receiveMap = new Map(lines.map(l => [l.productId, Math.max(0, Math.floor(Number(l.quantityReceivedNow) || 0))]));
    for (const item of poItems) {
      const qty = receiveMap.get(item.productId) || 0;
      const remaining = item.quantityOrdered - item.quantityReceived;
      if (qty > remaining) {
        return NextResponse.json(
          { error: `Quantité reçue (${qty}) supérieure au reste attendu (${remaining}) pour "${item.productName}"` },
          { status: 400 }
        );
      }
    }

    // ── Trouver/préparer les docs d'inventaire concernés ─────────────────────
    const invRefs: Record<string, { ref: FirebaseFirestore.DocumentReference; exists: boolean }> = {};
    for (const item of poItems) {
      const qtyNow = receiveMap.get(item.productId) || 0;
      if (qtyNow <= 0) continue;
      const invSnap = await adminDb
        .collection(`tenants/${tenantId}/inventory`)
        .where('productId', '==', item.productId)
        .where('storeId', '==', storeId)
        .limit(1)
        .get();
      if (invSnap.empty) {
        // Pas encore de ligne d'inventaire pour ce produit/magasin : on la crée
        invRefs[item.productId] = { ref: adminDb.collection(`tenants/${tenantId}/inventory`).doc(), exists: false };
      } else {
        invRefs[item.productId] = { ref: invSnap.docs[0].ref, exists: true };
      }
    }

    const updatedItems: POLine[] = [];
    const movementsToWrite: Array<{ productId: string; productName: string; qty: number; previousQuantity: number; newQuantity: number; unitCost: number }> = [];

    await adminDb.runTransaction(async (tx) => {
      // ── Lectures d'abord ────────────────────────────────────────────────
      const freshQtys: Record<string, number> = {};
      for (const item of poItems) {
        const inv = invRefs[item.productId];
        if (!inv) continue;
        if (inv.exists) {
          const fresh = await tx.get(inv.ref);
          freshQtys[item.productId] = fresh.data()?.quantity || 0;
        } else {
          freshQtys[item.productId] = 0;
        }
      }

      // ── Écritures ────────────────────────────────────────────────────────
      for (const item of poItems) {
        const qtyNow = receiveMap.get(item.productId) || 0;
        const newQuantityReceived = item.quantityReceived + qtyNow;
        updatedItems.push({ ...item, quantityReceived: newQuantityReceived });

        if (qtyNow <= 0) continue;
        const inv = invRefs[item.productId];
        const previousQuantity = freshQtys[item.productId] || 0;
        const newQuantity = previousQuantity + qtyNow;

        if (inv.exists) {
          tx.update(inv.ref, { quantity: newQuantity, updatedAt: FieldValue.serverTimestamp() });
        } else {
          tx.set(inv.ref, {
            tenantId, productId: item.productId, storeId,
            quantity: newQuantity, minQuantity: 0, maxQuantity: null, reorderPoint: null,
            lastStockCheck: FieldValue.serverTimestamp(),
          });
        }
        movementsToWrite.push({
          productId: item.productId, productName: item.productName,
          qty: qtyNow, previousQuantity, newQuantity, unitCost: item.unitCost,
        });

        // Met à jour le dernier coût d'achat connu du produit (utile pour le
        // prochain checkout POS, où purchasePrice sert au calcul de marge).
        tx.update(adminDb.doc(`tenants/${tenantId}/products/${item.productId}`), {
          purchasePrice: item.unitCost,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      const allReceived = updatedItems.every(i => i.quantityReceived >= i.quantityOrdered);
      const anyReceived = updatedItems.some(i => i.quantityReceived > 0);
      const newStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

      tx.update(poRef, {
        items: updatedItems,
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
        receivedAt: allReceived ? FieldValue.serverTimestamp() : po.receivedAt || null,
      });
    });

    // ── Mouvements de stock (hors transaction, comme dans checkout) ─────────
    await Promise.all(movementsToWrite.map(m =>
      adminDb.collection(`tenants/${tenantId}/inventory_movements`).add({
        tenantId, productId: m.productId, storeId,
        type: 'IN', quantity: m.qty,
        previousQuantity: m.previousQuantity,
        newQuantity: m.newQuantity,
        purchaseOrderId,
        unitCost: m.unitCost,
        reason: `Réception bon de commande ${po.reference}`,
        createdBy: callerUid,
        createdAt: FieldValue.serverTimestamp(),
      })
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Receive purchase order error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
