import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/orders/[id]/slots — create a new slot for an order
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: assetOrderId } = await params;
    const body = await request.json();

    // Get next slot number
    const maxSlot = await query(
      'SELECT COALESCE(MAX("slotNumber"), 0) AS max_slot FROM "OrderSlot" WHERE "assetOrderId" = $1',
      [assetOrderId]
    );
    const nextSlot = (maxSlot.rows[0]?.max_slot || 0) + 1;

    const slotId = `${assetOrderId}-S${nextSlot}`;

    await query(
      `INSERT INTO "OrderSlot" ("id", "assetOrderId", "slotNumber", "orderedQty", "orderDate", "eta", "status", "pricePerUnit", "lastUpdatedBy", "lastUpdatedOn")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [slotId, assetOrderId, nextSlot,
       body.orderedQty || 0,
       body.orderDate || null,
       body.eta || null,
       body.status || 'Pending',
       body.pricePerUnit || null,
       body.lastUpdatedBy || null]
    );

    const result = await query('SELECT * FROM "OrderSlot" WHERE "id" = $1', [slotId]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating slot:', error);
    return NextResponse.json(
      { error: 'Failed to create slot', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
