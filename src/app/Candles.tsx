"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./PricesClient.module.css";
import CandlesTV from "./CandlesTV";

type Candle = { d: string; o: number; h: number; l: number; c: number };

type HistoryResp =
  | { ok: true; candles: Candle[] }
  | { ok: false; error: string };

function fmt(v: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

export default function Candles({ symbol, height = 320 }: { symbol: string; height?: number }) {
  const t = useTranslations("app");
  const [series, setSeries] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setSeries(null);

        const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&days=220`, { cache: "no-store" });
        const json = (await res.json()) as HistoryResp;
        if (!res.ok || !json.ok) throw new Error(!json.ok ? json.error : `HTTP ${res.status}`);
        if (!cancelled) setSeries(json.candles ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const last = useMemo(() => {
    if (!series?.length) return null;
    return series[series.length - 1] ?? null;
  }, [series]);

  if (error) {
    return (
      <div className={`${styles.banner} ${styles.bannerError}`}>{t("klineError", { error })}</div>
    );
  }

  if (!series) {
    return <div className={styles.banner}>{t("klineLoading")}</div>;
  }

  if (series.length === 0) {
    return <div className={styles.banner}>{t("klineEmpty")}</div>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>{t("days")}</div>
        {last ? (
          <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}>
            {last.d}  O {fmt(last.o)}  H {fmt(last.h)}  L {fmt(last.l)}  C {fmt(last.c)}
          </div>
        ) : null}
      </div>

      <CandlesTV candles={series} height={height} />

      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.50)", fontSize: 11 }}>{t("klineHelp")}</div>
    </div>
  );
}
