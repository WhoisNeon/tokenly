export const APP_NAME = 'Tokenly';
export const APP_VERSION = '1.0.0';

/**
 * The source namespaces understood by the ccusage version this dashboard was
 * built against. ccusage validates them itself; this list powers the picker
 * and keeps API input on a short allowlist.
 */
export const SUPPORTED_AGENTS = Object.freeze([
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'amp', label: 'Amp' },
  { id: 'droid', label: 'Droid' },
  { id: 'codebuff', label: 'Codebuff' },
  { id: 'hermes', label: 'Hermes Agent' },
  { id: 'pi', label: 'pi-agent' },
  { id: 'goose', label: 'Goose' },
  { id: 'openclaw', label: 'OpenClaw' },
  { id: 'kilo', label: 'Kilo' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'qwen', label: 'Qwen' },
  { id: 'copilot', label: 'Copilot CLI' },
  { id: 'gemini', label: 'Gemini CLI' },
  { id: 'antigravity', label: 'Antigravity' },
  { id: 'grok', label: 'Grok Build CLI' },
  { id: 'zcode', label: 'ZCode' },
]);

export const AGENT_IDS = new Set(SUPPORTED_AGENTS.map((agent) => agent.id));

export const AGENT_LABELS = Object.freeze(
  Object.fromEntries(SUPPORTED_AGENTS.map((agent) => [agent.id, agent.label])),
);

export const REPORTS = Object.freeze(['daily', 'monthly']);

export const RANGES = Object.freeze({
  daily: Object.freeze([
    { id: '7d', label: '7 days', short: '7D', days: 7 },
    { id: '30d', label: '30 days', short: '30D', days: 30 },
    { id: '90d', label: '90 days', short: '90D', days: 90 },
    { id: 'all', label: 'All time', short: 'ALL' },
  ]),
  monthly: Object.freeze([
    { id: '6m', label: '6 months', short: '6M', months: 6 },
    { id: '12m', label: '12 months', short: '12M', months: 12 },
    { id: '24m', label: '24 months', short: '24M', months: 24 },
    { id: 'all', label: 'All time', short: 'ALL' },
  ]),
});

export const DEFAULT_RANGES = Object.freeze({ daily: '30d', monthly: '12m' });

export const PRICING_FIELDS = Object.freeze([
  {
    key: 'inputCostPerToken',
    apiKey: 'inputCostPerMillion',
    label: 'Input',
    short: 'In',
    description: 'Uncached input tokens',
  },
  {
    key: 'outputCostPerToken',
    apiKey: 'outputCostPerMillion',
    label: 'Output',
    short: 'Out',
    description: 'Generated output tokens',
  },
  {
    key: 'cacheReadInputTokenCost',
    apiKey: 'cacheReadCostPerMillion',
    label: 'Cache read',
    short: 'Read',
    description: 'Tokens read from the prompt cache',
  },
  {
    key: 'cacheCreationInputTokenCost',
    apiKey: 'cacheCreationCostPerMillion',
    label: 'Cache write',
    short: 'Write',
    description: 'Tokens written into the prompt cache',
  },
]);

export const BASE_PRICING_KEYS = new Set(PRICING_FIELDS.map((field) => field.key));

export const DEFAULT_CONFIG_PATH_SEGMENTS = ['.config', 'claude', 'ccusage.json'];

export const COMMAND_TIMEOUT_MS = 180_000;
export const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 1_000_000;
export const MAX_PRICING_OVERRIDES = 500;
export const MAX_MODEL_NAME_LENGTH = 200;
export const MAX_PRICE_PER_MILLION = 1_000_000;
export const REPORT_CACHE_TTL_MS = 20_000;
export const MODEL_CATALOG_TTL_MS = 60_000;

export function isValidAgent(agent) {
  return agent === 'all' || AGENT_IDS.has(agent);
}

export function isValidReport(report) {
  return REPORTS.includes(report);
}

export function getRange(report, rangeId) {
  const ranges = RANGES[report];
  if (!ranges) return null;
  return ranges.find((range) => range.id === rangeId) ?? null;
}

export function getAgentLabel(agent) {
  if (agent === 'all') return 'All agents';
  return AGENT_LABELS[agent] ?? agent;
}
