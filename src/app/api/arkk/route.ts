import { NextResponse } from "next/server";

type Holding = {
  date: string;
  fund: string;
  company: string;
  ticker: string;
  shares: number | null;
  marketValue: number | null;
  weightPct: number | null;
};

function parseNumber(s: string): number | null {
  if (!s) return null;
  const clean = s.replace(/[$,%\s]/g, "").replace(/,/g, "").trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV parser with quotes.
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export async function GET() {
  const url = "https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv";

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PortfolioGrow/1.0)",
        accept: "text/csv,*/*",
      },
      next: { revalidate: 60 * 10 },
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

    // header expected: date,fund,company,ticker,cusip,shares,market value ($),weight (%)
    const rows = lines.slice(1);
    const holdings: Holding[] = [];

    for (const line of rows) {
      const cols = parseCsvLine(line);
      if (cols.length < 8) continue;
      const [date, fund, company, ticker, _cusip, shares, mv, w] = cols;
      holdings.push({
        date: date ?? "",
        fund: fund ?? "ARKK",
        company: company ?? "",
        ticker: ticker ?? "",
        shares: parseNumber(shares ?? ""),
        marketValue: parseNumber(mv ?? ""),
        weightPct: parseNumber(w ?? ""),
      });
    }

    holdings.sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0));

    const asOf = holdings[0]?.date ?? null;

    return NextResponse.json({
      ok: true,
      asOf,
      top: holdings.slice(0, 15),
      count: holdings.length,
      source: url,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load ARKK holdings" },
      { status: 502 }
    );
  }
}
