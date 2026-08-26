import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vals: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(body)) {
      if (key === 'id') continue;
      fields.push(`"${key}" = $${idx++}`);
      vals.push(val);
    }
    fields.push(`"updatedAt" = NOW()`);
    vals.push(id);
    await query(`UPDATE "FutureLeaver" SET ${fields.join(', ')} WHERE "id" = $${idx}`, vals);
    const result = await query(`SELECT * FROM "FutureLeaver" WHERE "id" = $1`, [id]);
    return NextResponse.json(result.rows[0]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error updating leaver:', error);
    return NextResponse.json({ error: 'Failed to update leaver', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query(`DELETE FROM "FutureLeaver" WHERE "id" = $1`, [id]);
    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error deleting leaver:', error);
    return NextResponse.json({ error: 'Failed to delete leaver', message: error?.message || String(error), code: error?.code }, { status: 500 });
  }
}
