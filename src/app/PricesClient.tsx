"use client";

import { useEffect, useMemo, useState } from "react";

type QuoteItem = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  currency: string;
  marketState: string;
  marketTime: string | null;
};

type ApiResp =
  | { ok: true; items: QuoteItem[] }
  | { ok: false; error: string };

function fmtPrice(v: number | null) {
  if (v === null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(v);
}

function fmtPct(v: number | null) {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function PricesClient() {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    try {
      setError(null);
      const res = await fetch("/api/quotes", { cache: "no-store" });
      const json = (await res.json()) as ApiResp;
      if (!res.ok || !json.ok) throw new Error(!json.ok ? json.error : `HTTP ${res.status}`);
      setItems(json.items);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => items, [items]);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Portfolio Grow — Prices</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>
            US equities + XAU/USD (via Yahoo Finance quote endpoint)
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={load}
            style={{
              border: "1px solid #ddd",
              background: "white",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <div style={{ fontSize: 12, color: "#666" }}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "—"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 12, fontSize: 12, color: "#444" }}>Symbol</th>
              <th style={{ textAlign: "left", padding: 12, fontSize: 12, color: "#444" }}>Name</th>
              <th style={{ textAlign: "right", padding: 12, fontSize: 12, color: "#444" }}>Price</th>
              <th style={{ textAlign: "right", padding: 12, fontSize: 12, color: "#444" }}>Chg%</th>
              <th style={{ textAlign: "left", padding: 12, fontSize: 12, color: "#444" }}>Currency</th>
              <th style={{ textAlign: "left", padding: 12, fontSize: 12, color: "#444" }}>State</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "#666" }}>
                  Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "#b00020" }}>
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "#666" }}>
                  No data.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const up = (r.changePct ?? 0) >= 0;
                const color = r.changePct === null ? "#666" : up ? "#0a7b34" : "#b00020";
                return (
                  <tr key={r.symbol} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{r.symbol}</td>
                    <td style={{ padding: 12, color: "#333" }}>{r.name}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(r.price)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color }}>{fmtPct(r.changePct)}</td>
                    <td style={{ padding: 12, color: "#333" }}>{r.currency || "—"}</td>
                    <td style={{ padding: 12, color: "#333" }}>{r.marketState || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: "#777" }}>
        Auto-refreshes every 30s.
      </p>
    </div>
  );
}
