import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const status = searchParams.get('status');
    const deviceCategory = searchParams.get('deviceCategory');
    const businessUnit = searchParams.get('businessUnit');
    const month = searchParams.get('month');

    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let idx = 1;

    if (country) { conditions.push(`"country" = $${idx++}`); params.push(country); }
    if (status) { conditions.push(`"status" = $${idx++}`); params.push(status); }
    if (deviceCategory) { conditions.push(`"deviceCategory" = $${idx++}`); params.push(deviceCategory); }
    if (businessUnit) { conditions.push(`"businessUnit" = $${idx++}`); params.push(businessUnit); }
    if (month) { conditions.push(`TO_CHAR("startDate", 'YYYY-MM') = $${idx++}`); params.push(month); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "FutureJoiner" ${where} ORDER BY "startDate" ASC NULLS LAST, "candidateName" ASC`,
      params
    );

    return NextResponse.json(result.rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching joiners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch joiners', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || crypto.randomUUID();
    await query(
      `INSERT INTO "FutureJoiner" ("id", "candidateName", "country", "city", "function", "deviceCategory", "model", "startDate", "status", "hiringManager", "businessUnit", "department")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, body.candidateName, body.country, body.city ?? null, body.function ?? null,
       body.deviceCategory, body.model ?? null, body.startDate ?? null,
       body.status || 'Pending', body.hiringManager ?? null, body.businessUnit ?? null, body.department ?? null]
    );
    const result = await query(`SELECT * FROM "FutureJoiner" WHERE "id" = $1`, [id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating joiner:', error);
    return NextResponse.json(
      { error: 'Failed to create joiner', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}
