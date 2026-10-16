/**
 * Chart — an ECharts React island.
 *
 * Usage:
 *   <Chart client:only="react"
 *          spec={{ title: { text: 'Compound growth' }, xAxis: { type: 'category', data: [...] }, ... }}
 *          height={360} />
 *
 * The spec is a partial ECharts option object; the component merges it with a
 * sensible default style (dark-aware axes, brass accent). We keep all chart
 * config data-driven so articles or pages can ship a chart without importing
 * ECharts directly.
 */
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartProps {
  spec?: Record<string, unknown>;
  height?: number;
  className?: string;
}

export default function Chart({ spec = {}, height = 320, className = '' }: ChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = echarts.init(el, undefined, { renderer: 'svg' });
    const defaults = {
      textStyle: { fontFamily: 'Inter, system-ui, sans-serif' },
      color: ['#b8860b', '#1e6b8b', '#7a3b1e', '#3a7d44', '#a855f7'],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 32, bottom: 32, containLabel: true },
      xAxis: { type: 'category' },
      yAxis: { type: 'value' },
    };
    instance.setOption({ ...defaults, ...spec }, true);

    const onResize = () => instance.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      instance.dispose();
    };
  }, [spec, height]);

  return (
    <div
      ref={ref}
      className={`w-full rounded-lg border border-[var(--color-ink-100)] bg-[var(--color-paper)] dark:border-[var(--color-ink-800)] dark:bg-[var(--color-ink-900)] ${className}`}
      style={{ width: '100%', height }}
      aria-hidden={false}
    />
  );
}
