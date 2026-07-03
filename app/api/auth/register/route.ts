import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PLAN_LIMITS = {
  STARTER:    { maxUsers: 3,  maxStores: 1,  maxProducts: 500,   posEnabled: true,  analyticsEnabled: false, multiStoreEnabled: false, apiAccessEnabled: false },
  BUSINESS:   { maxUsers: 10, maxStores: 3,  maxProducts: 5000,  posEnabled: true,  analyticsEnabled: true,  multiStoreEnabled: true,  apiAccessEnabled: false },
  ENTERPRISE: { maxUsers: -1, maxStores: -1, maxProducts: -1,    posEnabled: true,  analyticsEnabled: true,  multiStoreEnabled: true,  apiAccessEnabled: true  },
};

export async function POST(request: NextRequest) {
  try {
    const { company, store, user, plan } = await request.json();

    // Validation minimale
    if (!company?.name || !company?.email || !user?.email || !user?.password || !store?.name) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    // 1. Créer le compte Firebase Auth
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.createUser({
        email: user.email,
        password: user.password,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 });
      }
      throw err;
    }

    const uid = firebaseUser.uid;
    const now = new Date().toISOString();
    const tenantSlug = slugify(company.name);
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.BUSINESS;

    // 2. Créer le tenant Firestore
    const tenantRef = adminDb.collection('tenants').doc();
    const tenantId = tenantRef.id;

    // 3. Batch write atomique
    const batch = adminDb.batch();

    // Tenant
    batch.set(tenantRef, {
      name: company.name,
      slug: tenantSlug,
      logo: null,
      email: company.email,
      phone: company.phone || null,
      address: company.address || null,
      city: company.city || null,
      country: company.country || 'Mali',
      rccm: company.rccm || null,
      nif: company.nif || null,
      currency: company.currency || 'XOF',
      timezone: 'Africa/Bamako',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Abonnement (période d'essai 14 jours)
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const subRef = adminDb.collection(`tenants/${tenantId}/subscriptions`).doc(tenantId);
    batch.set(subRef, {
      tenantId,
      plan: plan || 'BUSINESS',
      status: 'TRIAL',
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      limits,
      createdAt: now,
      updatedAt: now,
    });

    // Magasin principal
    const storeRef = adminDb.collection(`tenants/${tenantId}/stores`).doc();
    const storeId = storeRef.id;
    batch.set(storeRef, {
      tenantId,
      name: store.name,
      code: store.code || store.name.slice(0, 3).toUpperCase(),
      address: store.address || null,
      city: store.city || null,
      phone: store.phone || null,
      email: null,
      isWarehouse: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Profil utilisateur (OWNER)
    const userRef = adminDb.collection(`tenants/${tenantId}/users`).doc(uid);
    batch.set(userRef, {
      uid,
      tenantId,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || null,
      avatar: null,
      role: 'OWNER',
      isActive: true,
      emailVerified: false,
      mfaEnabled: false,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    // 4. Injecter les custom claims Firebase Auth
    await adminAuth.setCustomUserClaims(uid, { tenantId, role: 'OWNER' });

    return NextResponse.json({
      success: true,
      tenantId,
      storeId,
      message: 'Compte créé avec succès',
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
