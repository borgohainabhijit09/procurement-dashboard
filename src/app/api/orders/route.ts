import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const country = searchParams.get('country');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (region) { conditions.push(`"region" = $${idx++}`); params.push(region); }
    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (status) { conditions.push(`"status" = $${idx++}`); params.push(status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM "AssetOrder" ${where} ORDER BY "id" ASC`;

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await query(
      `INSERT INTO "AssetOrder" ("id", "bundle", "region", "country", "model", "quantity", "inProgress", "ordered", "inTransit", "delivered", "toBeOrdered", "status", "lastUpdatedBy", "lastUpdatedOn")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [body.id, body.bundle ?? null, body.region, body.country, body.model,
       body.quantity || 0, body.inProgress || 0, body.ordered || 0,
       body.inTransit || 0, body.delivered || 0, body.toBeOrdered || 0,
       body.status ?? null, body.lastUpdatedBy ?? null]
    );
    const result = await query(`SELECT * FROM "AssetOrder" WHERE "id" = $1`, [body.id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}
