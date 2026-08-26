import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const records = await request.json();
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }
    const BATCH_SIZE = 25;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors: any[] = [];
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        for (const r of batch) {
          const id = r.id || crypto.randomUUID();
          await query(
            `INSERT INTO "FutureLeaver" ("id", "employeeName", "country", "city", "function", "deviceCategory", "model", "lastWorkingDay", "status")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT ("id") DO UPDATE SET
              "employeeName" = EXCLUDED."employeeName", "country" = EXCLUDED."country",
              "city" = EXCLUDED."city", "function" = EXCLUDED."function",
              "deviceCategory" = EXCLUDED."deviceCategory", "model" = EXCLUDED."model",
              "lastWorkingDay" = EXCLUDED."lastWorkingDay", "status" = EXCLUDED."status",
              "updatedAt" = NOW()`,
            [id, r.employeeName, r.country, r.city ?? null, r.function ?? null,
             r.deviceCategory, r.model ?? null, r.lastWorkingDay ?? null, r.status || 'Pending']
          );
        }
        results.push(...batch);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        errors.push({ batchIndex: Math.floor(i / BATCH_SIZE) + 1, message: err.message || String(err) });
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Partial failure', successCount: results.length, failedBatches: errors }, { status: 207 });
    }
    return NextResponse.json({ success: true, count: results.length });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error in bulk leavers upload:', error);
    return NextResponse.json({ error: 'Failed to upload', message: error?.message || String(error) }, { status: 500 });
  }
}
