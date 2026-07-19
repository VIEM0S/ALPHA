import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { FakeFirestore, fakeFieldValue } from './helpers/fake-firestore';

// ── Mocks (déclarés avant les imports du module testé, via vi.hoisted) ─────
const { dbHolder, authMock } = vi.hoisted(() => ({
  dbHolder: { current: null as FakeFirestore | null },
  authMock: { verifySessionCookie: vi.fn() },
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: authMock,
  adminDb: {
    doc: (p: string) => dbHolder.current!.doc(p),
    collection: (p: string) => dbHolder.current!.collection(p),
    runTransaction: (cb: any) => dbHolder.current!.runTransaction(cb),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: fakeFieldValue,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (_name: string) => ({ value: 'fake-session-cookie' }) }),
}));

// Importé APRÈS les mocks ci-dessus (obligatoire avec vi.mock).
const { POST } = await import('@/app/api/pos/checkout/route');

const TENANT_ID = 'tenant1';
const STORE_ID = 'store1';
const USER_ID = 'user1';
const CUSTOMER_ID = 'cust1';
const PRODUCT_ID = 'prod1';

function seedBaseData(db: FakeFirestore, opts?: { creditUsed?: number; creditLimit?: number }) {
  db.seed(`tenants/${TENANT_ID}/products/${PRODUCT_ID}`, {
    name: 'Clous 4cm', sku: 'CLOU-4', sellingPrice: 1000, purchasePrice: 700,
    taxRate: 0, trackInventory: false,
  });
  db.seed(`tenants/${TENANT_ID}/customers/${CUSTOMER_ID}`, {
    firstName: 'Amadou', lastName: 'Traoré', customerType: 'INDIVIDUAL',
    creditUsed: opts?.creditUsed ?? 0,
    creditLimit: opts?.creditLimit ?? 100000,
  });
}

function makeRequest(body: Record<string, unknown>, offlineSyncId?: string) {
  return new NextRequest('http://localhost/api/pos/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(offlineSyncId ? { 'X-Offline-Sync-Id': offlineSyncId } : {}),
    },
    body: JSON.stringify(body),
  });
}

function creditSalePayload(soldeCredit: number) {
  return {
    tenantId: TENANT_ID, storeId: STORE_ID,
    items: [{ productId: PRODUCT_ID, quantity: 1 }], // 1 x 1000 FCFA = total 1000
    customerId: CUSTOMER_ID,
    paymentMethod: 'CREDIT',
    // acompte choisi pour que soldeCredit = total - acompte = soldeCredit voulu
    amountReceived: Math.max(0, 1000 - soldeCredit),
    discountPercent: 0,
    userName: 'Testeur',
  };
}

describe('POST /api/pos/checkout — plafond de crédit (course corrigée)', () => {
  beforeEach(() => {
    dbHolder.current = new FakeFirestore();
    authMock.verifySessionCookie.mockResolvedValue({ tenantId: TENANT_ID, uid: USER_ID });
  });

  it('incrémente creditUsed de façon atomique sur deux ventes à crédit successives (pas d\'écrasement)', async () => {
    const db = dbHolder.current!;
    seedBaseData(db, { creditUsed: 0, creditLimit: 100000 });

    // Deux ventes à crédit de 1000 FCFA chacune (aucun acompte), pour le même client.
    const res1 = await POST(makeRequest(creditSalePayload(1000)));
    expect(res1.status).toBe(200);
    const res2 = await POST(makeRequest(creditSalePayload(1000)));
    expect(res2.status).toBe(200);

    const customer = db.read(`tenants/${TENANT_ID}/customers/${CUSTOMER_ID}`);
    // Avec l'ancien bug (lecture non fraîche + addition manuelle hors transaction),
    // la 2e écriture aurait écrasé la 1re : creditUsed serait resté à 1000 au lieu de 2000.
    expect(customer?.creditUsed).toBe(2000);
  });

  it('refuse la vente si le plafond de crédit est dépassé (lecture fraîche) et n\'écrit rien', async () => {
    const db = dbHolder.current!;
    seedBaseData(db, { creditUsed: 9500, creditLimit: 10000 }); // il ne reste que 500 FCFA de crédit

    const res = await POST(makeRequest(creditSalePayload(1000))); // demande 1000 FCFA de crédit
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/Plafond de crédit dépassé/);

    // La transaction doit avoir été entièrement annulée (rollback) : creditUsed inchangé.
    const customer = db.read(`tenants/${TENANT_ID}/customers/${CUSTOMER_ID}`);
    expect(customer?.creditUsed).toBe(9500);
  });

  it('accepte la vente pile au plafond (égalité, pas de dépassement strict)', async () => {
    const db = dbHolder.current!;
    seedBaseData(db, { creditUsed: 9000, creditLimit: 10000 });

    const res = await POST(makeRequest(creditSalePayload(1000))); // amène creditUsed exactement à 10000
    expect(res.status).toBe(200);

    const customer = db.read(`tenants/${TENANT_ID}/customers/${CUSTOMER_ID}`);
    expect(customer?.creditUsed).toBe(10000);
  });

  it('en synchronisation offline, laisse passer le dépassement de plafond (vente déjà eu lieu physiquement) sans lever d\'erreur', async () => {
    const db = dbHolder.current!;
    seedBaseData(db, { creditUsed: 9500, creditLimit: 10000 });

    const res = await POST(makeRequest(creditSalePayload(1000), 'offline-attempt-1'));
    expect(res.status).toBe(200);

    const customer = db.read(`tenants/${TENANT_ID}/customers/${CUSTOMER_ID}`);
    expect(customer?.creditUsed).toBe(10500); // dépassement accepté, à régulariser manuellement
  });

  it('ne modifie pas creditUsed pour un paiement CASH (aucun crédit utilisé)', async () => {
    const db = dbHolder.current!;
    seedBaseData(db, { creditUsed: 0, creditLimit: 100000 });

    const res = await POST(makeRequest({
      tenantId: TENANT_ID, storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      customerId: null, paymentMethod: 'CASH', amountReceived: 1000,
      discountPercent: 0, userName: 'Testeur',
    }));
    expect(res.status).toBe(200);

    const customer = db.read(`tenants/${TENANT_ID}/customers/${CUSTOMER_ID}`);
    expect(customer?.creditUsed).toBe(0);
  });

  it('rejette une requête dont le tenantId ne correspond pas au token décodé (isolation multi-tenant)', async () => {
    const db = dbHolder.current!;
    seedBaseData(db);
    authMock.verifySessionCookie.mockResolvedValue({ tenantId: 'autre-tenant', uid: USER_ID });

    const res = await POST(makeRequest(creditSalePayload(500)));
    expect(res.status).toBe(403);
  });
});
