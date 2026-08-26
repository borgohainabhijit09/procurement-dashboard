import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const deviceCategory = searchParams.get('deviceCategory');

    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let idx = 1;

    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (deviceCategory) { conditions.push(`"deviceCategory" = $${idx++}`); params.push(deviceCategory); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "DeviceStock" ${where} ORDER BY "country" ASC, "deviceCategory" ASC`,
      params
    );
    return NextResponse.json(result.rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching stock:', error);
    return NextResponse.json({ error: 'Failed to fetch stock', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || crypto.randomUUID();
    await query(
      `INSERT INTO "DeviceStock" ("id", "country", "deviceCategory", "model", "quantity", "lastUpdated")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("country", "deviceCategory") DO UPDATE SET
        "quantity" = EXCLUDED."quantity", "model" = EXCLUDED."model", "lastUpdated" = NOW(), "updatedAt" = NOW()`,
      [id, body.country, body.deviceCategory, body.model ?? null, body.quantity || 0]
    );
    const result = await query(`SELECT * FROM "DeviceStock" WHERE "id" = $1`, [id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating stock:', error);
    return NextResponse.json({ error: 'Failed to create stock record', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}
