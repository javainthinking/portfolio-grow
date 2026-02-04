import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type EstPosition = {
  ticker: string;
  name: string;
  netNotionalUsd: number;
  lastTxDate: string;
  notes: string[];
};

type ViTrade = {
  symbol: string;
  transactionType: string;
  transactionDate: string;
  fullName?: string;
  amount?: string;
  description?: string | null;
};

type ViSnapshot = {
  ok: true;
  source: string;
  page: string;
  fetchedAt: string;
  lastTrade: string | null;
  trades: ViTrade[];
};

function parseAmountMid(range: string): number | null {
  const s = String(range ?? "").replace(/\$/g, "").trim();
  if (!s) return null;

  // Examples: "250,001 - 500,000", "1,001 - 15,000", "Over 1,000,000", "None"
  if (/^none$/i.test(s)) return null;

  const over = s.match(/over\s+([\d,]+)/i);
  if (over) {
    const low = Number(over[1]!.replace(/,/g, ""));
    if (!Number.isFinite(low)) return null;
    return low * 1.25; // heuristic
  }

  const m = s.match(/([\d,]+)\s*-\s*([\d,]+)/);
  if (!m) return null;
  const a = Number(m[1]!.replace(/,/g, ""));
  const b = Number(m[2]!.replace(/,/g, ""));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (a + b) / 2;
}

function readSnapshotFilePath() {
  return path.join(process.cwd(), "public", "pelosi_valueinvesting.json");
}

async function loadViSnapshot(): Promise<ViSnapshot | null> {
  try {
    const raw = await fs.readFile(readSnapshotFilePath(), "utf8");
    const json = JSON.parse(raw);
    if (!json || json.ok !== true || !Array.isArray(json.trades)) return null;
    return json as ViSnapshot;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const snap = await loadViSnapshot();

    if (!snap) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pelosi snapshot not found yet. Run the GitHub Actions workflow 'Pelosi daily snapshot (valueinvesting.io)' once, then retry.",
        },
        { status: 503 }
      );
    }

    const byTicker = new Map<
      string,
      { name: string; net: number; last: string; notes: Set<string> }
    >();

    for (const tr of snap.trades) {
      const ticker = String(tr.symbol ?? "").trim().toUpperCase();
      if (!ticker || !/^[A-Z]{1,6}(\.[A-Z]{1,3})?$/.test(ticker)) continue;

      const txDate = String(tr.transactionDate ?? "").slice(0, 10);
      const transaction = String(tr.transactionType ?? "");
      const amountStr = String(tr.amount ?? "");
      const desc = String(tr.description ?? "");

      const mid = parseAmountMid(amountStr);
      if (mid === null) continue;

      const isBuy = /purchase|buy/i.test(transaction);
      const isSell = /sale|sell/i.test(transaction);
      const sign = isBuy ? 1 : isSell ? -1 : 0;
      if (sign === 0) continue;

      const notes = new Set<string>();
      if (/call/i.test(desc)) notes.add("Options: Call");
      if (/put/i.test(desc)) notes.add("Options: Put");

      const name = String(tr.fullName ?? "").trim() || ticker;

      const cur =
        byTicker.get(ticker) ??
        ({ name, net: 0, last: txDate, notes: new Set<string>() } as const);
      const next = {
        name: cur.name || name,
        net: cur.net + sign * mid,
        last: txDate && txDate > cur.last ? txDate : cur.last,
        notes: cur.notes,
      };
      for (const n of notes) next.notes.add(n);
      byTicker.set(ticker, next);
    }

    const positions: EstPosition[] = Array.from(byTicker.entries())
      .map(([ticker, v]) => ({
        ticker,
        name: v.name,
        netNotionalUsd: v.net,
        lastTxDate: v.last,
        notes: Array.from(v.notes),
      }))
      .filter((p) => Math.abs(p.netNotionalUsd) > 0)
      .sort((a, b) => Math.abs(b.netNotionalUsd) - Math.abs(a.netNotionalUsd));

    return NextResponse.json({
      ok: true,
      source: snap.page,
      fetchedAt: snap.fetchedAt,
      lastTrade: snap.lastTrade,
      positions: positions.slice(0, 20),
      disclaimer:
        "Daily snapshot is scraped from valueinvesting.io via a GitHub Actions browser run. Amounts are disclosure ranges (midpoint heuristic). Not real-time holdings.",
      logic:
        "We parse each disclosed trade from valueinvesting.io, convert the USD amount range to its midpoint (Over X -> 1.25*X), treat Purchase as +notional and Sale as -notional, and aggregate by ticker. Options are counted as notional exposure only.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load Pelosi snapshot";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
