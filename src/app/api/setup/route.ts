import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "AssetOrder" (
          "id" TEXT NOT NULL,
          "bundle" INTEGER,
          "region" TEXT NOT NULL,
          "country" TEXT NOT NULL,
          "model" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL DEFAULT 0,
          "inProgress" INTEGER NOT NULL DEFAULT 0,
          "ordered" INTEGER NOT NULL DEFAULT 0,
          "inTransit" INTEGER NOT NULL DEFAULT 0,
          "delivered" INTEGER NOT NULL DEFAULT 0,
          "toBeOrdered" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT,
          "lastUpdatedBy" TEXT,
          "lastUpdatedOn" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "AssetOrder_pkey" PRIMARY KEY ("id")
      );
    `;

    await prisma.$executeRawUnsafe(createTableQuery);

    return NextResponse.json({ success: true, message: "Table 'AssetOrder' created successfully in Supabase!" });
  } catch (error) {
    console.error('Error creating table:', error);
    return NextResponse.json({ error: 'Failed to create table', details: String(error) }, { status: 500 });
  }
}
