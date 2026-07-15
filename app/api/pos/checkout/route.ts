import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';

interface CheckoutItem {
  productId: string;
  quantity: number;
  discount?: number; // % de remise ligne, optionnel (ex. négociation manager)
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const callerTenantId = decoded.tenantId as string;
    const callerUid = decoded.uid as string;

    const {
      tenantId, storeId, items, customerId,
      paymentMethod, amountReceived, discountPercent,
      userName,
    }: {
      tenantId: string; storeId: string; items: CheckoutItem[]; customerId?: string | null;
      paymentMethod: string; amountReceived?: number; discountPercent?: number; userName?: string;
    } = await request.json();

    if (!tenantId || !storeId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide ou données manquantes' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    if (!['CASH', 'MOBILE_MONEY', 'CARD', 'CREDIT'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Mode de paiement invalide' }, { status: 400 });
    }

    // ── Client (si vente à crédit) ──────────────────────────────────────────
    let customer: FirebaseFirestore.DocumentData | null = null;
    let customerRef: FirebaseFirestore.DocumentReference | null = null;
    if (customerId) {
      customerRef = adminDb.doc(`tenants/${tenantId}/customers/${customerId}`);
      const cSnap = await customerRef.get();
      if (!cSnap.exists) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
      customer = cSnap.data()!;
    }
    if (paymentMethod === 'CREDIT' && !customer) {
      return NextResponse.json({ error: 'Client requis pour une vente à crédit' }, { status: 400 });
    }

    // ── Récupérer les produits réels (source de vérité pour prix & coût) ────
    const productSnaps = await Promise.all(
      items.map(it => adminDb.doc(`tenants/${tenantId}/products/${it.productId}`).get())
    );
    for (let i = 0; i < productSnaps.length; i++) {
      if (!productSnaps[i].exists) {
        return NextResponse.json({ error: `Produit introuvable (${items[i].productId})` }, { status: 404 });
      }
    }
    const products = productSnaps.map(s => ({ id: s.id, ...s.data() } as {
      id: string; name: string; sku: string; sellingPrice: number; purchasePrice: number;
      taxRate: number; trackInventory: boolean;
    }));

    // ── Calcul des totaux côté serveur (jamais depuis le client) ────────────
    const lines = items.map((it, i) => {
      const p = products[i];
      const discount = Math.min(Math.max(Number(it.discount) || 0, 0), 100); // clamp 0-100%
      const quantity = Math.max(1, Math.floor(Number(it.quantity) || 0));
      const unitPrice = p.sellingPrice;
      const tax = p.taxRate || 0;
      const lineTotal = quantity * unitPrice * (1 - discount / 100) * (1 + tax / 100);
      return { product: p, quantity, discount, unitPrice, tax, lineTotal };
    });

    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - l.discount / 100), 0);
    const taxTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - l.discount / 100) * (l.tax / 100), 0);
    const cartDiscountPercent = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
    const discountAmount = subtotal * (cartDiscountPercent / 100);
    const total = Math.round((subtotal + taxTotal - discountAmount) * 100) / 100;
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

    const acompte = paymentMethod === 'CREDIT' ? Math.max(0, Math.min(Number(amountReceived) || 0, total)) : total;
    const soldeCredit = paymentMethod === 'CREDIT' ? Math.max(0, total - acompte) : 0;

    // Fix : le plafond de crédit du client (customer.creditLimit) n'était jamais
    // vérifié — un client pouvait accumuler une dette illimitée.
    if (paymentMethod === 'CREDIT' && soldeCredit > 0 && customer) {
      const creditLimit = Number(customer.creditLimit) || 0;
      const creditUsed = Number(customer.creditUsed) || 0;
      if (creditUsed + soldeCredit > creditLimit) {
        const disponible = Math.max(0, creditLimit - creditUsed);
        return NextResponse.json(
          { error: `Plafond de crédit dépassé pour ce client. Crédit disponible : ${disponible} FCFA.` },
          { status: 400 }
        );
      }
    }

    const receivedCash = paymentMethod === 'CASH' ? (Number(amountReceived) || total) : acompte;
    if (paymentMethod === 'CASH' && receivedCash < total) {
      return NextResponse.json({ error: 'Montant reçu insuffisant' }, { status: 400 });
    }
    const change = paymentMethod === 'CASH' ? Math.max(0, receivedCash - total) : 0;

    // ── Stock : vérifier + trouver les docs inventory concernés ─────────────
    const invRefs: Record<string, { ref: FirebaseFirestore.DocumentReference; qty: number }> = {};
    for (const l of lines) {
      if (!l.product.trackInventory) continue;
      const invSnap = await adminDb
        .collection(`tenants/${tenantId}/inventory`)
        .where('productId', '==', l.product.id)
        .where('storeId', '==', storeId)
        .limit(1)
        .get();
      if (invSnap.empty) continue;
      invRefs[l.product.id] = { ref: invSnap.docs[0].ref, qty: invSnap.docs[0].data().quantity || 0 };
    }

    const saleRef = adminDb.collection(`tenants/${tenantId}/sales`).doc();
    const customerName = customer
      ? (customer.customerType === 'BUSINESS' ? customer.companyName : `${customer.firstName || ''} ${customer.lastName || ''}`.trim())
      : null;

    // ── Transaction atomique : vérifie + décrémente le stock, crée la vente ─
    await adminDb.runTransaction(async (tx) => {
      // ── Toutes les lectures d'abord (obligatoire dans une transaction) ────
      const freshQtys: Record<string, number> = {};
      for (const l of lines) {
        const inv = invRefs[l.product.id];
        if (!inv) continue;
        const fresh = await tx.get(inv.ref);
        freshQtys[l.product.id] = fresh.data()?.quantity || 0;
      }
      // ── Puis toutes les écritures ──────────────────────────────────────────
      for (const l of lines) {
        const inv = invRefs[l.product.id];
        if (!inv) continue;
        const freshQty = freshQtys[l.product.id];
        if (freshQty < l.quantity) {
          throw new Error(`Stock insuffisant pour "${l.product.name}" (${freshQty} disponible, ${l.quantity} demandé)`);
        }
        tx.update(inv.ref, { quantity: freshQty - l.quantity, updatedAt: FieldValue.serverTimestamp() });
      }
      tx.set(saleRef, {
        tenantId, storeId, userId: callerUid,
        customerId: customerId || null,
        customerName,
        subtotal, discountPercent: cartDiscountPercent, discountAmount, tax: taxTotal, total,
        status: 'COMPLETED',
        paymentMethod, acompte, soldeCredit,
        amountReceived: receivedCash, change,
        itemCount,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // ── Sous-collections (hors transaction) ──────────────────────────────────
    const batchWrites: Promise<unknown>[] = [];
    let saleCostTotal = 0;
    for (const l of lines) {
      const lineCostTotal = l.quantity * l.product.purchasePrice;
      saleCostTotal += lineCostTotal;
      batchWrites.push(
        adminDb.collection(`tenants/${tenantId}/sales/${saleRef.id}/sale_items`).add({
          productId: l.product.id,
          productName: l.product.name,
          productSku: l.product.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          tax: l.tax,
          total: l.lineTotal,
          // Le coût d'achat n'est PAS stocké ici : ce document est lisible par
          // tous les rôles (reçus, historique des ventes). Il vit séparément
          // dans cost_summary, réservé aux Managers+.
        })
      );
      const inv = invRefs[l.product.id];
      if (inv) {
        batchWrites.push(
          adminDb.collection(`tenants/${tenantId}/inventory_movements`).add({
            tenantId, productId: l.product.id, storeId,
            type: 'SALE', quantity: -l.quantity,
            previousQuantity: inv.qty,
            newQuantity: inv.qty - l.quantity,
            saleId: saleRef.id,
            reason: 'Vente POS',
            createdAt: FieldValue.serverTimestamp(),
          })
        );
      }
    }
    batchWrites.push(
      adminDb.collection(`tenants/${tenantId}/sales/${saleRef.id}/payments`).add({
        method: paymentMethod, amount: total,
        amountReceived: receivedCash, change,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
    // Coût réel de la vente, réservé aux Managers+ (voir firestore.rules)
    batchWrites.push(
      adminDb.doc(`tenants/${tenantId}/sales/${saleRef.id}/cost_summary/data`).set({
        tenantId,
        costTotal: saleCostTotal,
        margin: total - saleCostTotal,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
    await Promise.all(batchWrites);

    // ── Crédit client ────────────────────────────────────────────────────────
    if (paymentMethod === 'CREDIT' && soldeCredit > 0 && customerId && customerRef) {
      const echeance = new Date();
      echeance.setDate(echeance.getDate() + 30);
      const creditRef = await adminDb.collection(`tenants/${tenantId}/credits`).add({
        tenantId, saleId: saleRef.id,
        customerId, customerName,
        customerPhone: customer?.phone || null,
        montantTotal: total, acompte, solde: soldeCredit,
        dateEcheance: echeance.toISOString().split('T')[0],
        status: 'PENDING',
        userId: callerUid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (acompte > 0) {
        await adminDb.collection(`tenants/${tenantId}/credits/${creditRef.id}/credit_payments`).add({
          creditId: creditRef.id, montant: acompte,
          soldeAvant: total, soldeApres: soldeCredit,
          userId: callerUid,
          userName: userName || null,
          note: 'Acompte versé lors de la vente',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await customerRef.update({
        creditUsed: (customer?.creditUsed || 0) + soldeCredit,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, saleId: saleRef.id, total, change });
  } catch (error) {
    console.error('POS checkout error:', error);
    const msg = error instanceof Error ? error.message : 'Erreur interne';
    // Les erreurs de stock insuffisant sont utiles à afficher telles quelles
    const isStockError = msg.startsWith('Stock insuffisant');
    return NextResponse.json({ error: isStockError ? msg : 'Erreur lors de la finalisation de la vente' }, { status: isStockError ? 409 : 500 });
  }
}
