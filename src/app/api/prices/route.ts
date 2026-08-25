import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const model = searchParams.get('model');
    const monthYear = searchParams.get('monthYear');

    const conditions: string[] = [];
    const params: string[] = [];
    let idx = 1;

    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (model) { conditions.push(`"model" = $${idx++}`); params.push(model); }
    if (monthYear) { conditions.push(`"monthYear" = $${idx++}`); params.push(monthYear); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "ModelPrice" ${where} ORDER BY "country", "model", "monthYear" ASC`,
      params
    );
    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || `MP-${body.model}-${body.country}-${body.monthYear}`;

    await query(
      `INSERT INTO "ModelPrice" ("id", "model", "country", "pricePerUnit", "monthYear", "lastUpdatedBy", "lastUpdatedOn")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ("model", "country", "monthYear") DO UPDATE SET
         "pricePerUnit" = EXCLUDED."pricePerUnit",
         "lastUpdatedBy" = EXCLUDED."lastUpdatedBy",
         "lastUpdatedOn" = NOW()`,
      [id, body.model, body.country, body.pricePerUnit, body.monthYear, body.lastUpdatedBy || null]
    );

    const result = await query('SELECT * FROM "ModelPrice" WHERE "id" = $1', [id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating price:', error);
    return NextResponse.json(
      { error: 'Failed to create price', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
