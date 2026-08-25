import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    await query(
      `UPDATE "AssetOrder" SET
        "bundle" = $1, "region" = $2, "country" = $3, "model" = $4,
        "quantity" = $5, "inProgress" = $6, "ordered" = $7, "inTransit" = $8,
        "delivered" = $9, "toBeOrdered" = $10, "status" = $11,
        "lastUpdatedBy" = $12, "lastUpdatedOn" = NOW()
       WHERE "id" = $13`,
      [body.bundle ?? null, body.region, body.country, body.model,
       body.quantity, body.inProgress, body.ordered, body.inTransit,
       body.delivered, body.toBeOrdered, body.status ?? null,
       body.lastUpdatedBy ?? null, id]
    );

    const result = await query(`SELECT * FROM "AssetOrder" WHERE "id" = $1`, [id]);
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query(`DELETE FROM "AssetOrder" WHERE "id" = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order', message: error?.message || String(error), code: error?.code },
      { status: 500 }
    );
  }
}
