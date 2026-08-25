import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const orders = await request.json();
    
    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'No orders provided in request' }, { status: 400 });
    }

    const BATCH_SIZE = 25;
    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      try {
        for (const order of batch) {
          await query(
            `INSERT INTO "AssetOrder" ("id", "bundle", "region", "country", "model", "quantity", "inProgress", "ordered", "inTransit", "delivered", "toBeOrdered", "status", "lastUpdatedBy", "lastUpdatedOn")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
             ON CONFLICT ("id") DO UPDATE SET
              "bundle" = EXCLUDED."bundle", "region" = EXCLUDED."region", "country" = EXCLUDED."country",
              "model" = EXCLUDED."model", "quantity" = EXCLUDED."quantity", "inProgress" = EXCLUDED."inProgress",
              "ordered" = EXCLUDED."ordered", "inTransit" = EXCLUDED."inTransit", "delivered" = EXCLUDED."delivered",
              "toBeOrdered" = EXCLUDED."toBeOrdered", "status" = EXCLUDED."status",
              "lastUpdatedBy" = EXCLUDED."lastUpdatedBy", "lastUpdatedOn" = NOW()`,
            [order.id, order.bundle ?? null, order.region, order.country, order.model,
             order.quantity || 0, order.inProgress || 0, order.ordered || 0,
             order.inTransit || 0, order.delivered || 0, order.toBeOrdered || 0,
             order.status ?? null, order.lastUpdatedBy ?? null]
          );
        }
        results.push(...batch);
      } catch (err: any) {
        console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err);
        errors.push({
          batchIndex: Math.floor(i / BATCH_SIZE) + 1,
          startIndex: i,
          endIndex: i + batch.length - 1,
          message: err.message || String(err)
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Partial failure during bulk upload', successCount: results.length, failedBatches: errors },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error('Error in bulk upload:', error);
    return NextResponse.json(
      { error: 'Failed to upload bulk orders', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}
