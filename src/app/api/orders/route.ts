import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const country = searchParams.get('country');
    const status = searchParams.get('status');
    const period = searchParams.get('period');

    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let idx = 1;

    if (region) { conditions.push(`a."region" = $${idx++}`); params.push(region); }
    if (country) { conditions.push(`a."country" = $${idx++}`); params.push(country); }
    if (status) { conditions.push(`a."status" = $${idx++}`); params.push(status); }
    if (period) { conditions.push(`a."halfYearPeriod" = $${idx++}`); params.push(period); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        a."id", a."bundle", a."region", a."country", a."model",
        a."quantity", a."inProgress", a."status",
        a."halfYearPeriod", a."lastUpdatedBy", a."lastUpdatedOn",
        COALESCE(s."ordered", 0) AS "ordered",
        COALESCE(s."inTransit", 0) AS "inTransit",
        COALESCE(s."delivered", 0) AS "delivered",
        a."quantity" - COALESCE(s."ordered", 0) AS "toBeOrdered",
        COALESCE(s."earliestEta", NULL) AS "earliestEta",
        COALESCE(s."slotCount", 0) AS "slotCount"
      FROM "AssetOrder" a
      LEFT JOIN (
        SELECT
          "assetOrderId",
          SUM("orderedQty") AS "ordered",
          SUM(CASE WHEN "status" = 'In Transit' THEN "orderedQty" ELSE 0 END) AS "inTransit",
          SUM(CASE WHEN "status" = 'Delivered' THEN "orderedQty" ELSE 0 END) AS "delivered",
          MIN(CASE WHEN "status" IN ('Pending', 'Ordered', 'In Transit') THEN "eta" END) AS "earliestEta",
          COUNT(*) AS "slotCount"
        FROM "OrderSlot"
        GROUP BY "assetOrderId"
      ) s ON s."assetOrderId" = a."id"
      ${where}
      ORDER BY a."region", a."country", a."model" ASC
    `;

    const result = await query(sql, params);

    // Fetch all slots for the returned orders
    const orderIds = result.rows.map((r: { id: string }) => r.id);
    if (orderIds.length > 0) {
      const placeholders = orderIds.map((_: string, i: number) => `$${i + 1}`).join(',');
      const slotsResult = await query(
        `SELECT * FROM "OrderSlot" WHERE "assetOrderId" IN (${placeholders}) ORDER BY "slotNumber" ASC`,
        orderIds
      );

      // Attach slots to each order
      const slotsByOrder = new Map<string, typeof slotsResult.rows>();
      for (const slot of slotsResult.rows) {
        if (!slotsByOrder.has(slot.assetOrderId)) slotsByOrder.set(slot.assetOrderId, []);
        slotsByOrder.get(slot.assetOrderId)!.push(slot);
      }

      for (const order of result.rows) {
        order.slots = slotsByOrder.get(order.id) || [];
      }
    } else {
      for (const order of result.rows) {
        order.slots = [];
      }
    }

    return NextResponse.json(result.rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      `INSERT INTO "AssetOrder" ("id", "bundle", "region", "country", "model", "quantity", "inProgress", "ordered", "inTransit", "delivered", "toBeOrdered", "status", "lastUpdatedBy", "lastUpdatedOn", "halfYearPeriod")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14)`,
      [body.id, body.bundle ?? null, body.region, body.country, body.model,
       body.quantity || 0, body.inProgress || 0, body.ordered || 0,
       body.inTransit || 0, body.delivered || 0, body.toBeOrdered || 0,
       body.status ?? null, body.lastUpdatedBy ?? null, body.halfYearPeriod || 'H2-2026']
    );
    const result = await query(`SELECT * FROM "AssetOrder" WHERE "id" = $1`, [body.id]);
    return NextResponse.json(result.rows[0], { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}
