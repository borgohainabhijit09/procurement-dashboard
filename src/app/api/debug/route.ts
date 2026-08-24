import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function maskUrl(urlStr?: string) {
  if (!urlStr) return 'NOT_SET';
  try {
    const parsed = new URL(urlStr);
    const masked = `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}${parsed.search}`;
    return masked;
  } catch {
    return 'INVALID_URL_FORMAT';
  }
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const masked = maskUrl(dbUrl);

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    databaseUrlStatus: dbUrl ? 'FOUND' : 'MISSING',
    maskedUrl: masked,
  };

  if (!dbUrl) {
    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'DATABASE_URL environment variable is missing in Vercel.',
        report,
      },
      { status: 500 }
    );
  }

  try {
    // 1. Test basic database connectivity
    const pingResult = await prisma.$queryRawUnsafe('SELECT 1 as ping');
    report.ping = pingResult;

    // 2. Check existing tables in public schema
    const tables: any[] = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    report.publicTables = tables.map(t => t.table_name);

    // 3. Ensure AssetOrder table exists
    const hasAssetOrder = report.publicTables.includes('AssetOrder');
    if (!hasAssetOrder) {
      await prisma.$executeRawUnsafe(`
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
      `);
      report.tableCreated = 'AssetOrder table was created just now!';
    } else {
      const countResult: any[] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM "AssetOrder"');
      report.rowCount = countResult[0]?.count ?? 0;
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: 'Database is connected and ready!',
      report,
    });
  } catch (error: any) {
    report.error = {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      clientVersion: error?.clientVersion,
    };

    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Failed to connect or query database.',
        report,
      },
      { status: 500 }
    );
  }
}
