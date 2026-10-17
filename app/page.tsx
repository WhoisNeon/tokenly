'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import { Logo } from '@/components/Logo';
import { ThemeToggle, useTheme } from '@/components/ThemeToggle';
import { UsageChart } from '@/components/UsageChart';
import { UsageTable } from '@/components/UsageTable';
import { SOURCES } from '@/lib/types';
import { formatCost, formatExact, formatTokens } from '@/lib/format';
import type { ApiError, UsagePayload, View } from '@/lib/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: UsagePayload }
  | { status: 'error'; error: ApiError };

export default function Dashboard() {
  const [view, setView] = useState<View>('daily');
  const [source, setSource] = useState<string>('all');
  const [state, setState] = useState<State>({ status: 'loading' });
  const { dark, toggle } = useTheme();

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

  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <a className="brand" href="/">
            <Logo size={30} />
            <span className="brand__text">
              <span className="brand__word">
                Token<span>ly</span>
              </span>
              <span className="brand__sub">agent usage telemetry</span>
            </span>
          </a>

          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Time range">
              {(['daily', 'monthly'] as View[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="btn"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <label className="label" htmlFor="source">
              Source
            </label>
            <select
              id="source"
              className="select"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              {SOURCES.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All sources' : option}
                </option>
              ))}
            </select>

            <button type="button" className="btn" onClick={() => load()} title="Refresh">
              <span aria-hidden="true">⟳</span>
              <span className="sr-only">Refresh</span>
            </button>

            <ThemeToggle dark={dark} onToggle={toggle} />
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="stats reveal" style={stage(0)} aria-label="Summary">
          {[
            {
              label: 'Total tokens',
              value: formatTokens(data?.totals.totalTokens ?? 0),
              meta: formatExact(data?.totals.totalTokens ?? 0),
            },
            { label: 'Total cost', value: formatCost(data?.totals.totalCost ?? 0), accent: true },
            { label: bucketLabel, value: String(rows.length) },
            { label: 'Peak bucket', value: formatTokens(peak) },
          ].map((tile) => (
            <div className={`stat${tile.accent ? ' stat--accent' : ''}`} key={tile.label}>
              <div className="label">{tile.label}</div>
              <div className="stat__value">{tile.value}</div>
              {tile.meta && <div className="stat__meta">{tile.meta}</div>}
            </div>
          ))}
        </section>

        {state.status === 'error' && (
          <div className="panel reveal" style={stage(1)}>
            <div className="state state--error">
              <div className="state__title">Could not read usage</div>
              <p className="state__body">{state.error.error}</p>
              {state.error.hint && <p className="state__hint">{state.error.hint}</p>}
              <button type="button" className="btn" onClick={() => load()}>
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
                <span className="spinner" style={{ display: 'inline-block', verticalAlign: -2 }} /> running ccusage
              </span>
            </div>
            <div className="skeleton" />
          </div>
        )}

        {state.status === 'ready' && rows.length === 0 && (
          <div className="panel reveal" style={stage(1)}>
            <div className="state">
              <div className="state__title">No data yet</div>
              <p className="state__body">
                {data?.notice ?? `No ${view} usage recorded.`} Start a coding agent session, then refresh.
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
      </main>

      <footer className="footer">
        <span>
          Powered by <code>ccusage</code>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <code>{source === 'all' ? `ccusage ${view} --json` : `ccusage ${source} ${view} --json`}</code>
        </span>
      </footer>
    </>
  );
}