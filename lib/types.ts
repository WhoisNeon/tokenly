export type View = 'daily' | 'monthly';

export const VIEWS = ['daily', 'monthly'] as const satisfies readonly View[];

/**
 * Agent subcommands the ccusage CLI exposes, plus `all` for the unified report.
 * Lives here rather than in `ccusage.ts` so the client can import it without
 * dragging `node:child_process` into the browser bundle.
 */
export const SOURCES = [
  'all',
  'opencode',
  'claude',
  'codex',
  'gemini',
  'amp',
  'droid',
  'codebuff',
  'hermes',
  'pi',
  'goose',
  'kilo',
  'copilot',
  'antigravity',
  'kimi',
  'qwen',
  'openclaw',
  'grok',
  'zcode',
] as const;

export type Source = (typeof SOURCES)[number];

export function isSource(value: string): value is Source {
  return (SOURCES as readonly string[]).includes(value);
}

/** One bucket of usage. `period` is `YYYY-MM-DD` for daily and `YYYY-MM` for monthly. */
export type UsageRow = {
  period: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  agents: string[];
};

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  /** Models ccusage has no price for; their tokens are counted at $0. */
  unpricedModels: string[];
};

export type UsagePayload = {
  view: View;
  source: string;
  rows: UsageRow[];
  totals: UsageTotals;
  /** Set when the command succeeded but there is nothing to show. */
  notice?: string;
};

export type ApiError = {
  error: string;
  hint?: string;
};

/**
 * A model's price override, in dollars per million tokens. ccusage stores the
 * raw per-token rate, but nobody prices anything in 0.000003 dollars.
 */
export type ModelPrice = {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
};

export type PricingPayload = {
  /** Absolute path of the ccusage config file that was read. */
  path: string;
  /** True when the file does not exist yet and will be created on save. */
  missing: boolean;
  prices: ModelPrice[];
  /** Agents whose own config block sets prices, overriding `defaults`. */
  agentOverrides: string[];
};