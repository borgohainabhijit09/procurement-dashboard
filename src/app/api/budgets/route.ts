import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const period = searchParams.get('period');

    const conditions: string[] = [];
    const params: string[] = [];
    let idx = 1;

    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (period) { conditions.push(`"halfYearPeriod" = $${idx++}`); params.push(period); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "CountryBudget" ${where} ORDER BY "country", "halfYearPeriod" ASC`,
      params
    );
    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budgets', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || `BUD-${body.country}-${body.halfYearPeriod}`;

    await query(
      `INSERT INTO "CountryBudget" ("id", "country", "halfYearPeriod", "approvedBudget", "lastUpdatedBy", "lastUpdatedOn")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("country", "halfYearPeriod") DO UPDATE SET
         "approvedBudget" = EXCLUDED."approvedBudget",
         "lastUpdatedBy" = EXCLUDED."lastUpdatedBy",
         "lastUpdatedOn" = NOW()`,
      [id, body.country, body.halfYearPeriod, body.approvedBudget || 0, body.lastUpdatedBy || null]
    );

    const result = await query('SELECT * FROM "CountryBudget" WHERE "id" = $1', [id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating budget:', error);
    return NextResponse.json(
      { error: 'Failed to create budget', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
