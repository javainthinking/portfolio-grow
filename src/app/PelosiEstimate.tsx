"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./PricesClient.module.css";

type Pos = {
  ticker: string;
  name: string;
  netNotionalUsd: number;
  lastTxDate: string;
  notes: string[];
};

type Resp =
  | {
      ok: true;
      source: string;
      positions: Pos[];
      disclaimer: string;
      logic: string;
    }
  | { ok: false; error: string };

function nf(v: number, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(v);
}

export default function PelosiEstimate() {
  const t = useTranslations("app");
  const [data, setData] = useState<Extract<Resp, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch("/api/pelosi", { cache: "no-store" });
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
        <div className={styles.sectionTitle}>{t("sections.pelosi")}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t("estimated")}</div>
      </div>

      {error ? <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div> : null}

      <div className={styles.banner} style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
        <div style={{ color: "rgba(255,255,255,0.86)", fontWeight: 800 }}>{t("pelosiDisclaimerTitle")}</div>
        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: "18px" }}>
          {t("pelosiDisclaimer")}
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 12 }}>
            {t("logic")}
          </summary>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: "18px" }}>
            {t("pelosiLogic")}
          </div>
        </details>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>Ticker</th>
              <th>Asset</th>
              <th className={styles.right}>{t("netNotional")}</th>
              <th className={styles.right}>{t("lastTx")}</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {(data?.positions ?? []).map((p) => {
              const up = p.netNotionalUsd >= 0;
              const cls = up ? styles.badgeUp : styles.badgeDown;
              return (
                <tr key={p.ticker}>
                  <td className={styles.cell}>{p.ticker}</td>
                  <td className={styles.cell} style={{ color: "rgba(255,255,255,0.86)" }}>
                    {p.name}
                    {p.notes?.length ? (
                      <div style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{p.notes.join(", ")}</div>
                    ) : null}
                  </td>
                  <td className={`${styles.cell} ${styles.right}`}>
                    <span className={`${styles.badge} ${cls}`}>${up ? "+" : ""}{nf(p.netNotionalUsd, 0)}</span>
                  </td>
                  <td className={`${styles.cell} ${styles.right}`}>{p.lastTxDate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <div className={styles.note}>
          {t("source")}: <a href={data?.source} target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </section>
  );
}
