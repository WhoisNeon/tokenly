#!/usr/bin/env node
// `npx tokenly-dashboard` — starts the published build on http://localhost:3000
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(join(root, '.next'))) {
  console.error('tokenly: no build found. Run `npm run build` first.');
  process.exit(1);
}

const port = process.env.PORT ?? '3000';
console.log(`\n  Tokenly → http://localhost:${port}\n  (needs the \`ccusage\` CLI on your PATH)\n`);

const child = spawn('npx', ['next', 'start', '--port', port], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));