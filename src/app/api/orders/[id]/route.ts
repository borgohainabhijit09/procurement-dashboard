import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedOrder = await prisma.assetOrder.update({
      where: { id },
      data: {
        bundle: body.bundle,
        region: body.region,
        country: body.country,
        model: body.model,
        quantity: body.quantity,
        inProgress: body.inProgress,
        ordered: body.ordered,
        inTransit: body.inTransit,
        delivered: body.delivered,
        toBeOrdered: body.toBeOrdered,
        status: body.status,
        lastUpdatedBy: body.lastUpdatedBy,
        lastUpdatedOn: new Date(),
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.assetOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
