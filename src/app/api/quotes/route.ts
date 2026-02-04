import { NextResponse } from "next/server";

// NOTE:
// Yahoo Finance quote endpoints often return 401 on serverless providers.
// We use Stooq's free CSV endpoint instead.
// https://stooq.com/q/l/?s=nvda.us&i=d

const ASSETS = [
  // Put index + gold first
  // Stooq doesn't reliably provide the cash index (Nasdaq 100 / NDX).
  // Use NQ.F (Nasdaq 100 futures) as a close proxy.
  { symbol: "NDX", name: "Nasdaq 100", stooq: "nq.f", currency: "USD" },
  { symbol: "XAUUSD", name: "Gold / USD", stooq: "xauusd", currency: "USD" },

  { symbol: "MU", name: "Micron Technology", stooq: "mu.us", currency: "USD" },
  { symbol: "NVDA", name: "NVIDIA", stooq: "nvda.us", currency: "USD" },
  { symbol: "PLTR", name: "Palantir", stooq: "pltr.us", currency: "USD" },
  { symbol: "MSTR", name: "MicroStrategy", stooq: "mstr.us", currency: "USD" },
  { symbol: "GOOGL", name: "Alphabet (Class A)", stooq: "googl.us", currency: "USD" },
  { symbol: "BABA", name: "Alibaba", stooq: "baba.us", currency: "USD" },
  { symbol: "COIN", name: "Coinbase", stooq: "coin.us", currency: "USD" },
  { symbol: "HOOD", name: "Robinhood", stooq: "hood.us", currency: "USD" },
  { symbol: "MP", name: "MP Materials", stooq: "mp.us", currency: "USD" },
  { symbol: "TSLA", name: "Tesla", stooq: "tsla.us", currency: "USD" },
  { symbol: "PSTG", name: "Pure Storage", stooq: "pstg.us", currency: "USD" },
  { symbol: "FSLR", name: "First Solar", stooq: "fslr.us", currency: "USD" },
  { symbol: "SOXL", name: "Direxion Daily Semiconductor Bull 3X", stooq: "soxl.us", currency: "USD" },
] as const;

type StooqRow = {
  sym: string;
  date: string;
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

function toNum(v: string): number | null {
  if (!v) return null;
  if (v === "N/D") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseStooqLine(line: string): StooqRow | null {
  // Example:
  // NVDA.US,20260203,220018,186.24,186.27,176.23,180.33,203331497,
  const parts = line.trim().split(",");
  if (parts.length < 8) return null;
  return {
    sym: parts[0] ?? "",
    date: parts[1] ?? "",
    time: parts[2] ?? "",
    open: toNum(parts[3] ?? ""),
    high: toNum(parts[4] ?? ""),
    low: toNum(parts[5] ?? ""),
    close: toNum(parts[6] ?? ""),
    volume: toNum(parts[7] ?? ""),
  };
}

function pctChange(open: number | null, close: number | null): number | null {
  if (open === null || close === null || open === 0) return null;
  return ((close - open) / open) * 100;
}

export async function GET() {
  try {
    const items = await Promise.all(
      ASSETS.map(async (a) => {
        const url = new URL("https://stooq.com/q/l/");
        url.searchParams.set("s", a.stooq);
        url.searchParams.set("i", "d");

        const res = await fetch(url.toString(), {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; PortfolioGrow/1.0)",
            accept: "text/csv,*/*",
          },
          next: { revalidate: 20 },
        });

        if (!res.ok) {
          throw new Error(`Upstream error for ${a.symbol}: ${res.status} ${res.statusText}`);
        }

        const text = await res.text();
        const line = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)[0];

        const row = line ? parseStooqLine(line) : null;
        const price = row?.close ?? null;
        const changePct = pctChange(row?.open ?? null, row?.close ?? null);

        return {
          symbol: a.symbol,
          name: a.name,
          price,
          changePct,
          currency: a.currency,
          marketState: "—",
          marketTime: row?.date && row?.time ? `${row.date} ${row.time}` : null,
        };
      })
    );

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load quotes" },
      { status: 502 }
    );
  }
}
