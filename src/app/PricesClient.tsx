"use client";

import { useEffect, useMemo, useState } from "react";
import Candles from "./Candles";
import styles from "./PricesClient.module.css";

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
  const [active, setActive] = useState<string>("NVDA");

  // default selection once data arrives
  useEffect(() => {
    if (!items.length) return;
    if (items.some((x) => x.symbol === active)) return;
    setActive(items[0]!.symbol);
  }, [items, active]);

  return (
    <div className={styles.wrap}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Portfolio Grow</h1>
            <div className={styles.subtitle}>Prices • US equities + XAU/USD • data via Stooq</div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} onClick={load}>
              Refresh
            </button>
            <div className={styles.updated}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "—"}</div>
          </div>
        </header>

        <section className={styles.grid}>
          {loading ? (
            <div className={styles.banner}>Loading…</div>
          ) : error ? (
            <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>
          ) : null}

          <div className={styles.split}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th className={styles.right}>Price</th>
                    <th className={styles.right}>Chg%</th>
                    <th>CCY</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody className={styles.tbody}>
                  {!loading && !error && rows.length === 0 ? (
                    <tr>
                      <td className={styles.cell} colSpan={6}>
                        No data.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const up = (r.changePct ?? 0) >= 0;
                      // CN-style: red up, green down
                      const badgeClass = r.changePct === null ? styles.badgeFlat : up ? styles.badgeUp : styles.badgeDown;
                      const selected = r.symbol === active;
                      return (
                        <tr
                          key={r.symbol}
                          onClick={() => setActive(r.symbol)}
                          style={{ cursor: "pointer", background: selected ? "rgba(255,255,255,0.05)" : undefined }}
                        >
                          <td className={`${styles.cell} ${styles.symbol}`}>{r.symbol}</td>
                          <td className={`${styles.cell} ${styles.name}`}>{r.name}</td>
                          <td className={`${styles.cell} ${styles.right}`}>{fmtPrice(r.price)}</td>
                          <td className={`${styles.cell} ${styles.right}`}>
                            <span className={`${styles.badge} ${badgeClass}`}>{fmtPct(r.changePct)}</span>
                          </td>
                          <td className={styles.cell}>{r.currency || "—"}</td>
                          <td className={styles.cell}>{r.marketState || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Daily candles for selected symbol (kept visually close) */}
            <div className={styles.chartPane}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)" }}>{active} — 日K线</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>点表格行切换</div>
              </div>
              <div className={styles.chartCard}>
                <Candles symbol={active} />
              </div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.note}>Auto-refreshes every 30s.</div>
          <div className={styles.note}>Tip: swipe horizontally on mobile for the full table.</div>
        </footer>
      </div>
    </div>
  );
}
