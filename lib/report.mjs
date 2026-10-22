import {
  AGENT_LABELS,
  DEFAULT_RANGES,
  MODEL_CATALOG_TTL_MS,
  REPORT_CACHE_TTL_MS,
  RANGES,
  getAgentLabel,
  getRange,
  isValidAgent,
  isValidReport,
} from './constants.mjs';
import { getRunnableConfig } from './config.mjs';
import { getCcusageVersion, runCcusage } from './ccusage.mjs';
import {
  AppError,
  asNonNegativeNumber,
  buildCommandDisplay,
  displayPath,
  truncateText,
} from './util.mjs';

const reportCache = new Map();
const reportInFlight = new Map();
let catalogCache = null;
let catalogInFlight = null;

function pad(number) {
  return String(number).padStart(2, '0');
}

export function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function resolveRange(report, rangeId, now = new Date()) {
  const range = getRange(report, rangeId);
  if (!range) {
    throw new AppError('INVALID_RANGE', 'That report range isn’t supported.', {
      status: 400,
      detail: `Range “${rangeId}” is not valid for the ${report} report.`,
    });
  }

  if (range.id === 'all') {
    return { ...range, since: null, until: null };
  }

  let start;
  if (range.days) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (range.days - 1));
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - (range.months - 1), 1);
  }

  return {
    ...range,
    since: formatLocalDate(start),
    until: formatLocalDate(now),
  };
}

export function buildReportInvocation({ report, agent, range, config }) {
  const args = [];
  if (agent !== 'all') args.push(agent);
  args.push(report, '--json');

  if (agent === 'all') args.push('--by-agent');
  args.push('--offline');

  if (config?.exists) {
    args.push('--config', config.path);
  }
  if (range.since) args.push('--since', range.since);
  if (range.until) args.push('--until', range.until);

  return {
    args,
    command: buildCommandDisplay(['ccusage', ...args]),
  };
}

function parseJsonOutput(output, command) {
  const text = output.replace(/^\uFEFF/, '').trim();
  if (!text) {
    throw new AppError('CCUSAGE_BAD_DATA', 'ccusage returned no data.', {
      status: 502,
      detail: 'The command completed successfully, but its standard output was empty.',
      hint: 'Update ccusage and try the report again.',
      extra: { command },
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    const objectStart = text.indexOf('{');
    const objectEnd = text.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        return JSON.parse(text.slice(objectStart, objectEnd + 1));
      } catch {
        // Show the original parse failure below.
      }
    }
  }

  throw new AppError('CCUSAGE_BAD_DATA', 'ccusage returned data Tokenly couldn’t read.', {
    status: 502,
    detail:
      'The command finished, but its output wasn’t valid JSON. Another program may have printed to the same output, or the ccusage version may be incompatible.',
    hint: 'Run the command below in your terminal and check the first lines of output.',
    extra: {
      command,
      outputSnippet: truncateText(text, 1_200),
    },
  });
}

function invalidRow(index, message, command) {
  return new AppError('CCUSAGE_BAD_DATA', 'ccusage returned an unexpected report shape.', {
    status: 502,
    detail: `Row ${index + 1}: ${message}`,
    hint: 'Update ccusage, then try again. Tokenly expects the JSON shape documented for daily and monthly reports.',
    extra: { command },
  });
}

function readToken(row, key, index, command, fallback = 0) {
  const value = row[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidRow(index, `“${key}” must be a non-negative number.`, command);
  }
  return value;
}

function readCost(row, index, command) {
  const value = row.totalCost ?? row.costUSD ?? row.cost;
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidRow(index, 'the cost must be a non-negative number.', command);
  }
  return value;
}

function normalizeBreakdown(raw, roster) {
  if (!Array.isArray(raw)) return [];
  const models = new Map();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const modelName = typeof item.modelName === 'string' ? item.modelName : null;
    if (!modelName) continue;
    const existing = models.get(modelName) ?? {
      modelName,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      cost: 0,
      missingPricing: false,
    };
    const inputTokens = asNonNegativeNumber(item.inputTokens);
    const outputTokens = asNonNegativeNumber(item.outputTokens);
    const cacheCreationTokens = asNonNegativeNumber(item.cacheCreationTokens);
    const cacheReadTokens = asNonNegativeNumber(item.cacheReadTokens);
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    existing.cacheCreationTokens += cacheCreationTokens;
    existing.cacheReadTokens += cacheReadTokens;
    existing.totalTokens += inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
    existing.cost += asNonNegativeNumber(item.cost);
    existing.missingPricing ||= item.missingPricing === true;
    models.set(modelName, existing);
    if (existing.missingPricing) roster.add(modelName);
  }
  return [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function normalizeAgents(raw, index, command) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw invalidRow(index, '“agents” must be an array when present.', command);
  }

  return raw
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.agent === 'string')
    .map((entry) => {
      const inputTokens = asNonNegativeNumber(entry.inputTokens);
      const outputTokens = asNonNegativeNumber(entry.outputTokens);
      const cacheCreationTokens = asNonNegativeNumber(entry.cacheCreationTokens);
      const cacheReadTokens = asNonNegativeNumber(entry.cacheReadTokens);
      return {
        agent: entry.agent,
        label: getAgentLabel(entry.agent),
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
        totalCost: asNonNegativeNumber(entry.totalCost),
        modelCount: Array.isArray(entry.modelBreakdowns) ? entry.modelBreakdowns.length : 0,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

function normalizeRows({ root, report, agent, command }) {
  const rawRows = root[report];
  if (!Array.isArray(rawRows)) {
    throw new AppError('CCUSAGE_BAD_DATA', 'ccusage returned an unexpected report shape.', {
      status: 502,
      detail: `The JSON response does not contain a “${report}” array.`,
      hint: 'Update ccusage, then try again.',
      extra: { command },
    });
  }

  const unpricedRoster = new Set(
    Array.isArray(root.totals?.unpricedModels) ? root.totals.unpricedModels : [],
  );

  const rows = rawRows.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw invalidRow(index, 'the row is not an object.', command);
    }
    const period = raw.period ?? raw.date ?? raw.month;
    const expected = report === 'daily' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
    if (typeof period !== 'string' || !expected.test(period)) {
      throw invalidRow(index, `the period “${period ?? ''}” is not ${report === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM'}.`, command);
    }

    const inputTokens = readToken(raw, 'inputTokens', index, command);
    const outputTokens = readToken(raw, 'outputTokens', index, command);
    const cacheCreationTokens = readToken(raw, 'cacheCreationTokens', index, command);
    const cacheReadTokens = readToken(raw, 'cacheReadTokens', index, command);
    const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
    const totalCost = readCost(raw, index, command);
    const models = normalizeBreakdown(raw.modelBreakdowns, unpricedRoster);
    const agents = normalizeAgents(raw.agents, index, command);
    const rowAgent = agent === 'all' ? 'all' : agent;
    const row = {
      period,
      agent: rowAgent,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      totalCost,
      models,
      agents:
        agent === 'all'
          ? agents
          : [
              {
                agent,
                label: getAgentLabel(agent),
                inputTokens,
                outputTokens,
                cacheCreationTokens,
                cacheReadTokens,
                totalTokens,
                totalCost,
                modelCount: models.length,
              },
            ],
      modelsUsed:
        Array.isArray(raw.modelsUsed) && raw.modelsUsed.every((item) => typeof item === 'string')
          ? raw.modelsUsed
          : models.map((model) => model.modelName),
      missingPricing:
        raw.missingPricing === true || models.some((model) => model.missingPricing),
    };
    return row;
  });

  rows.sort((a, b) => a.period.localeCompare(b.period));
  return { rows, unpricedRoster };
}

function addTotals(target, row) {
  target.inputTokens += row.inputTokens;
  target.outputTokens += row.outputTokens;
  target.cacheCreationTokens += row.cacheCreationTokens;
  target.cacheReadTokens += row.cacheReadTokens;
  target.totalTokens += row.totalTokens;
  target.totalCost += row.totalCost;
}

function emptyTotals() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost: 0,
  };
}

function aggregateAgents(rows, report, agent) {
  if (agent !== 'all') {
    const totals = emptyTotals();
    for (const row of rows) addTotals(totals, row);
    return [
      {
        agent,
        label: getAgentLabel(agent),
        ...totals,
      },
    ];
  }

  const byAgent = new Map();
  for (const row of rows) {
    for (const entry of row.agents) {
      const existing = byAgent.get(entry.agent) ?? {
        agent: entry.agent,
        label: entry.label,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        periods: 0,
      };
      existing.inputTokens += entry.inputTokens;
      existing.outputTokens += entry.outputTokens;
      existing.cacheCreationTokens += entry.cacheCreationTokens;
      existing.cacheReadTokens += entry.cacheReadTokens;
      existing.totalTokens += entry.totalTokens;
      existing.totalCost += entry.totalCost;
      existing.periods += 1;
      byAgent.set(entry.agent, existing);
    }
  }

  return [...byAgent.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function aggregateModels(rows, roster) {
  const byModel = new Map();
  for (const row of rows) {
    for (const model of row.models) {
      const existing = byModel.get(model.modelName) ?? {
        modelName: model.modelName,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        missingPricing: false,
        periods: 0,
      };
      existing.inputTokens += model.inputTokens;
      existing.outputTokens += model.outputTokens;
      existing.cacheCreationTokens += model.cacheCreationTokens;
      existing.cacheReadTokens += model.cacheReadTokens;
      existing.totalTokens += model.totalTokens;
      existing.totalCost += model.cost;
      existing.periods += 1;
      existing.missingPricing ||= model.missingPricing;
      byModel.set(model.modelName, existing);
      if (model.missingPricing) roster.add(model.modelName);
    }
  }
  return [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

async function executeReport({ report, agent, range, config }) {
  const started = Date.now();
  const { args, command } = buildReportInvocation({ report, agent, range, config });

  const versionPromise = getCcusageVersion().catch(() => null);
  const result = await runCcusage(args, { displayCommand: command });
  const durationMs = Date.now() - started;
  const versionInfo = await versionPromise;
  const root = parseJsonOutput(result.stdout, command);
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new AppError('CCUSAGE_BAD_DATA', 'ccusage returned an unexpected report shape.', {
      status: 502,
      detail: 'The top-level JSON value is not an object.',
      hint: 'Update ccusage, then try again.',
      extra: { command },
    });
  }

  const { rows, unpricedRoster } = normalizeRows({ root, report, agent, command });
  const totals = emptyTotals();
  for (const row of rows) addTotals(totals, row);

  const agents = aggregateAgents(rows, report, agent);
  const models = aggregateModels(rows, unpricedRoster);
  for (const modelName of unpricedRoster) {
    if (!models.some((model) => model.modelName === modelName)) {
      models.push({
        modelName,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        missingPricing: true,
        periods: 0,
      });
    }
  }
  models.sort((a, b) => b.totalTokens - a.totalTokens);

  const unpricedModels = [...unpricedRoster].sort((a, b) => a.localeCompare(b));
  const warnings = [];
  if (unpricedModels.length > 0) {
    warnings.push({
      code: 'UNPRICED_MODELS',
      title: 'Some models have no known price',
      message: `${unpricedModels.length} ${unpricedModels.length === 1 ? 'model is' : 'models are'} being counted at $0 because ccusage has no pricing for ${unpricedModels.length === 1 ? 'it' : 'them'}. Add a rate in Settings if that looks wrong.`,
      models: unpricedModels,
    });
  }

  const detectedAgents = agents.map((entry) => ({
    id: entry.agent,
    label: entry.label || AGENT_LABELS[entry.agent] || entry.agent,
    totalTokens: entry.totalTokens,
  }));

  return {
    ok: true,
    report,
    agent,
    agentLabel: getAgentLabel(agent),
    range,
    rows,
    totals: {
      ...totals,
      unpricedModels,
    },
    agents,
    models,
    detectedAgents,
    counts: {
      periods: rows.length,
      agents: agents.length,
      models: models.length,
      unpricedModels: unpricedModels.length,
    },
    warnings,
    command,
    meta: {
      generatedAt: new Date().toISOString(),
      durationMs,
      version: versionInfo?.version ?? null,
      resolvedPath: result.strategy.resolvedPath ?? null,
      configPath: config.path,
      configDisplayPath: displayPath(config.path),
      configExists: config.exists,
      offline: true,
      mode: agent === 'all' ? 'unified' : 'focused',
      platform: process.platform,
    },
  };
}

function cacheKey({ report, agent, range, config }) {
  return [
    report,
    agent,
    range.id,
    config.path,
    config.exists ? config.modifiedAt ?? 'present' : 'missing',
  ].join('|');
}

export async function getReport(
  { report = 'daily', agent = 'all', rangeId = null, force = false } = {},
) {
  if (!isValidReport(report)) {
    throw new AppError('INVALID_REPORT', 'That report type isn’t supported.', {
      status: 400,
      detail: 'Choose either the daily or monthly report.',
    });
  }
  if (!isValidAgent(agent)) {
    throw new AppError('INVALID_AGENT', 'That agent isn’t supported.', {
      status: 400,
      detail: `“${agent}” is not a known ccusage source.`,
    });
  }
  const requestedRangeId = rangeId ?? DEFAULT_RANGES[report];
  const range = resolveRange(report, requestedRangeId);
  const config = await getRunnableConfig();
  const key = cacheKey({ report, agent, range, config });
  const now = Date.now();

  if (!force) {
    const cached = reportCache.get(key);
    if (cached && now - cached.createdAt < REPORT_CACHE_TTL_MS) {
      return {
        ...cached.value,
        cache: { hit: true, ageMs: now - cached.createdAt },
      };
    }
    if (reportInFlight.has(key)) {
      return reportInFlight.get(key);
    }
  }

  const pending = executeReport({ report, agent, range, config })
    .then((value) => {
      reportCache.set(key, { createdAt: Date.now(), value });
      return { ...value, cache: { hit: false, ageMs: 0 } };
    })
    .finally(() => {
      reportInFlight.delete(key);
    });

  reportInFlight.set(key, pending);
  return pending;
}

export function clearReportCache() {
  reportCache.clear();
  reportInFlight.clear();
  catalogCache = null;
}

export async function getDetectedModels({ force = false } = {}) {
  const now = Date.now();
  if (!force && catalogCache && now - catalogCache.createdAt < MODEL_CATALOG_TTL_MS) {
    return catalogCache.value;
  }
  if (!force && catalogInFlight) return catalogInFlight;

  catalogInFlight = (async () => {
    const report = await getReport({ report: 'daily', agent: 'all', rangeId: '90d' });
    const models = report.models.map((model) => ({
      modelName: model.modelName,
      totalTokens: model.totalTokens,
      totalCost: model.totalCost,
      missingPricing: model.missingPricing,
      periods: model.periods,
    }));
    const value = {
      models,
      reportRange: report.range,
      generatedAt: report.meta.generatedAt,
      command: report.command,
      warnings: report.warnings,
    };
    catalogCache = { createdAt: Date.now(), value };
    return value;
  })().finally(() => {
    catalogInFlight = null;
  });

  return catalogInFlight;
}

export function getRangesForReport(report) {
  return RANGES[report] ?? [];
}
