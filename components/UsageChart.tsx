import type { TooltipPayloadEntry } from 'recharts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCost, formatExact, formatMonth, formatShortDate, formatTokens } from '@/lib/format';
import type { UsageRow, View } from '@/lib/types';

/** Equal-chroma set that holds its contrast on both paper and ink. */
const PALETTE = {
  inputTokens: { light: '#0d9488', dark: '#5eead4' },
  outputTokens: { light: '#2563eb', dark: '#7dd3fc' },
  cacheCreationTokens: { light: '#b45309', dark: '#fcd34d' },
  cacheReadTokens: { light: '#64748b', dark: '#94a3b8' },
  totalTokens: { light: '#0f766e', dark: '#2dd4bf' },
  totalCost: { light: '#4d7c0f', dark: '#a3e635' },
} as const;

type PaintKey = keyof typeof PALETTE;
type Series = { key: PaintKey; label: string; color: string };

/** Stack order is bottom-to-top; the last entry gets the rounded cap. */
const DAILY_STACK: { key: PaintKey; label: string }[] = [
  { key: 'cacheReadTokens', label: 'Cache read' },
  { key: 'inputTokens', label: 'Input' },
  { key: 'outputTokens', label: 'Output' },
  { key: 'cacheCreationTokens', label: 'Cache write' },
];

const axis = { fontFamily: 'var(--font-mono)', fontSize: 10, tickLine: false, axisLine: false } as const;

function Readout({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  series: Series[];
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.map((entry) => {
    const key = String(entry.dataKey);
    const meta = series.find((s) => s.key === key);
    return { key, label: meta?.label ?? String(entry.name ?? key), color: meta?.color, value: Number(entry.value ?? 0) };
  });
  const tokens = rows.filter((row) => row.key !== 'totalCost');

  return (
    <div className="tooltip">
      <div className="tooltip__label">{label}</div>
      {rows.map((row) => (
        <div className="tooltip__row" key={row.key}>
          <span className="tooltip__key">
            <span className="tooltip__dot" style={{ background: row.color }} />
            {row.label}
          </span>
          <b>{row.key === 'totalCost' ? formatCost(row.value) : formatExact(row.value)}</b>
        </div>
      ))}
      {tokens.length > 1 && (
        <div className="tooltip__row tooltip__total">
          <span>Total tokens</span>
          <b>{formatExact(tokens.reduce((sum, row) => sum + row.value, 0))}</b>
        </div>
      )}
    </div>
  );
}

export function UsageChart({ rows, view, dark }: { rows: UsageRow[]; view: View; dark: boolean }) {
  const mode = dark ? 'dark' : 'light';
  const data = rows.map((row) => ({
    ...row,
    label: view === 'daily' ? formatShortDate(row.period) : formatMonth(row.period),
  }));

  const dailySeries: Series[] = DAILY_STACK.map((s) => ({ ...s, color: PALETTE[s.key][mode] }));
  const rendered: Series[] =
    view === 'daily'
      ? dailySeries
      : [
          { key: 'totalTokens', label: 'Total tokens', color: PALETTE.totalTokens[mode] },
          { key: 'totalCost', label: 'Cost', color: PALETTE.totalCost[mode] },
        ];

  const grid = dark ? '#232b26' : '#ddd7ca';
  const tick = dark ? '#8a958c' : '#6b736a';
  const costColor = PALETTE.totalCost[mode];
  // All-free models report $0 cost; don't advertise a series that isn't drawn.
  const showCost = data.some((row) => row.totalCost > 0);
  const legend = showCost ? rendered : rendered.filter((s) => s.key !== 'totalCost');

  return (
    <>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" {...axis} tick={{ fill: tick }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis yAxisId="tokens" {...axis} tick={{ fill: tick }} tickFormatter={formatTokens} width={54} />
            <YAxis
              yAxisId="cost"
              orientation="right"
              {...axis}
              tick={{ fill: costColor }}
              tickFormatter={formatCost}
              width={62}
              hide={!showCost}
            />
            <Tooltip
              cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }}
              content={<Readout series={rendered} />}
            />
            {view === 'daily'
              ? dailySeries.map((s, i) => (
                  <Bar
                    key={s.key}
                    yAxisId="tokens"
                    dataKey={s.key}
                    name={s.label}
                    stackId="tokens"
                    fill={s.color}
                    maxBarSize={54}
                    isAnimationActive={false}
                    radius={i === dailySeries.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))
              : (
                  <Bar
                    yAxisId="tokens"
                    dataKey="totalTokens"
                    name="Total tokens"
                    fill={PALETTE.totalTokens[mode]}
                    maxBarSize={92}
                    isAnimationActive={false}
                    radius={[3, 3, 0, 0]}
                  />
                )}
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="totalCost"
              name="Cost"
              stroke={costColor}
              strokeWidth={2}
              dot={{ r: 2.5, fill: costColor, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              hide={!showCost}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {legend.map((s) => (
          <span className="legend__item" key={s.key}>
            <span
              className="legend__swatch"
              style={
                s.key === 'totalCost'
                  ? { background: 'transparent', height: 0, borderTop: `2px solid ${s.color}` }
                  : { background: s.color }
              }
            />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}