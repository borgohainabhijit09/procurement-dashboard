import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Manually parse .env file
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[key]) process.env[key] = val;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function uid(): string {
  return crypto.randomUUID();
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function futureDate(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d;
}

const REGIONS_COUNTRIES: Record<string, string[]> = {
  'APAC': ['India', 'Japan', 'Australia', 'Thailand', 'South Korea'],
  'EMEA': ['Germany', 'Netherlands', 'France', 'United Kingdom', 'South Africa'],
  'Americas': ['United States', 'Brazil', 'Mexico', 'Canada', 'Colombia'],
};

const MODELS = [
  { model: 'IntelliSpace CT 5000', basePrice: 1250000 },
  { model: 'IntelliSpace CT 7000', basePrice: 1800000 },
  { model: 'Innova IGS 630', basePrice: 950000 },
  { model: 'Azurion 7', basePrice: 1400000 },
  { model: 'IQon Spectral CT', basePrice: 1100000 },
  { model: ' Ingenia Elition 3.0T', basePrice: 2200000 },
  { model: 'Affiniti 70 Ultrasound', basePrice: 185000 },
  { model: 'EPIQ Elite Ultrasound', basePrice: 250000 },
  { model: 'Veradius Ultrasound', basePrice: 95000 },
  { model: 'MobileDiagnost 50', basePrice: 320000 },
  { model: 'MicroDose Mammography', basePrice: 280000 },
  { model: 'ProScan MRI 1.5T', basePrice: 1600000 },
];

const STATUSES = ['Pending', 'In Progress', 'Ordered', 'Partially Delivered', 'Completed'];
const SLOT_STATUSES: Record<string, string[]> = {
  'Pending': ['Pending'],
  'In Progress': ['Pending', 'Ordered'],
  'Ordered': ['Ordered'],
  'Partially Delivered': ['Ordered', 'In Transit', 'Delivered'],
  'Completed': ['Delivered'],
};

const PERIODS = ['H2-2025', 'H1-2026', 'H2-2026'];

interface SeedOrder {
  id: string;
  bundle: number;
  region: string;
  country: string;
  model: string;
  quantity: number;
  status: string;
  halfYearPeriod: string;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM "OrderSlot"');
    await client.query('DELETE FROM "AssetOrder"');
    await client.query('DELETE FROM "ModelPrice"');
    await client.query('DELETE FROM "CountryBudget"');

    const allOrders: SeedOrder[] = [];
    const allSlots: { id: string; assetOrderId: string; slotNumber: number; orderedQty: number; orderDate: Date | null; eta: Date | null; status: string; pricePerUnit: number }[] = [];
    const allPrices: { model: string; country: string; pricePerUnit: number; monthYear: string }[] = [];
    const allBudgets: { country: string; halfYearPeriod: string; approvedBudget: number }[] = [];

    let bundleCounter = 1;

    // Generate orders across regions/countries
    for (const [region, countries] of Object.entries(REGIONS_COUNTRIES)) {
      for (const country of countries) {
        // 2-4 models per country
        const countryModels = MODELS.slice(
          Math.floor(Math.random() * 4),
          Math.floor(Math.random() * 4) + 4
        ).slice(0, 2 + Math.floor(Math.random() * 3));

        for (const { model, basePrice } of countryModels) {
          const quantity = 5 + Math.floor(Math.random() * 46); // 5-50
          const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
          const period = PERIODS[Math.floor(Math.random() * PERIODS.length)];
          const orderId = uid();

          allOrders.push({
            id: orderId,
            bundle: bundleCounter++,
            region,
            country,
            model,
            quantity,
            status,
            halfYearPeriod: period,
          });

          // Generate slots based on status
          const slotStatuses = SLOT_STATUSES[status];
          const numSlots = 1 + Math.floor(Math.random() * 3); // 1-3 slots
          let remainingQty = quantity;

          for (let s = 1; s <= numSlots; s++) {
            const slotQty = s === numSlots ? remainingQty : Math.max(1, Math.floor(remainingQty / (numSlots - s + 1)));
            remainingQty -= slotQty;
            if (slotQty <= 0) continue;

            const slotStatus = slotStatuses[Math.min(s - 1, slotStatuses.length - 1)];
            const hasPrice = Math.random() > 0.15;
            const priceVariance = 0.85 + Math.random() * 0.3;
            const price = hasPrice ? Math.round(basePrice * priceVariance * 100) / 100 : 0;

            let orderDate: Date | null = null;
            let eta: Date | null = null;

            if (slotStatus !== 'Pending') {
              orderDate = pastDate(30 + Math.floor(Math.random() * 60));
            }
            if (slotStatus === 'Ordered') {
              eta = futureDate(14 + Math.floor(Math.random() * 60));
            } else if (slotStatus === 'In Transit') {
              orderDate = pastDate(45 + Math.floor(Math.random() * 30));
              eta = futureDate(3 + Math.floor(Math.random() * 21));
            } else if (slotStatus === 'Delivered') {
              orderDate = pastDate(60 + Math.floor(Math.random() * 60));
              eta = pastDate(5 + Math.floor(Math.random() * 30));
            }

            allSlots.push({
              id: `${orderId}-S${s}`,
              assetOrderId: orderId,
              slotNumber: s,
              orderedQty: slotQty,
              orderDate,
              eta,
              status: slotStatus,
              pricePerUnit: price,
            });
          }

          // Generate price entries for this model/country across months
          const months = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
                          '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
                          '2026-07', '2026-08'];
          const selectedMonths = months.slice(-4); // Last 4 months
          for (const monthYear of selectedMonths) {
            const monthVariance = 0.95 + Math.random() * 0.1;
            allPrices.push({
              model,
              country,
              pricePerUnit: Math.round(basePrice * monthVariance * 100) / 100,
              monthYear,
            });
          }
        }

        // Generate budget entries for this country
        for (const period of PERIODS) {
          const budgetBase = 2000000 + Math.floor(Math.random() * 18000000); // $2M - $20M
          allBudgets.push({
            country,
            halfYearPeriod: period,
            approvedBudget: budgetBase,
          });
        }
      }
    }

    // Insert all orders
    for (const o of allOrders) {
      await client.query(
        `INSERT INTO "AssetOrder" ("id", "bundle", "region", "country", "model", "quantity", "inProgress", "ordered", "inTransit", "delivered", "toBeOrdered", "status", "halfYearPeriod", "lastUpdatedBy", "lastUpdatedOn")
         VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, $6, $7, $8, 'seed', NOW())`,
        [o.id, o.bundle, o.region, o.country, o.model, o.quantity, o.status, o.halfYearPeriod]
      );
    }

    // Insert all slots
    for (const s of allSlots) {
      await client.query(
        `INSERT INTO "OrderSlot" ("id", "assetOrderId", "slotNumber", "orderedQty", "orderDate", "eta", "status", "pricePerUnit", "lastUpdatedBy", "lastUpdatedOn")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'seed', NOW())`,
        [s.id, s.assetOrderId, s.slotNumber, s.orderedQty, s.orderDate, s.eta, s.status, s.pricePerUnit || null]
      );
    }

    // Insert all prices (deduplicate by model+country+monthYear, keeping latest)
    const priceKeyMap = new Map<string, typeof allPrices[0]>();
    for (const p of allPrices) {
      priceKeyMap.set(`${p.model}|${p.country}|${p.monthYear}`, p);
    }
    for (const p of priceKeyMap.values()) {
      const priceId = `MP-${p.model.replace(/\s+/g, '-').slice(0, 20)}-${p.country}-${p.monthYear}`;
      await client.query(
        `INSERT INTO "ModelPrice" ("id", "model", "country", "pricePerUnit", "monthYear", "lastUpdatedBy", "lastUpdatedOn")
         VALUES ($1, $2, $3, $4, $5, 'seed', NOW())`,
        [priceId, p.model, p.country, p.pricePerUnit, p.monthYear]
      );
    }

    // Insert all budgets (deduplicate by country+period)
    const budgetKeyMap = new Map<string, typeof allBudgets[0]>();
    for (const b of allBudgets) {
      budgetKeyMap.set(`${b.country}|${b.halfYearPeriod}`, b);
    }
    for (const b of budgetKeyMap.values()) {
      const budgetId = `BUD-${b.country}-${b.halfYearPeriod}`;
      await client.query(
        `INSERT INTO "CountryBudget" ("id", "country", "halfYearPeriod", "approvedBudget", "lastUpdatedBy", "lastUpdatedOn")
         VALUES ($1, $2, $3, $4, 'seed', NOW())`,
        [budgetId, b.country, b.halfYearPeriod, b.approvedBudget]
      );
    }

    await client.query('COMMIT');

    console.log(`Seeded ${allOrders.length} orders, ${allSlots.length} slots, ${priceKeyMap.size} prices, ${budgetKeyMap.size} budgets.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seed()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
