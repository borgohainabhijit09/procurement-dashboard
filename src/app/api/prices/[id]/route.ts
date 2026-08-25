import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    await query(
      `UPDATE "ModelPrice" SET
        "model" = $1, "country" = $2, "pricePerUnit" = $3, "monthYear" = $4,
        "lastUpdatedBy" = $5, "lastUpdatedOn" = NOW()
       WHERE "id" = $6`,
      [body.model, body.country, body.pricePerUnit, body.monthYear, body.lastUpdatedBy || null, id]
    );

    const result = await query('SELECT * FROM "ModelPrice" WHERE "id" = $1', [id]);
    return NextResponse.json(result.rows[0]);
  } catch (error: unknown) {
    console.error('Error updating price:', error);
    return NextResponse.json(
      { error: 'Failed to update price', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query('DELETE FROM "ModelPrice" WHERE "id" = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting price:', error);
    return NextResponse.json(
      { error: 'Failed to delete price', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
