import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const orders = await request.json();
    
    // Using transaction for bulk upsert
    const results = await prisma.$transaction(
      orders.map((order: any) => 
        prisma.assetOrder.upsert({
          where: { id: order.id },
          update: {
            bundle: order.bundle,
            region: order.region,
            country: order.country,
            model: order.model,
            quantity: order.quantity,
            inProgress: order.inProgress,
            ordered: order.ordered,
            inTransit: order.inTransit,
            delivered: order.delivered,
            toBeOrdered: order.toBeOrdered,
            status: order.status,
            lastUpdatedBy: order.lastUpdatedBy,
            lastUpdatedOn: new Date(),
          },
          create: {
            id: order.id,
            bundle: order.bundle,
            region: order.region,
            country: order.country,
            model: order.model,
            quantity: order.quantity || 0,
            inProgress: order.inProgress || 0,
            ordered: order.ordered || 0,
            inTransit: order.inTransit || 0,
            delivered: order.delivered || 0,
            toBeOrdered: order.toBeOrdered || 0,
            status: order.status,
            lastUpdatedBy: order.lastUpdatedBy,
          }
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return NextResponse.json({ error: 'Failed to upload bulk orders' }, { status: 500 });
  }
}
