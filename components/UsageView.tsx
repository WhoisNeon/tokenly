'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  ChartColumn,
  Clock,
  Coins,
  Database,
  Inbox,
  LoaderCircle,
  RefreshCw,
  Terminal,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';

import { AppShell } from '@/components/AppShell';
import { Select } from '@/components/Select';
import { SourceIcon } from '@/components/SourceIcon';
import { useTheme } from '@/components/ThemeToggle';
import { UsageChart } from '@/components/UsageChart';
import { UsageTable } from '@/components/UsageTable';
import { SOURCES } from '@/lib/types';
import { formatCost, formatExact, formatTokens } from '@/lib/format';
import type { ApiError, UsagePayload, View } from '@/lib/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: UsagePayload }
  | { status: 'error'; error: ApiError };

const VIEWS = [
  { value: 'daily', label: 'Daily', icon: Clock },
  { value: 'monthly', label: 'Monthly', icon: Calendar },
] as const;

const SOURCE_OPTIONS = SOURCES.map((source) => ({
  value: source,
  label: source === 'all' ? 'All sources' : source,
  icon: <SourceIcon source={source} />,
}));

/**
 * The report for one /usage/<view>/<source> URL. The URL holds the state, so
 * every control here navigates instead of keeping its own copy of it.
 */
export function UsageView({ view, source }: { view: View; source: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const { dark } = useTheme();

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/usage?view=${view}&source=${source}`, { signal });
      const body = (await res.json()) as UsagePayload | ApiError;
      if (!res.ok || 'error' in body) {
        setState({
          status: 'error',
          error: 'error' in body ? body : { error: `Request failed (${res.status}).` },
        });
        return;
      }
      setState({ status: 'ready', data: body });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ status: 'error', error: { error: (err as Error).message } });
    }
  }, [view, source]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const data = state.status === 'ready' ? state.data : null;
  const rows = data?.rows ?? [];
  const peak = rows.reduce((max, row) => Math.max(max, row.totalTokens), 0);
  const models = [...new Set(rows.flatMap((row) => row.modelsUsed))].sort();
  const bucketLabel = view === 'daily' ? 'Days' : 'Months';
  const stage = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties;
  const command = source === 'all' ? `ccusage ${view} --json` : `ccusage ${source} ${view} --json`;

  const go = (nextView: string, nextSource: string) => {
    router.push(`/usage/${nextView}/${nextSource}`);
  };

  return (
    <AppShell
      toolbar={
        <>
          <div className="segmented" role="group" aria-label="Time range">
            {VIEWS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="btn"
                  aria-pressed={view === option.value}
                  onClick={() => go(option.value, source)}
                >
                  <Icon size={13} aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Select
            label="Source"
            value={source}
            options={SOURCE_OPTIONS}
            onChange={(next) => go(view, next)}
          />

          <button
            type="button"
            className="btn btn--icon"
            onClick={() => load()}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </>
      }
      footer={
        <footer className="footer">
          <span className="footer__cmd">
            <Terminal size={11} aria-hidden="true" />
            <code>{command}</code>
          </span>
        </footer>
      }
    >
      <section className="stats reveal" style={stage(0)} aria-label="Summary">
        {[
          {
            label: 'Total tokens',
            value: formatTokens(data?.totals.totalTokens ?? 0),
            meta: formatExact(data?.totals.totalTokens ?? 0),
            icon: <Database size={11} aria-hidden="true" />,
          },
          {
            label: 'Total cost',
            value: formatCost(data?.totals.totalCost ?? 0),
            accent: true,
            icon: <Coins size={11} aria-hidden="true" />,
          },
          {
            label: bucketLabel,
            value: String(rows.length),
            icon: <CalendarDays size={11} aria-hidden="true" />,
          },
          {
            label: 'Peak bucket',
            value: formatTokens(peak),
            icon: <TrendingUp size={11} aria-hidden="true" />,
          },
        ].map((tile) => (
          <div className={`stat${tile.accent ? ' stat--accent' : ''}`} key={tile.label}>
            <div className="label">
              {tile.icon}
              {tile.label}
            </div>
            <div className="stat__value">{tile.value}</div>
            {tile.meta && <div className="stat__meta">{tile.meta}</div>}
          </div>
        ))}
      </section>

      {state.status === 'error' && (
        <div className="panel reveal" style={stage(1)}>
          <div className="state state--error">
            <TriangleAlert className="state__icon" size={22} aria-hidden="true" />
            <div className="state__title">Could not read usage</div>
            <p className="state__body">{state.error.error}</p>
            {state.error.hint && <p className="state__hint">{state.error.hint}</p>}
            <button type="button" className="btn" onClick={() => load()}>
              <RefreshCw size={13} aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="panel reveal" style={stage(1)}>
          <div className="panel__head">
            <h2 className="panel__title">Reading ccusage</h2>
            <span className="label">
              <LoaderCircle className="spin" size={12} aria-hidden="true" /> running ccusage
            </span>
          </div>
          <div className="skeleton" />
        </div>
      )}

      {state.status === 'ready' && rows.length === 0 && (
        <div className="panel reveal" style={stage(1)}>
          <div className="state">
            <Inbox className="state__icon" size={22} aria-hidden="true" />
            <div className="state__title">No data yet</div>
            <p className="state__body">
              {data?.notice ?? `No ${view} usage recorded.`} Start a coding agent session, then
              refresh.
            </p>
          </div>
        </div>
      )}

      {data && rows.length > 0 && (
        <>
          <section className="panel reveal" style={stage(1)}>
            <div className="panel__head">
              <h2 className="panel__title">
                {view === 'daily' ? 'Tokens & cost per day' : 'Tokens & cost per month'}
              </h2>
              <span className="label">
                {models.length} model{models.length === 1 ? '' : 's'} ·{' '}
                {source === 'all' ? 'all sources' : source}
              </span>
            </div>
            <UsageChart rows={rows} view={view} dark={dark} />
          </section>

          <section className="panel reveal" style={{ ...stage(2), marginTop: 22 }}>
            <div className="panel__head">
              <h2 className="panel__title">
                {view === 'daily' ? 'Daily breakdown' : 'Monthly breakdown'}
              </h2>
              <span className="label">
                {rows.length} {bucketLabel.toLowerCase()}
              </span>
            </div>
            <UsageTable rows={rows} totals={data.totals} view={view} />
          </section>
        </>
      )}
    </AppShell>
  );
}
