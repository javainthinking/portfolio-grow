import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const PAGE_URL = 'https://valueinvesting.io/nancy-pelosi-stock-trades-tracker';
const API_PATH = '/get_pelosi';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  try {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Give client app time to boot; we don't rely on DOM scraping.
    await page.waitForTimeout(2500);

    const payload = await page.evaluate(async (apiPath) => {
      const res = await fetch(apiPath, { credentials: 'include' });
      const ct = res.headers.get('content-type') || '';
      const txt = await res.text();
      return { status: res.status, ct, txt };
    }, API_PATH);

    if (payload.status !== 200) {
      throw new Error(`get_pelosi status=${payload.status}`);
    }
    if (!payload.ct.includes('application/json')) {
      throw new Error(`get_pelosi content-type=${payload.ct}`);
    }

    const raw = JSON.parse(payload.txt);
    const fullStr = raw?.[0]?.full_data;
    if (!fullStr || typeof fullStr !== 'string') {
      throw new Error('Unexpected /get_pelosi JSON shape (missing full_data)');
    }

    const full = JSON.parse(fullStr);
    const out = {
      ok: true,
      source: 'https://valueinvesting.io/get_pelosi',
      page: PAGE_URL,
      fetchedAt: new Date().toISOString(),
      lastTrade: full.last_trade || null,
      isCurrentMember: full.is_current_member || null,
      networth: full.networth ?? null,
      houseInfo: full.house_info_and_stuff || null,
      totalTrades: full.total_trades ?? null,
      tradeVolume: full.trade_volume ?? null,
      trades: Array.isArray(full.data) ? full.data : [],
    };

    const publicDir = path.join(process.cwd(), 'public');
    await fs.mkdir(publicDir, { recursive: true });
    const filePath = path.join(publicDir, 'pelosi_valueinvesting.json');
    await fs.writeFile(filePath, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${filePath} (${out.trades.length} trades)`);
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
