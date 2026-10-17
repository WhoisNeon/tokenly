import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildArgs } from './ccusage.ts';
import { SOURCES, VIEWS, isSource } from './types.ts';
import { formatCost, formatTokens } from './format.ts';

test('isSource only accepts known ccusage subcommands', () => {
  assert.equal(isSource('all'), true);
  assert.equal(isSource('opencode'), true);
  assert.equal(isSource('rm -rf /'), false);
  assert.equal(isSource('opencode; whoami'), false);
  assert.equal(isSource(''), false);
});

test('buildArgs emits the focused command for a source', () => {
  assert.deepEqual(buildArgs('daily', 'opencode'), ['opencode', 'daily', '--json']);
  assert.deepEqual(buildArgs('monthly', 'claude'), ['claude', 'monthly', '--json']);
});

test('buildArgs emits the unified command for "all"', () => {
  assert.deepEqual(buildArgs('daily', 'all'), ['daily', '--json']);
  assert.deepEqual(buildArgs('monthly', 'all'), ['monthly', '--json']);
});

test('allowlists contain no shell metacharacters', () => {
  const safe = /^[a-z]+$/;
  for (const value of [...SOURCES, ...VIEWS]) assert.match(value, safe);
});

test('token and cost formatting stays compact', () => {
  assert.equal(formatTokens(0), '0');
  assert.equal(formatTokens(999), '999');
  assert.equal(formatTokens(80036), '80.0K');
  assert.equal(formatTokens(189562393), '190M');
  assert.equal(formatTokens(644288401), '644M');
  assert.equal(formatCost(0), '$0.00');
  assert.equal(formatCost(0.0042), '$0.0042');
  assert.equal(formatCost(1234.5), '$1,234.50');
});