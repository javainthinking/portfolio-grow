"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  IChartApi,
  Time,
} from "lightweight-charts";

type Candle = { d: string; o: number; h: number; l: number; c: number };

function toBusinessDay(d: string) {
  // d: YYYY-MM-DD
  const [y, m, day] = d.split("-").map((x) => Number(x));
  return { year: y, month: m, day };
}

export default function CandlesTV({
  candles,
  height = 320,
}: {
  candles: Candle[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const data = useMemo(() => {
    const out: CandlestickData<Time>[] = [];
    for (const c of candles) {
      if (!c?.d) continue;
      out.push({
        time: toBusinessDay(c.d),
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      });
    }
    return out;
  }, [candles]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clean up if hot-reloading or rerendering
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(el, {
      height,
      width: el.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" },
        textColor: "rgba(255,255,255,0.75)",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.10)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.10)",
        timeVisible: true,
        rightOffset: 6,
        barSpacing: 6,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(255,255,255,0.25)",
          labelBackgroundColor: "rgba(255,255,255,0.14)",
        },
        horzLine: {
          color: "rgba(255,255,255,0.25)",
          labelBackgroundColor: "rgba(255,255,255,0.14)",
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      // CN-style: red up, green down
      upColor: "#ff4d4f",
      downColor: "#2fbf71",
      borderUpColor: "#ff4d4f",
      borderDownColor: "#2fbf71",
      wickUpColor: "#ff4d4f",
      wickDownColor: "#2fbf71",
    });

    series.setData(data);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
