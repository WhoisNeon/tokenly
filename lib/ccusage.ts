import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { UsagePayload, UsageRow, UsageTotals, View } from './types';

const exec = promisify(execFile);

const CLI = 'ccusage';
const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 32 * 1024 * 1024;

export class CcusageError extends Error {
  readonly hint?: string;
  readonly status: number;

  constructor(message: string, hint?: string, status = 502) {
    super(message);
    this.name = 'CcusageError';
    this.hint = hint;
    this.status = status;
  }
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * The unified report labels its buckets `period`, the per-source report uses
 * `date` (daily) or `month` (monthly). Flatten all three into one key.
 */
function normalizeRow(raw: Record<string, unknown>): UsageRow {
  const metadata = (raw.metadata ?? {}) as Record<string, unknown>;
  return {
    period: String(raw.period ?? raw.date ?? raw.month ?? ''),
    inputTokens: num(raw.inputTokens),
    outputTokens: num(raw.outputTokens),
    cacheCreationTokens: num(raw.cacheCreationTokens),
    cacheReadTokens: num(raw.cacheReadTokens),
    totalTokens: num(raw.totalTokens),
    totalCost: num(raw.totalCost),
    modelsUsed: strList(raw.modelsUsed),
    agents: strList(metadata.agents),
  };
}

function normalizeTotals(raw: unknown): UsageTotals {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    inputTokens: num(t.inputTokens),
    outputTokens: num(t.outputTokens),
    cacheCreationTokens: num(t.cacheCreationTokens),
    cacheReadTokens: num(t.cacheReadTokens),
    totalTokens: num(t.totalTokens),
    totalCost: num(t.totalCost),
  };
}

/** `ccusage <source> daily --json`, or `ccusage daily --json` when source is `all`. */
export function buildArgs(view: View, source: string): string[] {
  return source === 'all' ? [view, '--json'] : [source, view, '--json'];
}

export async function fetchUsage(view: View, source: string): Promise<UsagePayload> {
  const args = buildArgs(view, source);
  const command = `${CLI} ${args.join(' ')}`;

  let stdout: string;
  try {
    // `shell: true` is required because Windows exposes ccusage as a .cmd shim,
    // which CreateProcess cannot launch directly. Safe: every argument here is
    // matched against SOURCES/VIEWS before it reaches this line.
    ({ stdout } = await exec(command, {
      shell: true,
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    }));
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };

    if (e.killed) {
      throw new CcusageError(
        `\`${command}\` timed out after ${TIMEOUT_MS / 1000}s.`,
        'ccusage scans your whole usage history — try again once it has cached pricing data.',
        504,
      );
    }
    if (e.code === 'ENOENT' || /not recognized|not found/i.test(e.stderr ?? '')) {
      throw new CcusageError(
        'The ccusage CLI was not found on your PATH.',
        'Install it with `npm install -g ccusage`, then restart this server.',
        404,
      );
    }
    throw new CcusageError(
      `\`${command}\` failed: ${(e.stderr || e.message).trim().split('\n')[0]}`,
      undefined,
      502,
    );
  }

  let parsed: { daily?: unknown[]; monthly?: unknown[]; totals?: unknown };
  try {
    parsed = JSON.parse(stdout) as typeof parsed;
  } catch {
    throw new CcusageError(
      'ccusage returned output that is not valid JSON.',
      'Run `ccusage daily --json` in your terminal to see what it produces.',
    );
  }

  const rows = (view === 'daily' ? parsed.daily : parsed.monthly) ?? [];
  if (!Array.isArray(rows)) {
    throw new CcusageError(`ccusage returned an unexpected shape for "${command}".`);
  }

  const normalized = rows
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row) => row.period !== '')
    .sort((a, b) => a.period.localeCompare(b.period));

  const label = source === 'all' ? 'any detected agent' : source;
  return {
    view,
    source,
    rows: normalized,
    totals: normalizeTotals(parsed.totals),
    notice: normalized.length === 0 ? `No ${view} usage recorded for ${label}.` : undefined,
  };
}