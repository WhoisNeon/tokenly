import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { readPricing, writePricing } from './pricing.ts';

const scratch = () => mkdtemp(join(tmpdir(), 'tokenly-'));

test('prices round-trip through the ccusage config', async () => {
  const path = join(await scratch(), 'ccusage.json');
  await writeFile(
    path,
    JSON.stringify({
      $schema: 'https://ccusage.com/config-schema.json',
      defaults: { pricingOverrides: { 'old-model': { inputCostPerToken: 0.000003 } } },
    }),
  );

  const written = await writePricing(
    [{ model: 'new-model', input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 }],
    path,
  );

  const raw = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(raw.defaults.pricingOverrides['new-model'].inputCostPerToken, 0.000003);
  assert.equal(raw.defaults.pricingOverrides['new-model'].outputCostPerToken, 0.000015);
  // A field ccusage does not know is left at $0 rather than dropped.
  assert.equal(raw.defaults.pricingOverrides['new-model'].cacheReadInputTokenCost, 0.0000003);
  assert.equal(raw.defaults.pricingOverrides['new-model'].cacheCreationInputTokenCost, 0.00000375);
  // The old model is gone — the table is the source of truth.
  assert.equal(raw.defaults.pricingOverrides['old-model'], undefined);
  assert.equal(written.prices.length, 1);
});

test('other keys in the config survive a write', async () => {
  const path = join(await scratch(), 'ccusage.json');
  await writeFile(
    path,
    JSON.stringify({ $schema: 'x', opencode: { defaults: { timezone: 'UTC' } }, extra: 1 }),
  );

  await writePricing([{ model: 'm', input: 1, output: 1, cacheRead: 0, cacheCreation: 0 }], path);

  const raw = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(raw.opencode, { defaults: { timezone: 'UTC' } });
  assert.equal(raw.extra, 1);
});

test('a missing config is reported and created on save', async () => {
  const path = join(await scratch(), 'nested', 'ccusage.json');

  const before = await readPricing(path);
  assert.equal(before.missing, true);
  assert.deepEqual(before.prices, []);

  await writePricing([{ model: 'm', input: 2, output: 4, cacheRead: 0, cacheCreation: 0 }], path);
  assert.equal((await readPricing(path)).missing, false);
});

test('agents that set their own prices are reported', async () => {
  const path = join(await scratch(), 'ccusage.json');
  await writeFile(
    path,
    JSON.stringify({
      defaults: { pricingOverrides: { m: { inputCostPerToken: 0.000001 } } },
      opencode: { defaults: { pricingOverrides: { m: { inputCostPerToken: 0.000002 } } } },
    }),
  );

  const pricing = await readPricing(path);
  assert.deepEqual(pricing.agentOverrides, ['opencode']);
});

test('an invalid config file is reported, not silently overwritten', async () => {
  const path = join(await scratch(), 'ccusage.json');
  await writeFile(path, '{ not json');

  await assert.rejects(() => readPricing(path), /not valid JSON/);
});

test('tiny prices are written as plain decimals, not exponents', async () => {
  const path = join(await scratch(), 'ccusage.json');

  await writePricing(
    [{ model: 'm', input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 }],
    path,
  );

  const raw = await readFile(path, 'utf8');
  assert.equal(raw.includes('e-'), false, `exponent notation survived: ${raw}`);
  assert.equal(raw.includes('0.0000003'), true);
  assert.equal(raw.includes('0.00000375'), true);
});
