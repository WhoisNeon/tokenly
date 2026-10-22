import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  convertPricePerMillionToPerToken,
  overridesToRows,
  readConfig,
  savePricingRows,
} from '../lib/config.mjs';
import { resetCcusageCachesForTests, resolveCcusage } from '../lib/ccusage.mjs';
import {
  buildReportInvocation,
  clearReportCache,
  getReport,
  resolveRange,
} from '../lib/report.mjs';
import { AGENT_MARKS, agentMark, renderAgentMark } from '../public/agent-marks.js';
import { agentColor } from '../public/formatters.js';
import { SUPPORTED_AGENTS } from '../lib/constants.mjs';

const ORIGINAL_ENV = {
  TOKENLY_CONFIG_PATH: process.env.TOKENLY_CONFIG_PATH,
  CCUSAGE_BIN: process.env.CCUSAGE_BIN,
};

async function makeTempDirectory(prefix = 'tokenly-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(directory) {
  await fs.rm(directory, { recursive: true, force: true });
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetCcusageCachesForTests();
  clearReportCache();
}

const REPORT_FIXTURE = {
  daily: [
    {
      agent: 'all',
      period: '2026-10-18',
      inputTokens: 1_000,
      outputTokens: 200,
      cacheCreationTokens: 100,
      cacheReadTokens: 5_000,
      totalTokens: 6_300,
      totalCost: 0.42,
      modelBreakdowns: [
        {
          modelName: 'alpha-model',
          inputTokens: 1_000,
          outputTokens: 200,
          cacheCreationTokens: 100,
          cacheReadTokens: 5_000,
          cost: 0.42,
        },
      ],
      modelsUsed: ['alpha-model'],
      agents: [
        {
          agent: 'claude',
          inputTokens: 1_000,
          outputTokens: 200,
          cacheCreationTokens: 100,
          cacheReadTokens: 5_000,
          totalTokens: 6_300,
          totalCost: 0.42,
        },
      ],
    },
    {
      agent: 'all',
      period: '2026-10-19',
      inputTokens: 2_000,
      outputTokens: 300,
      cacheCreationTokens: 0,
      cacheReadTokens: 4_000,
      totalTokens: 6_300,
      totalCost: 0.5,
      modelBreakdowns: [
        {
          modelName: 'beta-model',
          inputTokens: 2_000,
          outputTokens: 300,
          cacheCreationTokens: 0,
          cacheReadTokens: 4_000,
          cost: 0,
          missingPricing: true,
        },
      ],
      modelsUsed: ['beta-model'],
      agents: [
        {
          agent: 'opencode',
          inputTokens: 2_000,
          outputTokens: 300,
          cacheCreationTokens: 0,
          cacheReadTokens: 4_000,
          totalTokens: 6_300,
          totalCost: 0.5,
        },
      ],
    },
  ],
  totals: {},
};

function fakeCcusageSource(payload) {
  return `#!/usr/bin/env node
if (process.argv.includes('--version')) {
  console.log('ccusage 9.9.9');
  process.exit(0);
}
console.log(${JSON.stringify(JSON.stringify(payload))});
`;
}

test('range calculations are inclusive and deterministic', () => {
  const now = new Date(2026, 9, 20, 12, 0, 0);
  assert.deepEqual(resolveRange('daily', '7d', now), {
    id: '7d',
    label: '7 days',
    short: '7D',
    days: 7,
    since: '2026-10-14',
    until: '2026-10-20',
  });
  assert.deepEqual(resolveRange('monthly', '12m', now), {
    id: '12m',
    label: '12 months',
    short: '12M',
    months: 12,
    since: '2025-11-01',
    until: '2026-10-20',
  });
  const all = resolveRange('daily', 'all', now);
  assert.equal(all.since, null);
  assert.equal(all.until, null);
  assert.throws(() => resolveRange('weekly', '30d', now), /isn’t supported/);
});

test('report invocation uses focused and unified command shapes', () => {
  const config = {
    path: 'C:\\Users\\example\\.config\\claude\\ccusage.json',
    exists: true,
  };
  const daily = buildReportInvocation({
    report: 'daily',
    agent: 'all',
    range: { since: '2026-09-21', until: '2026-10-20' },
    config,
  });
  assert.ok(daily.command.startsWith('ccusage daily --json --by-agent --offline'));
  assert.ok(daily.command.includes('--config "C:\\Users\\example\\.config\\claude\\ccusage.json"'));
  assert.ok(daily.command.includes('--since 2026-09-21'));
  assert.deepEqual(daily.args.slice(-4), ['--since', '2026-09-21', '--until', '2026-10-20']);

  const focused = buildReportInvocation({
    report: 'monthly',
    agent: 'claude',
    range: { since: '2025-11-01', until: '2026-10-20' },
    config: { exists: false, path: 'ignored' },
  });
  assert.equal(focused.command.includes('--by-agent'), false);
  assert.equal(focused.command.includes('--config'), false);
  assert.ok(focused.command.startsWith('ccusage claude monthly --json --offline'));
});

test('pricing overrides are shown per million and saved per token', async () => {
  const directory = await makeTempDirectory();
  const configPath = path.join(directory, 'ccusage.json');
  try {
    await fs.writeFile(
      configPath,
      JSON.stringify({
        $schema: 'https://ccusage.com/config-schema.json',
        custom: 'keep me',
        defaults: {
          timezone: 'UTC',
          pricingOverrides: {
            'alpha-model': {
              inputCostPerToken: 0.000002,
              advancedTier: 0.5,
            },
            'removed-model': {
              outputCostPerToken: 0.00001,
            },
          },
        },
      }),
      'utf8',
    );

    const result = await savePricingRows(
      [
        {
          model: 'alpha-model',
          inputCostPerMillion: 3,
          outputCostPerMillion: 15,
          cacheReadCostPerMillion: 0.3,
          cacheCreationCostPerMillion: 3.75,
        },
        {
          model: 'gamma-model',
          inputCostPerMillion: 1.25,
          outputCostPerMillion: null,
          cacheReadCostPerMillion: null,
          cacheCreationCostPerMillion: null,
        },
      ],
      { configPath },
    );

    assert.equal(result.backupCreated, true);
    assert.equal(result.config.overrideCount, 2);
    const saved = JSON.parse(await fs.readFile(configPath, 'utf8'));
    assert.equal(saved.custom, 'keep me');
    assert.equal(saved.defaults.timezone, 'UTC');
    assert.equal(saved.defaults.pricingOverrides['alpha-model'].inputCostPerToken, 0.000003);
    assert.equal(saved.defaults.pricingOverrides['alpha-model'].outputCostPerToken, 0.000015);
    assert.equal(saved.defaults.pricingOverrides['alpha-model'].advancedTier, 0.5);
    assert.equal(saved.defaults.pricingOverrides['removed-model'], undefined);
    assert.equal(saved.defaults.pricingOverrides['gamma-model'].inputCostPerToken, 0.00000125);
    assert.equal(
      Object.hasOwn(saved.defaults.pricingOverrides['gamma-model'], 'outputCostPerToken'),
      false,
    );
    const backup = JSON.parse(await fs.readFile(`${configPath}.tokenly-backup`, 'utf8'));
    assert.equal(backup.defaults.pricingOverrides['removed-model'].outputCostPerToken, 0.00001);

    const loaded = await readConfig({ configPath });
    const rows = overridesToRows(loaded.overrides);
    const alpha = rows.find((row) => row.model === 'alpha-model');
    assert.equal(alpha.inputCostPerMillion, 3);
    assert.equal(alpha.outputCostPerMillion, 15);
    assert.equal(alpha.hasAdvancedFields, true);
    assert.equal(convertPricePerMillionToPerToken(2.5), 0.0000025);
  } finally {
    await cleanup(directory);
  }
});

test('invalid pricing input is rejected without touching the file', async () => {
  const directory = await makeTempDirectory();
  const configPath = path.join(directory, 'ccusage.json');
  try {
    const original = JSON.stringify({ defaults: { pricingOverrides: {} } });
    await fs.writeFile(configPath, original, 'utf8');
    await assert.rejects(
      savePricingRows(
        [
          { model: 'same', inputCostPerMillion: 1 },
          { model: 'same', outputCostPerMillion: 2 },
        ],
        { configPath },
      ),
      (error) => error.code === 'INVALID_PRICING',
    );
    await assert.rejects(
      savePricingRows([{ model: 'negative', inputCostPerMillion: -1 }], { configPath }),
      (error) => error.code === 'INVALID_PRICING',
    );
    assert.equal(await fs.readFile(configPath, 'utf8'), original);
  } finally {
    await cleanup(directory);
  }
});

test('a missing config is created on first save', async () => {
  const directory = await makeTempDirectory();
  const configPath = path.join(directory, 'nested', 'ccusage.json');
  try {
    const result = await savePricingRows(
      [{ model: 'first-model', inputCostPerMillion: 2.5 }],
      { configPath },
    );
    assert.equal(result.backupCreated, false);
    assert.equal(result.config.exists, true);
    assert.equal(result.config.overrideCount, 1);
    const saved = JSON.parse(await fs.readFile(configPath, 'utf8'));
    assert.equal(saved.$schema, 'https://ccusage.com/config-schema.json');
    assert.equal(saved.defaults.pricingOverrides['first-model'].inputCostPerToken, 0.0000025);
  } finally {
    await cleanup(directory);
  }
});

test('a malformed config never gets overwritten', async () => {
  const directory = await makeTempDirectory();
  const configPath = path.join(directory, 'ccusage.json');
  try {
    const malformed = '{ "defaults": {';
    await fs.writeFile(configPath, malformed, 'utf8');
    await assert.rejects(
      savePricingRows([{ model: 'alpha', inputCostPerMillion: 1 }], { configPath }),
      (error) => error.code === 'CONFIG_INVALID',
    );
    assert.equal(await fs.readFile(configPath, 'utf8'), malformed);
  } finally {
    await cleanup(directory);
  }
});

test('a fake ccusage report is normalized, and bad JSON fails clearly', async () => {
  const directory = await makeTempDirectory();
  const configPath = path.join(directory, 'ccusage.json');
  const fakePath = path.join(directory, 'fake-ccusage.mjs');
  try {
    await fs.writeFile(
      configPath,
      JSON.stringify({ defaults: { pricingOverrides: {} } }),
      'utf8',
    );
    await fs.writeFile(fakePath, fakeCcusageSource(REPORT_FIXTURE), 'utf8');
    process.env.TOKENLY_CONFIG_PATH = configPath;
    process.env.CCUSAGE_BIN = fakePath;
    resetCcusageCachesForTests();
    clearReportCache();

    const resolved = await resolveCcusage();
    assert.equal(resolved.kind, 'node');
    assert.equal(resolved.resolvedPath, fakePath);

    const report = await getReport({ report: 'daily', agent: 'all', rangeId: '30d' });
    assert.equal(report.ok, true);
    assert.equal(report.meta.version, '9.9.9');
    assert.equal(report.rows.length, 2);
    assert.equal(report.totals.totalTokens, 12_600);
    assert.ok(Math.abs(report.totals.totalCost - 0.92) < 1e-9);
    assert.deepEqual(report.rows[0].period, '2026-10-18');
    assert.equal(report.rows[1].missingPricing, true);
    assert.deepEqual(report.totals.unpricedModels, ['beta-model']);
    assert.deepEqual(report.agents.map((entry) => entry.agent).sort(), ['claude', 'opencode']);
    assert.equal(report.counts.models, 2);
    assert.ok(report.command.includes('--by-agent'));
    assert.ok(report.command.includes('--offline'));
    assert.ok(report.meta.configPath);
    assert.equal(report.cache.hit, false);

    await fs.writeFile(fakePath, "console.log('this is not JSON');\n", 'utf8');
    clearReportCache();
    await assert.rejects(
      getReport({ report: 'daily', agent: 'all', rangeId: '7d', force: true }),
      (error) => error.code === 'CCUSAGE_BAD_DATA',
    );
  } finally {
    restoreEnvironment();
    await cleanup(directory);
  }
});

test('unified report deduplicates agent metadata and sums rows', async () => {
  const directory = await makeTempDirectory();
  const configPath = path.join(directory, 'ccusage.json');
  const fakePath = path.join(directory, 'fake-ccusage.mjs');
  try {
    await fs.writeFile(
      configPath,
      JSON.stringify({ defaults: { pricingOverrides: {} } }),
      'utf8',
    );
    await fs.writeFile(fakePath, fakeCcusageSource(REPORT_FIXTURE), 'utf8');
    process.env.TOKENLY_CONFIG_PATH = configPath;
    process.env.CCUSAGE_BIN = fakePath;
    resetCcusageCachesForTests();
    clearReportCache();

    const report = await getReport({ report: 'daily', agent: 'all', rangeId: '30d' });
    assert.equal(report.agents.length, 2);
    const byAgent = Object.fromEntries(report.agents.map((entry) => [entry.agent, entry]));
    assert.equal(byAgent.claude.totalTokens, 6_300);
    assert.equal(byAgent.opencode.totalTokens, 6_300);
    assert.equal(report.models.length, 2);
    assert.equal(report.counts.agents, 2);

    const focused = await getReport({ report: 'daily', agent: 'claude', rangeId: '30d' });
    assert.equal(focused.agent, 'claude');
    assert.equal(focused.counts.agents, 1);
    assert.ok(focused.command.startsWith('ccusage claude daily'));
    assert.equal(focused.command.includes('--by-agent'), false);
  } finally {
    restoreEnvironment();
    await cleanup(directory);
  }
});

// ── Client presentation ──────────────────────────────────────────────────
// These cover the parts of the UI that are pure data: the inline source marks
// and the design tokens the two themes share. DOM behaviour is checked against
// the running app, not here.

const PUBLIC_DIR = new URL('../public/', import.meta.url);

function readPublic(file) {
  return fs.readFile(new URL(file, PUBLIC_DIR), 'utf8');
}

function readStyles() {
  return readPublic('styles.css');
}

// CSS nests blocks, so find the body of the block that opens after `start`.
function blockAt(css, start) {
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  throw new Error('unbalanced braces while reading styles.css');
}

function relativeLuminance(color) {
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((at) => linear(parseInt(color.slice(at, at + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function customProperties(css) {
  const map = new Map();
  for (const [, name, value] of css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    map.set(name, value.trim());
  }
  return map;
}

test('agent marks stay inline, monochrome, and cover the roster', () => {
  const roster = SUPPORTED_AGENTS.map((agent) => agent.id);
  assert.deepEqual(Object.keys(AGENT_MARKS), roster, 'every source has exactly one mark');

  const lobehub = /^https:\/\/unpkg\.com\/@lobehub\/icons-static-svg@[\d.]+\/icons\/.+\.svg$/;

  for (const { id, label } of SUPPORTED_AGENTS) {
    const mark = agentMark(id);
    assert.equal(mark.label, label, `${id} keeps the roster label`);

    if (mark.image) {
      assert.equal(id, 'codebuff', 'only Codebuff ships a raster mark');
      assert.equal(mark.image, '/agent-codebuff.png');
      assert.match(mark.source, /^https:\/\/www\.codebuff\.com\/favicon\//);
      assert.match(renderAgentMark(id), /--mark-src:url\('\/agent-codebuff\.png'\)/);
      continue;
    }

    // Droid's own mark is not in LobeHub, so it keeps the vendor artwork.
    if (id === 'droid') {
      assert.match(mark.source, /^factory\.com\//, 'Droid keeps its vendor mark');
    } else {
      assert.match(mark.source, lobehub, `${id} comes from the LobeHub set`);
    }

    assert.ok(mark.body.length > 20, `${id} needs path data`);
    assert.equal(mark.body.includes("'"), false, `${id} has to survive a quoted attribute`);
  }

  for (const { id } of SUPPORTED_AGENTS) {
    if (id === 'codebuff') continue;
    const html = renderAgentMark(id);
    assert.match(html, /^<svg class="agent-chip-mark" viewBox="0 0 24 24" fill="currentColor"/);
    // Monochrome: the artwork inherits `currentColor`, so no colour is baked in.
    assert.equal(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(html), false, `${id} must not carry a colour`);
    assert.equal(/https?:|<image|href=|url\(/.test(html), false, `${id} must not link out`);
  }

  assert.match(renderAgentMark('not-an-agent'), /^<svg /, 'unknown agents get a tile');
});

test('agent swatches resolve through the stylesheet, not a fixed hex', () => {
  assert.equal(agentColor('claude'), 'var(--agent-claude, #e9643f)');
  // The fallback keeps an unknown agent on-palette instead of colourless.
  assert.equal(agentColor('mystery'), 'var(--agent-mystery, #7c887f)');
});

test('both dark palettes declare the same tokens', async () => {
  const css = await readStyles();
  const mediaIndex = css.indexOf('@media (prefers-color-scheme: dark)');
  assert.ok(mediaIndex > 0, 'the stylesheet should follow the OS at first paint');

  const mediaBlock = blockAt(css, mediaIndex);
  const systemIndex = mediaBlock.indexOf(":root:not([data-theme='light'])");
  assert.ok(systemIndex >= 0, 'the OS palette should still defer to an explicit light choice');

  const explicitIndex = css.indexOf(":root[data-theme='dark']");
  assert.ok(explicitIndex > mediaIndex, 'the explicit palette belongs after the media query');

  const system = customProperties(blockAt(mediaBlock, systemIndex));
  const explicit = customProperties(blockAt(css, explicitIndex));
  assert.deepEqual([...system.keys()].sort(), [...explicit.keys()].sort());

  for (const name of [
    '--paper',
    '--ink',
    '--cream',
    '--coral',
    '--coral-ink',
    '--danger',
    '--danger-strong',
    '--on-ink',
    '--on-acid',
    '--on-coral',
    '--on-cream',
    // The ink layer inverts, so every panel that is dark in light mode needs a
    // palette that turns it light — and ink that flips back to dark on top.
    '--forest',
    '--forest-deep',
    '--forest-float-rgb',
    '--forest-accent',
    '--forest-accent-rgb',
    '--forest-coral',
    '--forest-warn',
    '--forest-warn-rgb',
    '--forest-code-blue',
    '--forest-code-gold',
    '--on-forest',
    '--on-forest-rgb',
    '--on-forest-2',
    '--on-forest-3',
    '--pill-bg',
    '--pill-ink',
    '--pill-index',
  ]) {
    assert.ok(system.has(name), `the dark palette should define ${name}`);
  }

  // Surfaces that stay light in both palettes must keep their pinned ink.
  assert.equal(system.get('--on-cream'), explicit.get('--on-cream'));
  assert.equal(system.get('--on-acid'), explicit.get('--on-acid'));

  const light = customProperties(blockAt(css, css.indexOf(':root {')));
  const lightInk = light.get('--forest');
  const darkInk = system.get('--forest');
  assert.ok(lightInk && darkInk && lightInk !== darkInk, '--forest has to invert between palettes');
  assert.ok(relativeLuminance(lightInk) < 0.2, 'light mode paints the ink layer dark');
  assert.ok(relativeLuminance(darkInk) > 0.5, 'dark mode paints the ink layer light');

  for (const [palette, tokens] of [
    ['light', light],
    ['dark', system],
  ]) {
    assert.ok(
      contrastRatio(tokens.get('--on-forest'), tokens.get('--forest')) >= 4.5,
      `${palette} text on the ink layer stays readable`,
    );
    assert.ok(
      contrastRatio(tokens.get('--on-forest-2'), tokens.get('--forest')) >= 4.5,
      `${palette} secondary ink text stays readable`,
    );
    assert.ok(
      contrastRatio(tokens.get('--on-forest-3'), tokens.get('--forest')) >= 4.5,
      `${palette} tertiary ink text stays readable`,
    );
    assert.ok(
      contrastRatio(tokens.get('--pill-ink'), tokens.get('--pill-bg')) >= 4.5,
      `${palette} active nav pill stays readable`,
    );
  }
});

test('the theme switch reveals itself from the toggle', async () => {
  const [css, app] = await Promise.all([readStyles(), readPublic('app.js')]);
  assert.match(css, /@keyframes theme-reveal/);
  assert.match(css, /clip-path: circle\(/);
  assert.match(app, /startViewTransition/);
  assert.match(app, /prefersReducedMotion\(\)/);

  // Reduced motion has to be able to turn the reveal off completely.
  const reduceBlocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)/g)]
    .map((match) => blockAt(css, match.index));
  assert.ok(reduceBlocks.some((block) => /view-transition/.test(block)));
});

test('no browser dialogs or inline handlers reach the UI', async () => {
  const [app, html] = await Promise.all([readPublic('app.js'), readPublic('index.html')]);
  assert.equal(/[^.\w](confirm|alert|prompt)\s*\(/.test(app), false);
  assert.match(app, /confirmDialog\(/, 'destructive actions use the app dialog');
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(html), false, 'no inline scripts');
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'no inline event handlers');
});