import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // For demo purposes, return mock data
    // In production, this would fetch from the database based on tenant context
    const mockStats = {
      todaySales: 1250000,
      yesterdaySales: 985000,
      weeklyRevenue: 7500000,
      monthlyRevenue: 28500000,
      totalProfit: 8500000,
      totalProducts: 1245,
      lowStockCount: 23,
      activeCredits: 15,
      overdueCredits: 3,
      recentSales: [
        {
          id: '1',
          reference: 'SAL-2024-000123',
          total: 125000,
          customer_name: 'Amadou Diallo',
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          payment_method: 'CASH',
        },
        {
          id: '2',
          reference: 'SAL-2024-000122',
          total: 85000,
          customer_name: 'Fatou Keita',
          created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          payment_method: 'MOBILE_MONEY',
        },
        {
          id: '3',
          reference: 'SAL-2024-000121',
          total: 350000,
          customer_name: 'Construction Express SARL',
          created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          payment_method: 'CREDIT',
        },
        {
          id: '4',
          reference: 'SAL-2024-000120',
          total: 45000,
          customer_name: null,
          created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
          payment_method: 'CASH',
        },
        {
          id: '5',
          reference: 'SAL-2024-000119',
          total: 190000,
          customer_name: 'Mamadou Traore',
          created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
          payment_method: 'CASH',
        },
      ],
      topProducts: [
        { id: '1', name: 'Ciment Portland 50kg', sku: 'CM-PT-50', quantity_sold: 156, revenue: 2340000 },
        { id: '2', name: 'Fer à béton 12mm', sku: 'FR-12', quantity_sold: 245, revenue: 1715000 },
        { id: '3', name: 'Peinture blanche 20L', sku: 'PT-BL-20', quantity_sold: 89, revenue: 1335000 },
        { id: '4', name: 'Ciment Portland 25kg', sku: 'CM-PT-25', quantity_sold: 98, revenue: 980000 },
        { id: '5', name: 'Carreaux carrelage 40x40', sku: 'CR-4040', quantity_sold: 450, revenue: 900000 },
      ],
      salesTrend: generateSalesTrend(),
    };

    return NextResponse.json(mockStats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateSalesTrend() {
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trend.push({
      date: date.toISOString().split('T')[0],
      sales: Math.floor(Math.random() * 50) + 20,
      revenue: Math.floor(Math.random() * 5000000) + 1000000,
    });
  }
  return trend;
}
