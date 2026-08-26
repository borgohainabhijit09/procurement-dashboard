import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const deviceCategory = searchParams.get('deviceCategory');
    const month = searchParams.get('month');

    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let idx = 1;

    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (deviceCategory) { conditions.push(`"deviceCategory" = $${idx++}`); params.push(deviceCategory); }
    if (month) { conditions.push(`"month" = $${idx++}`); params.push(month); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "BreakfixIncident" ${where} ORDER BY "month" DESC, "country" ASC, "deviceCategory" ASC`,
      params
    );
    return NextResponse.json(result.rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching breakfix:', error);
    return NextResponse.json({ error: 'Failed to fetch breakfix data', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || crypto.randomUUID();
    await query(
      `INSERT INTO "BreakfixIncident" ("id", "country", "deviceCategory", "model", "incidentCount", "month")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("country", "deviceCategory", "month") DO UPDATE SET
        "incidentCount" = EXCLUDED."incidentCount", "model" = EXCLUDED."model", "updatedAt" = NOW()`,
      [id, body.country, body.deviceCategory, body.model ?? null, body.incidentCount || 0, body.month]
    );
    const result = await query(`SELECT * FROM "BreakfixIncident" WHERE "id" = $1`, [id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating breakfix:', error);
    return NextResponse.json({ error: 'Failed to create breakfix record', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}
