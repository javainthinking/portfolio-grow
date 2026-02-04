"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./PricesClient.module.css";

type Candle = { d: string; o: number; h: number; l: number; c: number };

type HistoryResp =
  | { ok: true; candles: Candle[] }
  | { ok: false; error: string };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function fmt(v: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

export default function Candles({ symbol, height = 180 }: { symbol: string; height?: number }) {
  const [series, setSeries] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&days=160`, { cache: "no-store" });
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

  const { candles, min, max, last } = useMemo(() => {
    const candles = series ?? [];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const c of candles) {
      min = Math.min(min, c.l);
      max = Math.max(max, c.h);
    }
    const last = candles[candles.length - 1] ?? null;
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    return { candles, min, max, last };
  }, [series]);

  if (error) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>K线加载失败：{error}</div>;
  }

  if (!series) {
    return <div className={styles.banner}>K线加载中…</div>;
  }

  if (candles.length === 0) {
    return <div className={styles.banner}>暂无K线数据</div>;
  }

  const w = 920; // viewBox width
  const padX = 18;
  const padY = 14;
  const innerW = w - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / candles.length;
  const bodyW = clamp(step * 0.55, 3, 10);

  const y = (price: number) => {
    const t = (price - min) / (max - min || 1);
    return padY + (1 - t) * innerH;
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>日K线（最近 {candles.length} 根）</div>
        {last ? (
          <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}>
            {last.d}  O {fmt(last.o)}  H {fmt(last.h)}  L {fmt(last.l)}  C {fmt(last.c)}
          </div>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        style={{ marginTop: 10, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}
        preserveAspectRatio="none"
      >
        {/* grid */}
        {Array.from({ length: 4 }).map((_, i) => {
          const yy = padY + (innerH * (i + 1)) / 5;
          return <line key={i} x1={padX} x2={w - padX} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" />;
        })}

        {/* candles */}
        {candles.map((c, i) => {
          const cx = padX + i * step + step / 2;
          const openY = y(c.o);
          const closeY = y(c.c);
          const highY = y(c.h);
          const lowY = y(c.l);

          const up = c.c >= c.o;
          const stroke = up ? "#ff4d4f" : "#2fbf71"; // red up, green down
          const fill = up ? "rgba(255,77,79,0.55)" : "rgba(47,191,113,0.55)";

          const top = Math.min(openY, closeY);
          const bot = Math.max(openY, closeY);
          const bodyH = Math.max(2, bot - top);

          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={highY} y2={lowY} stroke={stroke} strokeWidth={1} />
              <rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={bodyH}
                fill={fill}
                stroke={stroke}
                strokeWidth={1}
                rx={1.5}
              />
            </g>
          );
        })}
      </svg>

      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.50)", fontSize: 11 }}>
        <div>Low {fmt(min)}</div>
        <div>High {fmt(max)}</div>
      </div>
    </div>
  );
}
