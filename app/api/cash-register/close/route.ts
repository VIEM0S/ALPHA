import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const callerTenantId = decoded.tenantId as string;
    const callerUid = decoded.uid as string;

    const {
      tenantId, storeId, registerId,
      openedBy, openedByName, openedAt, openingBalance,
      countedAmount, notes, closedByName,
    } = await request.json();

    if (!tenantId || !storeId || !registerId || openingBalance === undefined || countedAmount === undefined) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // ── Recalcul serveur des ventes du jour pour ce magasin ──────────────────
    // On ne fait JAMAIS confiance aux totaux envoyés par le client : on les
    // recalcule ici à partir des vraies ventes Firestore, pour empêcher un
    // caissier de masquer un manque de caisse en trafiquant la "différence".
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const salesSnap = await adminDb
      .collection(`tenants/${tenantId}/sales`)
      .where('storeId', '==', storeId)
      .where('createdAt', '>=', Timestamp.fromDate(startOfDay))
      .get();

    let salesTotal = 0;
    let cashSalesTotal = 0;
    let txCount = 0;
    salesSnap.forEach((docSnap) => {
      const sale = docSnap.data();
      const total = Number(sale.total) || 0;
      salesTotal += total;
      txCount += 1;
      if ((sale.paymentMethod || 'CASH') === 'CASH') {
        cashSalesTotal += total;
      }
    });

    const openingBal = Number(openingBalance) || 0;
    const counted = Number(countedAmount) || 0;
    const expectedBalance = openingBal + cashSalesTotal;
    const difference = counted - expectedBalance;

    const docRef = await adminDb.collection(`tenants/${tenantId}/cash_sessions`).add({
      tenantId, storeId, registerId,
      openedBy: openedBy || null,
      openedByName: openedByName || null,
      openedAt: openedAt || null,
      openingBalance: openingBal,
      closedBy: callerUid,
      closedByName: closedByName || null,
      closedAt: Date.now(),
      closingBalance: counted,
      expectedBalance,
      difference,
      salesCount: txCount,
      salesTotal,
      cashSalesTotal,
      notes: notes || null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: docRef.id, expectedBalance, difference, cashSalesTotal, salesTotal, txCount });
  } catch (error) {
    console.error('Close cash register error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
