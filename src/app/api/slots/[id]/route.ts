import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PUT /api/slots/[id] — update a slot
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    await query(
      `UPDATE "OrderSlot" SET
        "orderedQty" = $1, "orderDate" = $2, "eta" = $3,
        "status" = $4, "pricePerUnit" = $5,
        "lastUpdatedBy" = $6, "lastUpdatedOn" = NOW()
       WHERE "id" = $7`,
      [body.orderedQty, body.orderDate || null, body.eta || null,
       body.status, body.pricePerUnit || null,
       body.lastUpdatedBy || null, id]
    );

    const result = await query('SELECT * FROM "OrderSlot" WHERE "id" = $1', [id]);
    return NextResponse.json(result.rows[0]);
  } catch (error: unknown) {
    console.error('Error updating slot:', error);
    return NextResponse.json(
      { error: 'Failed to update slot', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/slots/[id] — delete a slot
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query('DELETE FROM "OrderSlot" WHERE "id" = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting slot:', error);
    return NextResponse.json(
      { error: 'Failed to delete slot', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
