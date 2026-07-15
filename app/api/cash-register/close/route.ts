import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminRtdb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';
import { RTDB_PATHS } from '@/lib/firebase/rtdb';

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
      countedAmount, notes, closedByName,
    } = await request.json();

    if (!tenantId || !storeId || !registerId || countedAmount === undefined) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }
    if (tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // ── Session RTDB = source de vérité, jamais le corps de la requête ──────
    // openingBalance/openedBy/openedAt viennent de la caisse ouverte en RTDB,
    // pas du client : sinon un caissier pourrait appeler cette route hors UI
    // avec un openingBalance falsifié pour masquer un manque de caisse.
    const rtdbPath = RTDB_PATHS.cashRegister(tenantId, registerId);
    const liveSnap = await adminRtdb.ref(rtdbPath).get();
    if (!liveSnap.exists()) {
      return NextResponse.json({ error: 'Aucune caisse ouverte trouvée' }, { status: 404 });
    }
    const liveSession = liveSnap.val() as {
      status?: string; openedBy?: string; openedByName?: string;
      openedAt?: number; openingBalance?: number;
    };
    if (liveSession.status !== 'OPEN') {
      return NextResponse.json({ error: 'Cette caisse est déjà fermée' }, { status: 409 });
    }
    const openedBy = liveSession.openedBy ?? null;
    const openedByName = liveSession.openedByName ?? null;
    const openedAt = liveSession.openedAt ?? null;
    const openingBalance = liveSession.openingBalance ?? 0;

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

    // ── Marquer la caisse RTDB comme fermée côté serveur (source de vérité) ──
    // Le client refait aussi ce `set` après coup ; on le fait déjà ici pour
    // que l'état soit cohérent même si l'appel client échoue après ce point.
    await adminRtdb.ref(rtdbPath).set({ status: 'CLOSED', closedAt: Date.now() });

    return NextResponse.json({ success: true, id: docRef.id, expectedBalance, difference, cashSalesTotal, salesTotal, txCount });
  } catch (error) {
    console.error('Close cash register error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
