import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type Rule = {
  patterns: RegExp[];
  handler: (match: RegExpMatchArray) => Promise<string>;
};

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const rules: Rule[] = [
  // ── Help ──────────────────────────────────────────────
  {
    patterns: [/^(help|what can you do|commands|options|how to use)/],
    handler: async () => `I can answer questions about your procurement data. Try asking:

• "Show orders for India"
• "Orders in APAC region"
• "Pending orders"
• "Delivered orders"
• "How many CT scanners ordered?"
• "Total ordered quantity"
• "Budget for China"
• "Budget utilization this period"
• "Price of Ultrasound X3"
• "Show all slots for order"
• "Summary" or "Stats"
• "What countries have orders?"`,
  },

  // ── Summary / Stats ──────────────────────────────────
  {
    patterns: [/^(summary|stats|overview|dashboard|give me (a )?summary)/],
    handler: async () => {
      const orders = await query(`SELECT COUNT(*) as count, COALESCE(SUM(quantity),0) as qty, COALESCE(SUM(ordered),0) as ordered, COALESCE(SUM(delivered),0) as delivered FROM asset_orders`);
      const r = orders.rows[0];
      const countries = await query(`SELECT COUNT(DISTINCT country) as count FROM asset_orders`);
      const regions = await query(`SELECT COUNT(DISTINCT region) as count FROM asset_orders`);
      const budget = await query(`SELECT COALESCE(SUM(approved),0) as approved, COALESCE(SUM(spent),0) as spent FROM country_budgets`);
      const b = budget.rows[0];
      const util = Number(b.approved) > 0 ? ((Number(b.spent) / Number(b.approved)) * 100).toFixed(1) : '0';

      return `📊 **Overview**
━━━━━━━━━━━━━━━━━━━
📦 Orders: ${Number(r.count).toLocaleString()} total | ${Number(r.qty).toLocaleString()} units
🌍 Regions: ${Number(regions.rows[0].count)} | Countries: ${Number(countries.rows[0].count)}
✅ Ordered: ${Number(r.ordered).toLocaleString()} | Delivered: ${Number(r.delivered).toLocaleString()}
💰 Budget: €${Number(b.approved).toLocaleString()} approved | €${Number(b.spent).toLocaleString()} spent (${util}% utilization)`;
    },
  },

  // ── Budget utilization ────────────────────────────────
  {
    patterns: [/budget\s+(utilization|usage|used|remaining|summary|overview|status)/i, /(utilization|usage|remaining)/i],
    handler: async () => {
      const res = await query(`
        SELECT cb.country, cb.approved, cb.spent, cb.approved - cb.spent as remaining,
          CASE WHEN cb.approved > 0 THEN ROUND((cb.spent::numeric / cb.approved) * 100, 1) ELSE 0 END as utilization
        FROM country_budgets cb
        WHERE cb.approved > 0
        ORDER BY utilization DESC
      `);
      if (res.rows.length === 0) return 'No budget data found.';
      const lines = res.rows.map((r: Record<string, string>) => {
        const pct = Number(r.utilization);
        const bar = pct >= 90 ? '🔴' : pct >= 70 ? '🟡' : '🟢';
        return `${bar} ${r.country}: €${Number(r.spent).toLocaleString()} / €${Number(r.approved).toLocaleString()} (${pct}%) — €${Number(r.remaining).toLocaleString()} left`;
      });
      return `💰 **Budget Utilization**\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Budget for a specific country ─────────────────────
  {
 patterns: [/budget\s+(for|of|in)\s+(.+)/i, /how much (budget|money|funds?)\s+(for|of|in)\s+(.+)/i, /what('?s| is) the budget\s+(for|of|in)\s+(.+)/i],
    handler: async (match) => {
      const country = (match[2] || match[3] || match[4] || '').trim();
      const res = await query(`SELECT country, approved, spent, carryover, approved + carryover - spent as remaining FROM country_budgets WHERE LOWER(country) = LOWER($1)`, [country]);
      if (res.rows.length === 0) return `No budget found for "${country}".`;
      const r = res.rows[0];
      const util = Number(r.approved) > 0 ? ((Number(r.spent) / Number(r.approved)) * 100).toFixed(1) : '0';
      return `💰 **Budget: ${r.country}**
━━━━━━━━━━━━━━━━━━━
Approved: €${Number(r.approved).toLocaleString()}
Spent: €${Number(r.spent).toLocaleString()} (${util}%)
Carryover: €${Number(r.carryover).toLocaleString()}
Remaining: €${Number(r.remaining).toLocaleString()}`;
    },
  },

  // ── Orders in a country ───────────────────────────────
  {
    patterns: [/orders?\s+(for|in|from|at)\s+(.+)/i, /show\s+(.+\s+)?orders?\s+(for|in|from|at)\s+(.+)/i, /(what|show)\s+(are\s+)?(the\s+)?orders?\s+(for|in|from)\s+(.+)/i, /how many orders?\s+(for|in|from)\s+(.+)/i],
    handler: async (match) => {
      const country = (match[2] || match[3] || match[4] || match[5] || '').trim().replace(/^(the|all)\s+/i, '');
      const res = await query(`SELECT id, model, quantity, ordered, delivered, status FROM asset_orders WHERE LOWER(country) = LOWER($1) ORDER BY model`, [country]);
      if (res.rows.length === 0) return `No orders found for "${country}".`;
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.model}: ${Number(r.quantity)} units (${r.status || 'Pending'}) — ${Number(r.ordered)} ordered, ${Number(r.delivered)} delivered`);
      return `📦 **Orders for ${country}** (${res.rows.length} total)\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Orders in a region ────────────────────────────────
  {
    patterns: [/orders?\s+(for|in|from)\s+(.+)\s+region/i, /(.+)\s+region\s+orders/i, /orders?\s+in\s+region\s+(.+)/i, /show\s+(.+\s+)?orders?\s+in\s+(.+)\s+region/i],
    handler: async (match) => {
      const region = (match[1] || match[2] || match[3] || '').trim().replace(/\s+region$/i, '').replace(/^region\s+/i, '');
      const res = await query(`SELECT country, model, quantity, ordered, delivered, status FROM asset_orders WHERE LOWER(region) = LOWER($1) ORDER BY country, model`, [region]);
      if (res.rows.length === 0) return `No orders found in region "${region}".`;
      const byCountry: Record<string, string[]> = {};
      res.rows.forEach((r: Record<string, string>) => {
        if (!byCountry[r.country]) byCountry[r.country] = [];
        byCountry[r.country].push(`  • ${r.model}: ${Number(r.quantity)} units (${r.status || 'Pending'})`);
      });
      const sections = Object.entries(byCountry).map(([c, models]) => `**${c}:**\n${models.join('\n')}`);
      return `📦 **Orders in ${region}** (${res.rows.length} total)\n━━━━━━━━━━━━━━━━━━━\n${sections.join('\n\n')}`;
    },
  },

  // ── Orders by status ──────────────────────────────────
  {
    patterns: [/^(show|list|get|find)\s+(all\s+)?(the\s+)?(.+)\s+orders/i, /orders?\s+(with\s+)?status\s+(.+)/i, /(.+)\s+orders/i],
    handler: async (match) => {
      const status = (match[4] || match[2] || match[5] || '').trim().replace(/^(the|all|orders?)\s+/i, '').replace(/\s+orders?$/i, '');
      if (!status) return null as unknown as string;
      const validStatuses = ['pending', 'in progress', 'ordered', 'partially delivered', 'completed'];
      const matched = validStatuses.find(s => s.includes(status.toLowerCase()) || status.toLowerCase().includes(s));
      if (!matched) return null as unknown as string;
      const res = await query(`SELECT country, model, quantity, ordered, status FROM asset_orders WHERE LOWER(status) = LOWER($1) ORDER BY country, model`, [matched]);
      if (res.rows.length === 0) return `No ${matched} orders found.`;
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.country} — ${r.model}: ${Number(r.quantity)} units`);
      return `📋 **${matched.charAt(0).toUpperCase() + matched.slice(1)} Orders** (${res.rows.length})\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Orders by model ───────────────────────────────────
  {
    patterns: [/orders?\s+(for|of|about)\s+(.+)/i, /how many\s+(.+)/i, /(.+)\s+orders?/i, /show\s+(.+)/i],
    handler: async (match) => {
      const model = (match[2] || match[3] || match[4] || '').trim().replace(/^(the|all|orders?|models?)\s+/i, '');
      if (!model || model.length < 2) return null as unknown as string;
      const res = await query(`SELECT country, quantity, ordered, delivered, status FROM asset_orders WHERE LOWER(model) LIKE LOWER($1) ORDER BY country`, [`%${model}%`]);
      if (res.rows.length === 0) return `No orders found matching "${model}".`;
      const totalQty = res.rows.reduce((s: number, r: Record<string, string>) => s + Number(r.quantity), 0);
      const totalOrdered = res.rows.reduce((s: number, r: Record<string, string>) => s + Number(r.ordered), 0);
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.country}: ${Number(r.quantity)} units — ${Number(r.ordered)} ordered, ${Number(r.delivered)} delivered (${r.status || 'Pending'})`);
      return `📦 **Orders matching "${model}"** (${res.rows.length} records)\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}\n\n**Total:** ${totalQty.toLocaleString()} units | ${totalOrdered.toLocaleString()} ordered`;
    },
  },

  // ── Total ordered / quantity ──────────────────────────
  {
    patterns: [/total\s+(ordered|quantity|units|qty)/i, /how many\s+(total|overall)\s+(units|items|ordered)/i, /overall\s+(ordered|quantity|units)/i],
    handler: async () => {
      const res = await query(`SELECT COALESCE(SUM(quantity),0) as qty, COALESCE(SUM(ordered),0) as ordered, COALESCE(SUM(delivered),0) as delivered, COALESCE(SUM(in_transit),0) as in_transit FROM asset_orders`);
      const r = res.rows[0];
      return `📊 **Totals**\n━━━━━━━━━━━━━━━━━━━\nTotal Quantity: ${Number(r.qty).toLocaleString()}\nOrdered: ${Number(r.ordered).toLocaleString()}\nIn Transit: ${Number(r.in_transit).toLocaleString()}\nDelivered: ${Number(r.delivered).toLocaleString()}\nPending: ${(Number(r.qty) - Number(r.ordered)).toLocaleString()}`;
    },
  },

  // ── Delivered orders ──────────────────────────────────
  {
    patterns: [/delivered\s+orders?/i, /what('?s| is) (already )?delivered/i, /show\s+delivered/i],
    handler: async () => {
      const res = await query(`SELECT country, model, quantity, delivered FROM asset_orders WHERE delivered > 0 ORDER BY delivered DESC`);
      if (res.rows.length === 0) return 'No delivered orders found.';
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.country} — ${r.model}: ${Number(r.delivered).toLocaleString()} delivered`);
      return `✅ **Delivered Orders** (${res.rows.length})\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Pending orders ────────────────────────────────────
  {
    patterns: [/pending\s+orders?/i, /what('?s| is) pending/i, /what needs? (to be )?ordered/i, /show\s+pending/i, /outstanding\s+orders?/i],
    handler: async () => {
      const res = await query(`SELECT country, model, quantity, ordered, quantity - ordered as pending FROM asset_orders WHERE quantity > ordered ORDER BY (quantity - ordered) DESC`);
      if (res.rows.length === 0) return 'No pending orders.';
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.country} — ${r.model}: ${Number(r.pending).toLocaleString()} pending (of ${Number(r.quantity).toLocaleString()} total)`);
      return `⏳ **Pending Orders** (${res.rows.length})\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Price of a model ──────────────────────────────────
  {
    patterns: [/price\s+(of|for|per)\s+(.+)/i, /how much\s+(does|do)\s+(.+)\s+cost/i, /cost\s+(of|for)\s+(.+)/i],
    handler: async (match) => {
      const model = (match[2] || match[3] || match[4] || '').trim();
      const res = await query(`SELECT model, price, currency, valid_from, valid_to FROM model_prices WHERE LOWER(model) LIKE LOWER($1) ORDER BY valid_from DESC`, [`%${model}%`]);
      if (res.rows.length === 0) return `No price found for "${model}".`;
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.model}: €${Number(r.price).toLocaleString()} (${r.valid_from ? new Date(r.valid_from).toLocaleDateString() : '?'} — ${r.valid_to ? new Date(r.valid_to).toLocaleDateString() : 'present'})`);
      return `💲 **Prices for "${model}"**\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── All prices ────────────────────────────────────────
  {
    patterns: [/all\s+prices/i, /show\s+prices/i, /price\s+list/i, /model\s+prices/i],
    handler: async () => {
      const res = await query(`SELECT model, price FROM model_prices ORDER BY model LIMIT 30`);
      if (res.rows.length === 0) return 'No price data found.';
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.model}: €${Number(r.price).toLocaleString()}`);
      return `💲 **Model Prices** (${res.rows.length} entries)\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Countries list ────────────────────────────────────
  {
    patterns: [/what\s+countries/i, /list\s+(of\s+)?countries/i, /which\s+countries/i, /all\s+countries/i, /show\s+countries/i],
    handler: async () => {
      const res = await query(`SELECT DISTINCT country, region FROM asset_orders ORDER BY region, country`);
      if (res.rows.length === 0) return 'No countries found.';
      const byRegion: Record<string, string[]> = {};
      res.rows.forEach((r: Record<string, string>) => {
        if (!byRegion[r.region]) byRegion[r.region] = [];
        byRegion[r.region].push(r.country);
      });
      const sections = Object.entries(byRegion).map(([reg, cs]) => `**${reg}:** ${cs.join(', ')}`);
      return `🌍 **Countries** (${res.rows.length})\n━━━━━━━━━━━━━━━━━━━\n${sections.join('\n')}`;
    },
  },

  // ── Regions list ──────────────────────────────────────
  {
    patterns: [/what\s+regions/i, /list\s+(of\s+)?regions/i, /which\s+regions/i, /all\s+regions/i],
    handler: async () => {
      const res = await query(`SELECT DISTINCT region, COUNT(*) as count FROM asset_orders GROUP BY region ORDER BY region`);
      if (res.rows.length === 0) return 'No regions found.';
      const lines = res.rows.map((r: Record<string, string>) => `• ${r.region}: ${Number(r.count)} orders`);
      return `🌍 **Regions**\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Slots for an order ────────────────────────────────
  {
    patterns: [/slots?\s+(for|of)\s+(order\s+)?(.+)/i, /show\s+slots?\s+(for|of)\s+(.+)/i],
    handler: async (match) => {
      const orderId = (match[2] || match[3] || match[4] || '').trim().replace(/^(order|#|\s)+/i, '');
      const res = await query(`
        SELECT os.slot_number, os.ordered_qty, os.order_date, os.eta, os.status, os.price_per_unit, ao.model, ao.country
        FROM order_slots os JOIN asset_orders ao ON os.asset_order_id = ao.id
        WHERE ao.id = $1 OR ao.model LIKE $2
        ORDER BY os.slot_number`, [orderId, `%${orderId}%`]);
      if (res.rows.length === 0) return `No slots found for "${orderId}".`;
      const lines = res.rows.map((r: Record<string, string>) => {
        const eta = r.eta ? new Date(r.eta).toLocaleDateString() : 'TBD';
        return `• Slot #${r.slot_number}: ${Number(r.ordered_qty)} units — ${r.status || 'Pending'} | ETA: ${eta} | €${Number(r.price_per_unit || 0).toLocaleString()}/unit`;
      });
      return `📦 **Slots** — ${res.rows[0].country} / ${res.rows[0].model}\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },

  // ── Most ordered model ────────────────────────────────
  {
    patterns: [/most\s+(ordered|popular|common)/i, /top\s+(model|product|item)/i, /highest\s+ordered/i, /best(\s+selling)?/i],
    handler: async () => {
      const res = await query(`SELECT model, SUM(quantity) as total_qty, COUNT(*) as order_count FROM asset_orders GROUP BY model ORDER BY total_qty DESC LIMIT 10`);
      if (res.rows.length === 0) return 'No data found.';
      const lines = res.rows.map((r: Record<string, string>, i: number) => `${i + 1}. ${r.model}: ${Number(r.total_qty).toLocaleString()} units across ${Number(r.order_count)} orders`);
      return `🏆 **Top Models by Quantity**\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ reply: 'Please provide a message.' }, { status: 400 });
    }

    const normalized = normalize(message);

    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        const match = normalized.match(pattern);
        if (match) {
          const result = await rule.handler(match);
          if (result) return NextResponse.json({ reply: result });
        }
      }
    }

    return NextResponse.json({
      reply: `I'm not sure how to answer that. Try asking about:\n• Orders (by country, region, status, model)\n• Budget (by country, utilization)\n• Prices (by model)\n• Summary / Stats\n\nType "help" for all commands.`,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ reply: 'Sorry, something went wrong. Please try again.' }, { status: 500 });
  }
}
