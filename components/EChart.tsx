"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts";

interface EChartProps {
  option: EChartsCoreOption;
  height?: number | string;
  className?: string;
  onClick?: (params: { dataIndex: number; name: string; value: unknown }) => void;
}

/**
 * 轻量 ECharts 封装。
 * echarts 与 echarts-wordcloud 在模块顶层会访问 window，
 * 因此在客户端 useEffect 内动态加载，避免 SSR 阶段报 window is not defined。
 */
export default function EChart({
  option,
  height = 320,
  className,
  onClick,
}: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const instRef = useRef<ECharts | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const optionRef = useRef(option);
  optionRef.current = option;

  useEffect(() => {
    let disposed = false;
    let resizeHandler: (() => void) | undefined;
    let resizeObserver: ResizeObserver | undefined;

    (async () => {
      const echarts = await import("echarts");
      await import("echarts-wordcloud");
      if (disposed || !ref.current) return;

      const inst = echarts.init(ref.current, undefined, { renderer: "canvas" });
      instRef.current = inst;
      inst.on("click", (params) => {
        onClickRef.current?.(
          params as unknown as {
            dataIndex: number;
            name: string;
            value: unknown;
          }
        );
      });
      inst.setOption(optionRef.current, true);

      resizeHandler = () => inst.resize();
      window.addEventListener("resize", resizeHandler);

      resizeObserver = new ResizeObserver(() => {
        if (ref.current && ref.current.clientWidth > 0) {
          inst.resize();
        }
      });
      resizeObserver.observe(ref.current);
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      instRef.current?.dispose();
      instRef.current = null;
    };
  }, []);

  useEffect(() => {
    instRef.current?.setOption(option, true);
    requestAnimationFrame(() => instRef.current?.resize());
  }, [option]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", height, cursor: onClick ? "pointer" : "default" }}
    />
  );
}
