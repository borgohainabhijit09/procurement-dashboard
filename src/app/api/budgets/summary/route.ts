import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PERIOD_ORDER: Record<string, number> = {};
const PERIODS = ['H1-2025', 'H2-2025', 'H1-2026', 'H2-2026', 'H1-2027', 'H2-2027'];
PERIODS.forEach((p, i) => { PERIOD_ORDER[p] = i; });

function previousPeriod(period: string): string | null {
  const idx = PERIOD_ORDER[period];
  if (idx === undefined || idx === 0) return null;
  return PERIODS[idx - 1];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'H2-2026';
    const prev = previousPeriod(period);

    // 1. Fetch budgets for current period
    const budgetResult = await query(
      `SELECT "country", "approvedBudget" FROM "CountryBudget" WHERE "halfYearPeriod" = $1`,
      [period]
    );

    // 2. Fetch budgets for previous period (for carryover)
    const prevBudgetMap: Record<string, number> = {};
    if (prev) {
      const prevBudgetResult = await query(
        `SELECT "country", "approvedBudget" FROM "CountryBudget" WHERE "halfYearPeriod" = $1`,
        [prev]
      );
      for (const row of prevBudgetResult.rows) {
        prevBudgetMap[row.country] = Number(row.approvedBudget);
      }
    }

    // 3. Fetch actual spend per country for current period (from slots with prices)
    const spendResult = await query(
      `SELECT a."country", COALESCE(SUM(os."orderedQty" * COALESCE(os."pricePerUnit", 0)), 0) AS "totalSpend"
       FROM "AssetOrder" a
       LEFT JOIN "OrderSlot" os ON os."assetOrderId" = a."id"
       WHERE a."halfYearPeriod" = $1
       GROUP BY a."country"`,
      [period]
    );

    // 4. Fetch actual spend for previous period (for carryover calculation)
    const prevSpendMap: Record<string, number> = {};
    if (prev) {
      const prevSpendResult = await query(
        `SELECT a."country", COALESCE(SUM(os."orderedQty" * COALESCE(os."pricePerUnit", 0)), 0) AS "totalSpend"
         FROM "AssetOrder" a
         LEFT JOIN "OrderSlot" os ON os."assetOrderId" = a."id"
         WHERE a."halfYearPeriod" = $1
         GROUP BY a."country"`,
        [prev]
      );
      for (const row of prevSpendResult.rows) {
        prevSpendMap[row.country] = Number(row.totalSpend);
      }
    }

    // 5. Build summary per country
    const countrySet = new Set<string>();
    for (const row of budgetResult.rows) countrySet.add(row.country);
    for (const row of spendResult.rows) countrySet.add(row.country);

    const budgetMap: Record<string, number> = {};
    for (const row of budgetResult.rows) {
      budgetMap[row.country] = Number(row.approvedBudget);
    }

    const spendMap: Record<string, number> = {};
    for (const row of spendResult.rows) {
      spendMap[row.country] = Number(row.totalSpend);
    }

    const summary = Array.from(countrySet).map(country => {
      const approved = budgetMap[country] || 0;
      const spent = spendMap[country] || 0;
      const prevApproved = prevBudgetMap[country] || 0;
      const prevSpent = prevSpendMap[country] || 0;
      const carryover = Math.max(0, prevApproved - prevSpent);
      const totalAvailable = approved + carryover;
      const remaining = Math.max(0, totalAvailable - spent);
      const utilization = totalAvailable > 0 ? (spent / totalAvailable) * 100 : 0;

      return {
        country,
        approved,
        spent,
        carryover,
        totalAvailable,
        remaining,
        utilization: Math.round(utilization * 10) / 10,
      };
    }).sort((a, b) => a.country.localeCompare(b.country));

    // 6. Aggregate totals
    const totals = summary.reduce(
      (acc, s) => ({
        approved: acc.approved + s.approved,
        spent: acc.spent + s.spent,
        carryover: acc.carryover + s.carryover,
        totalAvailable: acc.totalAvailable + s.totalAvailable,
        remaining: acc.remaining + s.remaining,
      }),
      { approved: 0, spent: 0, carryover: 0, totalAvailable: 0, remaining: 0 }
    );

    const totalUtilization = totals.totalAvailable > 0
      ? Math.round((totals.spent / totals.totalAvailable) * 1000) / 10
      : 0;

    return NextResponse.json({
      period,
      previousPeriod: prev,
      summary,
      totals: { ...totals, utilization: totalUtilization },
      availablePeriods: PERIODS.filter(p => PERIOD_ORDER[p] <= PERIOD_ORDER[period] + 1),
    });
  } catch (error: unknown) {
    console.error('Error fetching budget summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget summary', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
