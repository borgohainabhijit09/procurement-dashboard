import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const country = searchParams.get('country');
    const status = searchParams.get('status');

    const where: any = {};
    if (region) where.region = region;
    if (country) where.country = country;
    if (status) where.status = status;

    const orders = await prisma.assetOrder.findMany({ where });
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
        message: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newOrder = await prisma.assetOrder.create({
      data: {
        id: body.id,
        bundle: body.bundle,
        region: body.region,
        country: body.country,
        model: body.model,
        quantity: body.quantity || 0,
        inProgress: body.inProgress || 0,
        ordered: body.ordered || 0,
        inTransit: body.inTransit || 0,
        delivered: body.delivered || 0,
        toBeOrdered: body.toBeOrdered || 0,
        status: body.status,
        lastUpdatedBy: body.lastUpdatedBy,
      },
    });
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      {
        error: 'Failed to create order',
        message: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
