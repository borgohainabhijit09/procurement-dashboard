-- Philips DEX: Phase 2 Migration — Procurement Forecast
-- Adds FutureJoiner, FutureLeaver, BreakfixIncident, DeviceStock tables

BEGIN;

-- 1. FutureJoiner
CREATE TABLE IF NOT EXISTS "FutureJoiner" (
  "id" TEXT PRIMARY KEY,
  "candidateName" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT,
  "function" TEXT,
  "deviceCategory" TEXT NOT NULL,
  "model" TEXT,
  "startDate" DATE,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "hiringManager" TEXT,
  "businessUnit" TEXT,
  "department" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_futurejoiner_country" ON "FutureJoiner"("country");
CREATE INDEX IF NOT EXISTS "idx_futurejoiner_status" ON "FutureJoiner"("status");
CREATE INDEX IF NOT EXISTS "idx_futurejoiner_devicecategory" ON "FutureJoiner"("deviceCategory");
CREATE INDEX IF NOT EXISTS "idx_futurejoiner_startdate" ON "FutureJoiner"("startDate");

-- 2. FutureLeaver
CREATE TABLE IF NOT EXISTS "FutureLeaver" (
  "id" TEXT PRIMARY KEY,
  "employeeName" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT,
  "function" TEXT,
  "deviceCategory" TEXT NOT NULL,
  "model" TEXT,
  "lastWorkingDay" DATE,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_futureleaver_country" ON "FutureLeaver"("country");
CREATE INDEX IF NOT EXISTS "idx_futureleaver_status" ON "FutureLeaver"("status");
CREATE INDEX IF NOT EXISTS "idx_futureleaver_devicecategory" ON "FutureLeaver"("deviceCategory");
CREATE INDEX IF NOT EXISTS "idx_futureleaver_lastworkingday" ON "FutureLeaver"("lastWorkingDay");

-- 3. BreakfixIncident
CREATE TABLE IF NOT EXISTS "BreakfixIncident" (
  "id" TEXT PRIMARY KEY,
  "country" TEXT NOT NULL,
  "deviceCategory" TEXT NOT NULL,
  "model" TEXT,
  "incidentCount" INTEGER NOT NULL DEFAULT 0,
  "month" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("country", "deviceCategory", "month")
);

CREATE INDEX IF NOT EXISTS "idx_breakfixincident_country" ON "BreakfixIncident"("country");
CREATE INDEX IF NOT EXISTS "idx_breakfixincident_month" ON "BreakfixIncident"("month");
CREATE INDEX IF NOT EXISTS "idx_breakfixincident_devicecategory" ON "BreakfixIncident"("deviceCategory");

-- 4. DeviceStock
CREATE TABLE IF NOT EXISTS "DeviceStock" (
  "id" TEXT PRIMARY KEY,
  "country" TEXT NOT NULL,
  "deviceCategory" TEXT NOT NULL,
  "model" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "lastUpdated" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("country", "deviceCategory")
);

CREATE INDEX IF NOT EXISTS "idx_devicestock_country" ON "DeviceStock"("country");
CREATE INDEX IF NOT EXISTS "idx_devicestock_devicecategory" ON "DeviceStock"("deviceCategory");

COMMIT;
