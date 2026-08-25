-- Philips DEX: Phase 1 Migration
-- Adds OrderSlot, ModelPrice, CountryBudget tables
-- Adds halfYearPeriod to AssetOrder
-- Migrates existing data to OrderSlot

BEGIN;

-- 1. Add halfYearPeriod column to AssetOrder
ALTER TABLE "AssetOrder" ADD COLUMN IF NOT EXISTS "halfYearPeriod" TEXT DEFAULT 'H2-2026';

-- 2. Create OrderSlot table
CREATE TABLE IF NOT EXISTS "OrderSlot" (
  "id" TEXT PRIMARY KEY,
  "assetOrderId" TEXT NOT NULL REFERENCES "AssetOrder"("id") ON DELETE CASCADE,
  "slotNumber" INTEGER NOT NULL DEFAULT 1,
  "orderedQty" INTEGER NOT NULL DEFAULT 0,
  "orderDate" DATE,
  "eta" DATE,
  "status" TEXT DEFAULT 'Pending',
  "pricePerUnit" DECIMAL(12,2),
  "lastUpdatedBy" TEXT,
  "lastUpdatedOn" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_orderslot_assetorderid" ON "OrderSlot"("assetOrderId");
CREATE INDEX IF NOT EXISTS "idx_orderslot_status" ON "OrderSlot"("status");

-- 3. Create ModelPrice table
CREATE TABLE IF NOT EXISTS "ModelPrice" (
  "id" TEXT PRIMARY KEY,
  "model" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "pricePerUnit" DECIMAL(12,2) NOT NULL,
  "monthYear" TEXT NOT NULL,
  "lastUpdatedBy" TEXT,
  "lastUpdatedOn" TIMESTAMP DEFAULT NOW(),
  UNIQUE("model", "country", "monthYear")
);

CREATE INDEX IF NOT EXISTS "idx_modelprice_country" ON "ModelPrice"("country");
CREATE INDEX IF NOT EXISTS "idx_modelprice_monthyear" ON "ModelPrice"("monthYear");

-- 4. Create CountryBudget table
CREATE TABLE IF NOT EXISTS "CountryBudget" (
  "id" TEXT PRIMARY KEY,
  "country" TEXT NOT NULL,
  "halfYearPeriod" TEXT NOT NULL,
  "approvedBudget" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "lastUpdatedBy" TEXT,
  "lastUpdatedOn" TIMESTAMP DEFAULT NOW(),
  UNIQUE("country", "halfYearPeriod")
);

CREATE INDEX IF NOT EXISTS "idx_countrybudget_period" ON "CountryBudget"("halfYearPeriod");

-- 5. Migrate existing data: create one OrderSlot per AssetOrder
--    Use the existing ordered/delivered/inTransit values to reconstruct slot history
INSERT INTO "OrderSlot" ("id", "assetOrderId", "slotNumber", "orderedQty", "orderDate", "eta", "status", "lastUpdatedOn")
SELECT
  a."id" || '-S1',
  a."id",
  1,
  a."ordered",
  NULL,
  NULL,
  CASE
    WHEN a."delivered" >= a."ordered" AND a."ordered" > 0 THEN 'Delivered'
    WHEN a."inTransit" > 0 THEN 'In Transit'
    WHEN a."ordered" > 0 THEN 'Ordered'
    ELSE 'Pending'
  END,
  NOW()
FROM "AssetOrder" a
WHERE a."ordered" > 0
ON CONFLICT ("id") DO NOTHING;

COMMIT;
