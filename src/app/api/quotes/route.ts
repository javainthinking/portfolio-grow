import { NextResponse } from "next/server";

const SYMBOLS = [
  "MU",
  "NVDA",
  "PLTR",
  "MSTR",
  "GOOGL",
  "BABA",
  "COIN",
  "HOOD",
  "MP",
  "TSLA",
  "PSTG",
  "XAUUSD=X", // Gold vs USD
] as const;

export async function GET() {
  const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  url.searchParams.set("symbols", SYMBOLS.join(","));

  const res = await fetch(url.toString(), {
    // Yahoo sometimes blocks requests without a UA.
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; PortfolioGrow/1.0; +https://vercel.com)",
      accept: "application/json,text/plain,*/*",
    },
    // Keep it fresh-ish, but avoid hammering.
    next: { revalidate: 20 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: `Upstream error: ${res.status} ${res.statusText}` },
      { status: 502 }
    );
  }

  const data = (await res.json()) as any;
  const results = (data?.quoteResponse?.result ?? []) as any[];

  const items = results
    .map((q) => ({
      symbol: q.symbol as string,
      name: (q.shortName || q.longName || q.symbol) as string,
      price: q.regularMarketPrice as number | null,
      changePct: q.regularMarketChangePercent as number | null,
      currency: (q.currency || "") as string,
      marketState: (q.marketState || "") as string,
      marketTime: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
    }))
    // preserve our display order
    .sort((a, b) => SYMBOLS.indexOf(a.symbol as any) - SYMBOLS.indexOf(b.symbol as any));

  return NextResponse.json({ ok: true, items, symbols: SYMBOLS });
}
