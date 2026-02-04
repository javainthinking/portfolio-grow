import { NextResponse } from "next/server";

// Fetch a SINGLE symbol history to avoid burst outbound requests (which can fail on serverless).
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
  const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "120"), 30), 400);

  const asset = ASSETS.find((a) => a.symbol === symbol);
  if (!asset) {
    return NextResponse.json({ ok: false, error: `Unknown symbol: ${symbol}` }, { status: 400 });
  }

  // Pull a bit more than requested to be safe around weekends/holidays.
  const d2 = new Date();
  const d1 = new Date(Date.now() - (days + 45) * 24 * 60 * 60 * 1000);

  try {
    const u = new URL("https://stooq.com/q/d/l/");
    u.searchParams.set("s", asset.stooq);
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
      return NextResponse.json(
        { ok: false, error: `Upstream error: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
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

    return NextResponse.json({ ok: true, candles: candles.slice(-days) });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load history" },
      { status: 502 }
    );
  }
}
