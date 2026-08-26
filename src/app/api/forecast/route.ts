import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryFilter = searchParams.get('country');
    const categoryFilter = searchParams.get('deviceCategory');

    // 1. Get future joiners grouped by month, country, deviceCategory
    const joiners = await query(`
      SELECT
        TO_CHAR("startDate", 'YYYY-MM') AS month,
        "country", "deviceCategory",
        COUNT(*) AS joiner_count
      FROM "FutureJoiner"
      WHERE "startDate" IS NOT NULL
        AND "startDate" >= DATE_TRUNC('month', NOW())
        AND "status" != 'Cancelled'
      GROUP BY TO_CHAR("startDate", 'YYYY-MM'), "country", "deviceCategory"
      ORDER BY month ASC
    `);

    // 2. Get future leavers grouped by month, country, deviceCategory
    const leavers = await query(`
      SELECT
        TO_CHAR("lastWorkingDay", 'YYYY-MM') AS month,
        "country", "deviceCategory",
        COUNT(*) AS leaver_count
      FROM "FutureLeaver"
      WHERE "lastWorkingDay" IS NOT NULL
        AND "lastWorkingDay" >= DATE_TRUNC('month', NOW())
        AND "status" != 'Cancelled'
      GROUP BY TO_CHAR("lastWorkingDay", 'YYYY-MM'), "country", "deviceCategory"
      ORDER BY month ASC
    `);

    // 3. Get breakfix run-rate: average monthly incidents per country, deviceCategory
    //    Use last 3 months of data as the baseline run-rate
    const breakfixRate = await query(`
      SELECT
        "country", "deviceCategory",
        ROUND(AVG("incidentCount")) AS avg_monthly_incidents
      FROM "BreakfixIncident"
      WHERE "month" >= TO_CHAR(NOW() - INTERVAL '3 months', 'YYYY-MM')
      GROUP BY "country", "deviceCategory"
    `);

    // 4. Get current stock
    const stock = await query(`
      SELECT "country", "deviceCategory", "quantity" AS stock_quantity
      FROM "DeviceStock"
    `);

    // Build lookup maps
    const joinerMap = new Map<string, number>();
    for (const r of joiners.rows) {
      const key = `${r.month}|${r.country}|${r.deviceCategory}`;
      joinerMap.set(key, Number(r.joiner_count));
    }

    const leaverMap = new Map<string, number>();
    for (const r of leavers.rows) {
      const key = `${r.month}|${r.country}|${r.deviceCategory}`;
      leaverMap.set(key, Number(r.leaver_count));
    }

    const breakfixMap = new Map<string, number>();
    for (const r of breakfixRate.rows) {
      const key = `${r.country}|${r.deviceCategory}`;
      breakfixMap.set(key, Number(r.avg_monthly_incidents));
    }

    const stockMap = new Map<string, number>();
    for (const r of stock.rows) {
      const key = `${r.country}|${r.deviceCategory}`;
      stockMap.set(key, Number(r.stock_quantity));
    }

    // Determine forecast months: current month + next 3 months
    const now = new Date();
    const forecastMonths: string[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      forecastMonths.push(d.toISOString().slice(0, 7));
    }

    // Collect all country+category combos from all sources
    const combos = new Set<string>();
    for (const r of joiners.rows) combos.add(`${r.country}|${r.deviceCategory}`);
    for (const r of leavers.rows) combos.add(`${r.country}|${r.deviceCategory}`);
    for (const r of breakfixRate.rows) combos.add(`${r.country}|${r.deviceCategory}`);
    for (const r of stock.rows) combos.add(`${r.country}|${r.deviceCategory}`);

    // Build monthly forecast per country+category
    type ForecastRow = {
      month: string;
      country: string;
      deviceCategory: string;
      joiners: number;
      leavers: number;
      breakfixRunRate: number;
      demand: number;
      netDemand: number;
      currentStock: number;
      procurementNeed: number;
    };

    const forecastRows: ForecastRow[] = [];
    const summaryByCategory: Record<string, { joiners: number; leavers: number; breakfix: number; demand: number; stock: number; toProcure: number }> = {};
    const summaryByCountry: Record<string, { joiners: number; leavers: number; breakfix: number; demand: number; stock: number; toProcure: number }> = {};
    let totalJoiners = 0, totalLeavers = 0, totalBreakfix = 0, totalDemand = 0, totalStock = 0, totalProcure = 0;

    for (const combo of combos) {
      const [country, deviceCategory] = combo.split('|');
      if (countryFilter && country !== countryFilter) continue;
      if (categoryFilter && deviceCategory !== categoryFilter) continue;

      const avgBreakfix = breakfixMap.get(combo) || 0;

      for (const month of forecastMonths) {
        const j = joinerMap.get(`${month}|${combo}`) || 0;
        const l = leaverMap.get(`${month}|${combo}`) || 0;
        const demand = j + avgBreakfix;
        const netDemand = Math.max(0, demand - l);
        const currentStock = stockMap.get(combo) || 0;
        const remainingStock = Math.max(0, currentStock - forecastRows.filter(r => r.country === country && r.deviceCategory === deviceCategory).reduce((s, r) => s + r.procurementNeed, 0));
        const procurementNeed = Math.max(0, netDemand - remainingStock);

        forecastRows.push({
          month, country, deviceCategory,
          joiners: j, leavers: l, breakfixRunRate: avgBreakfix,
          demand, netDemand, currentStock, procurementNeed,
        });

        totalJoiners += j;
        totalLeavers += l;
        totalBreakfix += avgBreakfix;
        totalDemand += demand;
        totalStock = Math.max(totalStock, currentStock);
        totalProcure += procurementNeed;

        // Category summary
        if (!summaryByCategory[deviceCategory]) summaryByCategory[deviceCategory] = { joiners: 0, leavers: 0, breakfix: 0, demand: 0, stock: 0, toProcure: 0 };
        summaryByCategory[deviceCategory].joiners += j;
        summaryByCategory[deviceCategory].leavers += l;
        summaryByCategory[deviceCategory].breakfix += avgBreakfix;
        summaryByCategory[deviceCategory].demand += demand;
        summaryByCategory[deviceCategory].stock = Math.max(summaryByCategory[deviceCategory].stock, currentStock);
        summaryByCategory[deviceCategory].toProcure += procurementNeed;

        // Country summary
        if (!summaryByCountry[country]) summaryByCountry[country] = { joiners: 0, leavers: 0, breakfix: 0, demand: 0, stock: 0, toProcure: 0 };
        summaryByCountry[country].joiners += j;
        summaryByCountry[country].leavers += l;
        summaryByCountry[country].breakfix += avgBreakfix;
        summaryByCountry[country].demand += demand;
        summaryByCountry[country].stock = Math.max(summaryByCountry[country].stock, currentStock);
        summaryByCountry[country].toProcure += procurementNeed;
      }
    }

    return NextResponse.json({
      forecastMonths,
      forecast: forecastRows,
      summary: {
        totalJoiners,
        totalLeavers,
        totalBreakfixRunRate: totalBreakfix,
        totalDemand,
        currentStock: totalStock,
        totalToProcure: totalProcure,
      },
      byCategory: Object.entries(summaryByCategory).map(([category, v]) => ({ category, ...v })),
      byCountry: Object.entries(summaryByCountry).map(([country, v]) => ({ country, ...v })),
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error computing forecast:', error);
    return NextResponse.json(
      { error: 'Failed to compute forecast', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}
