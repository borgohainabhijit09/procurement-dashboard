import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const status = searchParams.get('status');
    const deviceCategory = searchParams.get('deviceCategory');
    const month = searchParams.get('month');

    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let idx = 1;

    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (status) { conditions.push(`"status" = $${idx++}`); params.push(status); }
    if (deviceCategory) { conditions.push(`"deviceCategory" = $${idx++}`); params.push(deviceCategory); }
    if (month) { conditions.push(`TO_CHAR("lastWorkingDay", 'YYYY-MM') = $${idx++}`); params.push(month); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "FutureLeaver" ${where} ORDER BY "lastWorkingDay" ASC NULLS LAST, "employeeName" ASC`,
      params
    );
    return NextResponse.json(result.rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching leavers:', error);
    return NextResponse.json({ error: 'Failed to fetch leavers', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || crypto.randomUUID();
    await query(
      `INSERT INTO "FutureLeaver" ("id", "employeeName", "country", "city", "function", "deviceCategory", "model", "lastWorkingDay", "status")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, body.employeeName, body.country, body.city ?? null, body.function ?? null,
       body.deviceCategory, body.model ?? null, body.lastWorkingDay ?? null, body.status || 'Pending']
    );
    const result = await query(`SELECT * FROM "FutureLeaver" WHERE "id" = $1`, [id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating leaver:', error);
    return NextResponse.json({ error: 'Failed to create leaver', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}
