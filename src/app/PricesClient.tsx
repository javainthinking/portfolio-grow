"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Candles from "./Candles";
import ArkkHoldings from "./ArkkHoldings";
import PelosiEstimate from "./PelosiEstimate";
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

function usMarketStatusNow() {
  // Rough NYSE/Nasdaq regular session only (no holidays)
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const wk = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wk);
  const mins = hh * 60 + mm;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const isOpen = isWeekday && mins >= open && mins < close;

  return { isOpen, label: isOpen ? "OPEN" : "CLOSED" } as const;
}

function fmtPrice(v: number | null) {
  if (v === null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(v);
}

function fmtPct(v: number | null) {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtSigned(v: number | null, digits = 2) {
  if (v === null || Number.isNaN(v)) return "—";
  const s = v >= 0 ? "+" : "";
  return s + new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(v);
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export default function PricesClient() {
  const t = useTranslations("app");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [market, setMarket] = useState(() => usMarketStatusNow());

  const [costs, setCosts] = useState<Record<string, number>>({});

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

  // load persisted costs
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pg_costs_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "number" && Number.isFinite(v)) next[k] = v;
        }
        setCosts(next);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    const mid = setInterval(() => setMarket(usMarketStatusNow()), 60_000);
    return () => {
      clearInterval(id);
      clearInterval(mid);
    };
  }, []);

  const rows = useMemo(() => items, [items]);

  const PUBLIC = useMemo(() => new Set(["NDX", "XAUUSD"]), []);
  const publicRows = useMemo(() => rows.filter((r) => PUBLIC.has(r.symbol)), [rows, PUBLIC]);
  const stockRows = useMemo(() => rows.filter((r) => !PUBLIC.has(r.symbol)), [rows, PUBLIC]);

  const [active, setActive] = useState<string | null>("NVDA");

  // Keep expanded symbol only if it still exists; don't auto-expand anything.
  useEffect(() => {
    if (!items.length) return;
    if (active === null) return;
    if (items.some((x) => x.symbol === active)) return;
    setActive(null);
  }, [items, active]);

  const toggle = (sym: string) => setActive((cur) => (cur === sym ? null : sym));

  // set default costs for stocks when we first get prices
  useEffect(() => {
    if (!stockRows.length) return;
    setCosts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const r of stockRows) {
        if (next[r.symbol] == null && isFiniteNum(r.price)) {
          next[r.symbol] = r.price;
          changed = true;
        }
      }
      if (changed) {
        try {
          localStorage.setItem("pg_costs_v1", JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return changed ? next : prev;
    });
  }, [stockRows]);

  const totalPnl = useMemo(() => {
    let sum = 0;
    for (const r of stockRows) {
      const cost = costs[r.symbol];
      if (!isFiniteNum(r.price) || !isFiniteNum(cost)) continue;
      sum += r.price - cost;
    }
    return sum;
  }, [stockRows, costs]);

  return (
    <div className={styles.wrap}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t("title")}</h1>
            <div className={styles.subtitle}>{t("subtitle")}</div>
          </div>
          <div className={styles.actions}>
            <div className={`${styles.marketTag} ${market.isOpen ? styles.marketOpen : styles.marketClosed}`}>
              {market.isOpen ? t("market.open") : t("market.closed")}
            </div>

            <div className={styles.langGroup} aria-label="Language">
              <button
                className={`${styles.langBtn} ${locale === "en" ? styles.langActive : ""}`}
                onClick={() => {
                  if (locale === "en") return;
                  const parts = pathname.split("/").filter(Boolean);
                  if (parts.length && (parts[0] === "en" || parts[0] === "zh")) parts[0] = "en";
                  else parts.unshift("en");
                  router.push(`/${parts.join("/")}`);
                }}
                type="button"
              >
                {t("lang.en")}
              </button>
              <button
                className={`${styles.langBtn} ${locale === "zh" ? styles.langActive : ""}`}
                onClick={() => {
                  if (locale === "zh") return;
                  const parts = pathname.split("/").filter(Boolean);
                  if (parts.length && (parts[0] === "en" || parts[0] === "zh")) parts[0] = "zh";
                  else parts.unshift("zh");
                  router.push(`/${parts.join("/")}`);
                }}
                type="button"
              >
                {t("lang.zh")}
              </button>
            </div>

            <button className={styles.button} onClick={load} type="button">
              {t("refresh")}
            </button>

            <div className={styles.updated}>
              {lastUpdated ? t("updated", { time: lastUpdated.toLocaleTimeString() }) : "—"}
            </div>
          </div>
        </header>

        {/* Public / common watch */}
        <section className={styles.grid}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>{t("sections.watch")}</div>
          </div>

          {loading ? (
            <div className={styles.banner}>{t("loading")}</div>
          ) : error ? (
            <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th>Symbol</th>
                  <th className={styles.right}>Price</th>
                  <th className={styles.right}>Chg%</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {!loading && !error && publicRows.length === 0 ? (
                  <tr>
                    <td className={styles.cell} colSpan={3}>
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  publicRows.flatMap((r) => {
                    const up = (r.changePct ?? 0) >= 0;
                    const badgeClass = r.changePct === null ? styles.badgeFlat : up ? styles.badgeUp : styles.badgeDown;
                    const open = r.symbol === active;

                    const baseRow = (
                      <tr
                        key={r.symbol}
                        onClick={() => toggle(r.symbol)}
                        className={open ? styles.rowOpen : undefined}
                        style={{ cursor: "pointer" }}
                      >
                        <td className={`${styles.cell} ${styles.symbol}`} data-label="Symbol">
                          <div className={styles.symBlock}>
                            <div className={styles.symTicker}>{r.symbol}</div>
                            <div className={styles.symName}>{r.name}</div>
                          </div>
                        </td>
                        <td className={`${styles.cell} ${styles.right}`} data-label="Price">
                          {fmtPrice(r.price)}
                        </td>
                        <td className={`${styles.cell} ${styles.right}`} data-label="Chg%">
                          <span className={`${styles.badge} ${badgeClass}`}>{fmtPct(r.changePct)}</span>
                        </td>
                      </tr>
                    );

                    const expanded = open ? (
                      <tr key={`${r.symbol}__expanded`} className={styles.expandRow}>
                        <td className={styles.expandCell} colSpan={3}>
                          <div className={styles.expandHeader}>
                            <div className={styles.expandTitle}>{t("klineTitle", { symbol: r.symbol })}</div>
                            <div className={styles.expandHint}>{t("klineHint")}</div>
                          </div>
                          <div className={styles.expandCard}>
                            <Candles symbol={r.symbol} />
                          </div>
                        </td>
                      </tr>
                    ) : null;

                    return expanded ? [baseRow, expanded] : [baseRow];
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ArkkHoldings />
        <PelosiEstimate />

        {/* Stocks */}
        <section className={styles.grid} style={{ marginTop: 14 }}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>{t("sections.stocks")}</div>
            <div className={`${styles.totalPnl} ${totalPnl >= 0 ? styles.totalUp : styles.totalDown}`}>
              {t("totalPnl")}: {fmtSigned(totalPnl, 2)}
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th>Symbol</th>
                  <th className={styles.right}>Price</th>
                  <th className={styles.right}>Chg%</th>
                  <th className={styles.right}>{t("cost")}</th>
                  <th className={styles.right}>{t("pnl")}</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {!loading && !error && stockRows.length === 0 ? (
                  <tr>
                    <td className={styles.cell} colSpan={5}>
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  stockRows.flatMap((r) => {
                    const up = (r.changePct ?? 0) >= 0;
                    const badgeClass = r.changePct === null ? styles.badgeFlat : up ? styles.badgeUp : styles.badgeDown;
                    const open = r.symbol === active;
                    const cost = costs[r.symbol];
                    const pnl = isFiniteNum(r.price) && isFiniteNum(cost) ? r.price - cost : null;
                    const pnlCls = pnl === null ? styles.badgeFlat : pnl >= 0 ? styles.badgeUp : styles.badgeDown;

                    const baseRow = (
                      <tr
                        key={r.symbol}
                        onClick={() => toggle(r.symbol)}
                        className={open ? styles.rowOpen : undefined}
                        style={{ cursor: "pointer" }}
                      >
                        <td className={`${styles.cell} ${styles.symbol}`} data-label="Symbol">
                          <div className={styles.symBlock}>
                            <div className={styles.symTicker}>{r.symbol}</div>
                            <div className={styles.symName}>{r.name}</div>
                          </div>
                        </td>
                        <td className={`${styles.cell} ${styles.right}`} data-label="Price">
                          {fmtPrice(r.price)}
                        </td>
                        <td className={`${styles.cell} ${styles.right}`} data-label="Chg%">
                          <span className={`${styles.badge} ${badgeClass}`}>{fmtPct(r.changePct)}</span>
                        </td>
                        <td className={`${styles.cell} ${styles.right}`} data-label="Cost" onClick={(e) => e.stopPropagation()}>
                          <input
                            className={styles.costInput}
                            inputMode="decimal"
                            value={isFiniteNum(cost) ? String(cost) : ""}
                            placeholder={isFiniteNum(r.price) ? String(r.price) : ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const n = Number(v);
                              setCosts((prev) => {
                                const next = { ...prev };
                                if (v === "") {
                                  delete next[r.symbol];
                                } else if (Number.isFinite(n)) {
                                  next[r.symbol] = n;
                                }
                                try {
                                  localStorage.setItem("pg_costs_v1", JSON.stringify(next));
                                } catch {
                                  // ignore
                                }
                                return next;
                              });
                            }}
                            type="number"
                            step="0.01"
                          />
                        </td>
                        <td className={`${styles.cell} ${styles.right}`} data-label="P&L">
                          <span className={`${styles.badge} ${pnlCls}`}>{fmtSigned(pnl, 2)}</span>
                        </td>
                      </tr>
                    );

                    const expanded = open ? (
                      <tr key={`${r.symbol}__expanded`} className={styles.expandRow}>
                        <td className={styles.expandCell} colSpan={5}>
                          <div className={styles.expandHeader}>
                            <div className={styles.expandTitle}>{t("klineTitle", { symbol: r.symbol })}</div>
                            <div className={styles.expandHint}>{t("klineHint")}</div>
                          </div>
                          <div className={styles.expandMeta} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.metaItem}>
                              <div className={styles.metaLabel}>{t("cost")}</div>
                              <input
                                className={styles.costInput}
                                inputMode="decimal"
                                value={isFiniteNum(cost) ? String(cost) : ""}
                                placeholder={isFiniteNum(r.price) ? String(r.price) : ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const n = Number(v);
                                  setCosts((prev) => {
                                    const next = { ...prev };
                                    if (v === "") {
                                      delete next[r.symbol];
                                    } else if (Number.isFinite(n)) {
                                      next[r.symbol] = n;
                                    }
                                    try {
                                      localStorage.setItem("pg_costs_v1", JSON.stringify(next));
                                    } catch {
                                      // ignore
                                    }
                                    return next;
                                  });
                                }}
                                type="number"
                                step="0.01"
                              />
                            </div>
                            <div className={styles.metaItem}>
                              <div className={styles.metaLabel}>{t("pnl")}</div>
                              <div className={styles.metaValue}>
                                <span className={`${styles.badge} ${pnlCls}`}>{fmtSigned(pnl, 2)}</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles.expandCard}>
                            <Candles symbol={r.symbol} />
                          </div>
                        </td>
                      </tr>
                    ) : null;

                    return expanded ? [baseRow, expanded] : [baseRow];
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.note}>{t("autoRefresh")}</div>
          <div className={styles.note}>{t("tipMobile")}</div>
        </footer>
      </div>
    </div>
  );
}
