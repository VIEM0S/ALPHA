import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

async function getSession(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try { return await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await getSession(request);
    if (!decoded) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const tenantId = decoded.tenantId as string;
    if (!tenantId) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 403 });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Requêtes simples sans index composites
    const [salesSnap, productsSnap, inventorySnap, creditsSnap] = await Promise.all([
      // Toutes les ventes du mois — simple orderBy sans where composé
      adminDb.collection(`tenants/${tenantId}/sales`)
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get(),
      // Produits actifs
      adminDb.collection(`tenants/${tenantId}/products`)
        .where('isActive', '==', true)
        .get(),
      // Inventaire stock faible
      adminDb.collection(`tenants/${tenantId}/inventory`)
        .get(),
      // Crédits
      adminDb.collection(`tenants/${tenantId}/credits`)
        .get(),
    ]);

    // Filtrer côté serveur pour éviter les index composites
    const allSales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
    const completedSales = allSales.filter((s: Record<string, unknown>) => s.status === 'COMPLETED');
    const todaySales = completedSales.filter((s: Record<string, unknown>) => typeof s.createdAt === 'string' && s.createdAt >= startOfToday);
    const monthSales = completedSales.filter((s: Record<string, unknown>) => typeof s.createdAt === 'string' && s.createdAt >= startOfMonth);

    const sum = (arr: Record<string, unknown>[]) => arr.reduce((a, s) => a + ((s.total as number) || 0), 0);

    const todayRevenue = sum(todaySales);
    const monthlyRevenue = sum(monthSales);
    const totalProfit = monthSales.reduce((a, s) => {
      const total = (s.total as number) || 0;
      const cost = (s.costTotal as number) || total * 0.7;
      return a + (total - cost);
    }, 0);

    // Stock faible
    const allInventory = inventorySnap.docs.map(d => d.data());
    const prodMap: Record<string, number> = {};
    productsSnap.docs.forEach(d => { prodMap[d.id] = d.data().alertThreshold || 10; });
    const lowStockCount = allInventory.filter(i => (i.quantity || 0) <= (prodMap[i.productId] || 10)).length;

    // Crédits
    const allCredits = creditsSnap.docs.map(d => d.data());
    const activeCredits = allCredits.filter(c => ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(c.status)).length;
    const overdueCredits = allCredits.filter(c => c.status === 'OVERDUE').length;

    // Ventes récentes (10 dernières)
    const recentSales = allSales.slice(0, 10);

    // Top produits du mois — agrégation simple
    const productSales: Record<string, { name: string; sku: string; qty: number; rev: number }> = {};
    for (const sale of monthSales) {
      const items = (sale.items as Record<string, unknown>[]) || [];
      for (const item of items) {
        const pid = item.productId as string;
        if (!pid) continue;
        if (!productSales[pid]) productSales[pid] = { name: item.productName as string, sku: item.productSku as string, qty: 0, rev: 0 };
        productSales[pid].qty += (item.quantity as number) || 0;
        productSales[pid].rev += (item.total as number) || 0;
      }
    }
    const topProducts = Object.entries(productSales)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);

    return NextResponse.json({
      todaySales: todayRevenue,
      yesterdaySales: 0,
      weeklyRevenue: monthlyRevenue,
      monthlyRevenue,
      totalProfit,
      totalProducts: productsSnap.size,
      lowStockCount,
      activeCredits,
      overdueCredits,
      recentSales,
      topProducts,
      totalSalesCount: completedSales.length,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
