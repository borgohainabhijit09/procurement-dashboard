import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    await query(
      `UPDATE "CountryBudget" SET
        "country" = $1, "halfYearPeriod" = $2, "approvedBudget" = $3,
        "lastUpdatedBy" = $4, "lastUpdatedOn" = NOW()
       WHERE "id" = $5`,
      [body.country, body.halfYearPeriod, body.approvedBudget, body.lastUpdatedBy || null, id]
    );

    const result = await query('SELECT * FROM "CountryBudget" WHERE "id" = $1', [id]);
    return NextResponse.json(result.rows[0]);
  } catch (error: unknown) {
    console.error('Error updating budget:', error);
    return NextResponse.json(
      { error: 'Failed to update budget', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query('DELETE FROM "CountryBudget" WHERE "id" = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting budget:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
