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

const isWindows = process.platform === 'win32';
const port = process.env.PORT ?? '3000';

console.log(`\n  Tokenly → http://localhost:${port}`);
console.log('  Needs the `ccusage` CLI on your PATH. Press Ctrl+C to stop.\n');

const child = spawn('npx', ['next', 'start', '--port', port], {
  cwd: root,
  shell: isWindows,
  // Stops cmd.exe flashing a console window when launched from Explorer or a
  // script. No-op on macOS/Linux, so it is safe to pass unconditionally.
  //
  // Deliberately NOT detached/unref'd: the server is the foreground process the
  // user is waiting on, and stdio is inherited so its output stays visible.
  windowsHide: true,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));