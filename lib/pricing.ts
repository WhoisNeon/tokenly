import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { ModelPrice, PricingPayload } from './types';

/**
 * ccusage auto-discovers its config here, so writing to this file is enough —
 * no `--config` flag needed. The `.claude` segment is not a coincidence: the
 * CLI looks for `<config home>/claude/ccusage.json`.
 */
export const CONFIG_PATH = join(homedir(), '.config', 'claude', 'ccusage.json');

const SCHEMA_URL = 'https://ccusage.com/config-schema.json';

/** ccusage prices in dollars per token; humans price per million. */
const PER_MILLION = 1e6;

type Override = Record<string, number>;

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Read the price overrides out of a parsed ccusage config. */
function readOverrides(config: unknown): Map<string, ModelPrice> {
  const defaults = (config as { defaults?: { pricingOverrides?: Record<string, Override> } })
    ?.defaults;
  const overrides = defaults?.pricingOverrides ?? {};
  const prices = new Map<string, ModelPrice>();

  for (const [model, override] of Object.entries(overrides)) {
    prices.set(model, {
      model,
      input: num(override.inputCostPerToken) * PER_MILLION,
      output: num(override.outputCostPerToken) * PER_MILLION,
      cacheRead: num(override.cacheReadInputTokenCost) * PER_MILLION,
      cacheCreation: num(override.cacheCreationInputTokenCost) * PER_MILLION,
    });
  }

  return prices;
}

async function readConfig(path: string): Promise<{ config: Record<string, unknown>; missing: boolean }> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { config: {}, missing: true };
    throw err;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    return { config: parsed as Record<string, unknown>, missing: false };
  } catch (err) {
    throw new Error(
      `${path} is not valid JSON (${(err as Error).message}). Fix or delete it, then reload.`,
    );
  }
}

/** The config as ccusage expects it, with `defaults.pricingOverrides` replaced. */
function buildConfig(
  config: Record<string, unknown>,
  prices: ModelPrice[],
): Record<string, unknown> {
  const defaults = (config.defaults ?? {}) as Record<string, unknown>;
  const pricingOverrides: Record<string, Override> = {};

  for (const price of prices) {
    pricingOverrides[price.model] = {
      inputCostPerToken: price.input / PER_MILLION,
      outputCostPerToken: price.output / PER_MILLION,
      cacheReadInputTokenCost: price.cacheRead / PER_MILLION,
      cacheCreationInputTokenCost: price.cacheCreation / PER_MILLION,
    };
  }

  return {
    ...config,
    $schema: SCHEMA_URL,
    defaults: { ...defaults, pricingOverrides },
  };
}

export async function readPricing(path = CONFIG_PATH): Promise<PricingPayload> {
  const { config, missing } = await readConfig(path);
  return {
    path,
    missing,
    prices: [...readOverrides(config).values()].sort((a, b) => a.model.localeCompare(b.model)),
    agentOverrides: findAgentOverrides(config),
  };
}

/**
 * ccusage lets each agent carry its own `pricingOverrides`, and those win over
 * `defaults`. Editing only `defaults` would leave the agent's copy in charge,
 * so the UI has to know which agents are pinned.
 */
function findAgentOverrides(config: Record<string, unknown>): string[] {
  const agents: string[] = [];
  for (const [name, value] of Object.entries(config)) {
    if (name === 'defaults' || name === '$schema') continue;
    const overrides = (value as { defaults?: { pricingOverrides?: unknown } })?.defaults
      ?.pricingOverrides;
    if (overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0) {
      agents.push(name);
    }
  }
  return agents.sort();
}

/**
 * JSON.stringify writes small numbers in exponent form (`3e-7`). The config
 * file is read and edited by people, so expand them back to plain decimals.
 * The lookbehind keeps a model name like `gemini-3e-7` out of it.
 */
function plainDecimals(json: string): string {
  return json.replace(/(?<![\w.-])(\d+(?:\.\d+)?)e-(\d+)/g, (match, mantissa: string, exponent: string) => {
    const digits = mantissa.replace('.', '');
    const point = digits.length - Number(exponent);
    if (point > 0) return `${digits.slice(0, point)}.${digits.slice(point)}`;
    return `0.${'0'.repeat(-point)}${digits}`;
  });
}

/**
 * Write the prices back, keeping every other key in the file intact. A model
 * priced at $0 is written as $0, not dropped: ccusage reads a missing field as
 * $0 anyway, but the entry itself is what marks the model as priced rather
 * than unknown, and dropping it would silently hand the model back to
 * ccusage's own table.
 */
export async function writePricing(
  prices: ModelPrice[],
  path = CONFIG_PATH,
): Promise<PricingPayload> {
  const { config } = await readConfig(path);

  await mkdir(dirname(path), { recursive: true });
  const json = plainDecimals(JSON.stringify(buildConfig(config, prices), null, 2));
  await writeFile(path, `${json}\n`, 'utf8');

  return {
    path,
    missing: false,
    prices,
    agentOverrides: findAgentOverrides(config),
  };
}
