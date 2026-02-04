"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./PricesClient.module.css";

type Holding = {
  date: string;
  company: string;
  ticker: string;
  shares: number | null;
  marketValue: number | null;
  weightPct: number | null;
};

type Resp =
  | { ok: true; asOf: string | null; top: Holding[]; count: number; source: string }
  | { ok: false; error: string };

function nf(v: number | null, digits = 2) {
  if (v === null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(v);
}

export default function ArkkHoldings() {
  const t = useTranslations("app");
  const [data, setData] = useState<Extract<Resp, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch("/api/arkk", { cache: "no-store" });
        const json = (await res.json()) as Resp;
        if (!res.ok || !json.ok) throw new Error(!json.ok ? json.error : `HTTP ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.grid} style={{ marginTop: 14 }}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitle}>{t("sections.ark")}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          {data?.asOf ? t("asOf", { date: data.asOf }) : ""}
        </div>
      </div>

      {error ? <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th className={styles.right}>Weight</th>
              <th className={styles.right}>Mkt Value</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {(data?.top ?? []).map((h) => (
              <tr key={`${h.ticker}_${h.company}`}>
                <td className={styles.cell}>{h.ticker || "—"}</td>
                <td className={styles.cell} style={{ color: "rgba(255,255,255,0.86)" }}>
                  {h.company}
                </td>
                <td className={`${styles.cell} ${styles.right}`}>{h.weightPct === null ? "—" : `${nf(h.weightPct, 2)}%`}</td>
                <td className={`${styles.cell} ${styles.right}`}>{h.marketValue === null ? "—" : `$${nf(h.marketValue, 0)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <div className={styles.note}>{t("arkNote")}</div>
      </div>
    </section>
  );
}
