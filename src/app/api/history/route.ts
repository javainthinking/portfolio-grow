import { NextResponse } from "next/server";

const ASSETS = [
  { symbol: "MU", stooq: "mu.us" },
  { symbol: "NVDA", stooq: "nvda.us" },
  { symbol: "PLTR", stooq: "pltr.us" },
  { symbol: "MSTR", stooq: "mstr.us" },
  { symbol: "GOOGL", stooq: "googl.us" },
  { symbol: "BABA", stooq: "baba.us" },
  { symbol: "COIN", stooq: "coin.us" },
  { symbol: "HOOD", stooq: "hood.us" },
  { symbol: "MP", stooq: "mp.us" },
  { symbol: "TSLA", stooq: "tsla.us" },
  { symbol: "PSTG", stooq: "pstg.us" },
  { symbol: "XAUUSD", stooq: "xauusd" },
] as const;

type Candle = { d: string; o: number; h: number; l: number; c: number };

type SeriesMap = Record<string, Candle[]>;

function ymd(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "120"), 30), 400);

  // Pull a bit more than requested to be safe around weekends/holidays.
  const d2 = new Date();
  const d1 = new Date(Date.now() - (days + 30) * 24 * 60 * 60 * 1000);

  try {
    const seriesEntries = await Promise.all(
      ASSETS.map(async (a) => {
        const u = new URL("https://stooq.com/q/d/l/");
        u.searchParams.set("s", a.stooq);
        u.searchParams.set("i", "d");
        u.searchParams.set("d1", ymd(d1));
        u.searchParams.set("d2", ymd(d2));

        const res = await fetch(u.toString(), {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; PortfolioGrow/1.0)",
            accept: "text/csv,*/*",
          },
          next: { revalidate: 60 },
        });

        if (!res.ok) {
          throw new Error(`Upstream error for ${a.symbol}: ${res.status} ${res.statusText}`);
        }

        const csv = await res.text();
        const lines = csv
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        // Expect header: Date,Open,High,Low,Close,Volume
        const rows = lines.slice(1);
        const candles: Candle[] = [];
        for (const line of rows) {
          const [Date, Open, High, Low, Close] = line.split(",");
          const o = toNum(Open ?? "");
          const h = toNum(High ?? "");
          const l = toNum(Low ?? "");
          const c = toNum(Close ?? "");
          if (!Date || o === null || h === null || l === null || c === null) continue;
          candles.push({ d: Date, o, h, l, c });
        }

        const trimmed = candles.slice(-days);
        return [a.symbol, trimmed] as const;
      })
    );

    const series: SeriesMap = Object.fromEntries(seriesEntries);
    return NextResponse.json({ ok: true, series });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load history" },
      { status: 502 }
    );
  }
}
