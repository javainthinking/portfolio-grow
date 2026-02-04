import { NextResponse } from "next/server";

type EstPosition = {
  ticker: string;
  name: string;
  netNotionalUsd: number;
  lastTxDate: string;
  notes: string[];
};

function parseCsvLine(line: string): string[] {
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
  return out.map((s) => s.trim());
}

function parseAmountMid(range: string): number | null {
  const s = range.replace(/\$/g, "").trim();
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

function inferTicker(cells: string[]) {
  // The dataset isn't perfectly consistent. Pick the first cell that looks like a ticker.
  for (const c of cells) {
    const v = c.replace(/[^A-Z.]/g, "").trim();
    if (/^[A-Z]{1,6}(\.[A-Z]{1,3})?$/.test(v)) return v;
  }
  return "";
}

function inferName(cells: string[], ticker: string) {
  // Prefer a longer, non-empty cell that's not the ticker.
  const candidates = cells
    .filter((c) => c && c !== ticker)
    .filter((c) => c.length > 6)
    .slice(0, 3);
  return candidates[0] ?? ticker;
}

export async function GET() {
  const url = "https://raw.githubusercontent.com/letsgolob3/pelosi_trades/main/trades.csv";

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PortfolioGrow/1.0)",
        accept: "text/csv,text/plain,*/*",
      },
      next: { revalidate: 60 * 30 },
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

    const header = lines[0] ?? "";
    const rows = lines.slice(1);

    const byTicker = new Map<
      string,
      { name: string; net: number; last: string; notes: Set<string> }
    >();

    for (const line of rows) {
      const cols = parseCsvLine(line);
      if (cols.length < 5) continue;

      const txDate = cols[0] ?? "";
      const transaction = cols[3] ?? "";
      const amountStr = cols[4] ?? "";
      const desc = cols[5] ?? "";

      const ticker = inferTicker([cols[1] ?? "", cols[2] ?? "", cols[3] ?? "", cols[4] ?? "", cols[5] ?? ""]);
      if (!ticker) continue;

      const name = inferName([cols[1] ?? "", cols[2] ?? ""], ticker);

      const mid = parseAmountMid(amountStr);
      if (mid === null) continue;

      const isBuy = /purchase|buy/i.test(transaction);
      const isSell = /sale|sell/i.test(transaction);
      const sign = isBuy ? 1 : isSell ? -1 : 0;
      if (sign === 0) continue;

      const noteSet = new Set<string>();
      if (/call/i.test(desc)) noteSet.add("Options: Call");
      if (/put/i.test(desc)) noteSet.add("Options: Put");

      const cur = byTicker.get(ticker) ?? { name, net: 0, last: txDate, notes: new Set<string>() };
      cur.name = cur.name || name;
      cur.net += sign * mid;
      cur.last = txDate > cur.last ? txDate : cur.last;
      for (const n of noteSet) cur.notes.add(n);
      byTicker.set(ticker, cur);
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
      header,
      source: url,
      positions: positions.slice(0, 20),
      disclaimer:
        "Estimated positions are inferred from public disclosure amount ranges; they are not confirmed real-time holdings.",
      logic:
        "We parse each disclosed trade, convert the USD amount range to its midpoint (Over X -> 1.25*X), treat Purchase as +notional and Sale as -notional, and aggregate by ticker. Options are counted as notional exposure only.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load Pelosi estimate" },
      { status: 502 }
    );
  }
}
