import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { COMMAND_TIMEOUT_MS, MAX_COMMAND_OUTPUT_BYTES } from './constants.mjs';
import { AppError, truncateText } from './util.mjs';

const IS_WINDOWS = process.platform === 'win32';
const WINDOWS_CANDIDATES = ['ccusage.exe', 'ccusage.cmd', 'ccusage.bat', 'ccusage'];

let resolutionCache = null;
let resolutionPromise = null;
let versionCache = null;
let versionPromise = null;

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findAdjacentNodeEntry(shimPath) {
  const directory = path.dirname(shimPath);
  const packageRoot = path.join(directory, 'node_modules', 'ccusage');
  const directCandidates = [
    path.join(packageRoot, 'src', 'cli.js'),
    path.join(packageRoot, 'dist', 'cli.js'),
  ];
  for (const candidate of directCandidates) {
    if (await exists(candidate)) return candidate;
  }

  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (await exists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const bin = packageJson.bin;
      const relative =
        typeof bin === 'string'
          ? bin
          : bin && typeof bin === 'object'
            ? bin.ccusage
            : null;
      if (relative) {
        const candidate = path.resolve(packageRoot, relative);
        if (await exists(candidate)) return candidate;
      }
    } catch {
      // Fall through to shim inspection.
    }
  }

  try {
    const shim = await fs.readFile(shimPath, 'utf8');
    const match = /node_modules[\\/]ccusage[\\/](?:src[\\/])?cli\.js/i.exec(
      shim.replaceAll('\\\\', '\\'),
    );
    if (match) {
      const candidate = path.join(directory, 'node_modules', 'ccusage', ...match[0].split(/[\\/]/).slice(1));
      if (await exists(candidate)) return candidate;
    }
  } catch {
    // Not a text shim.
  }

  return null;
}

async function strategyForPath(filePath) {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const extension = path.extname(filePath).toLowerCase();
  if (['.js', '.mjs', '.cjs'].includes(extension)) {
    return {
      kind: 'node',
      command: process.execPath,
      entry: filePath,
      resolvedPath: filePath,
    };
  }

  if (IS_WINDOWS) {
    if (extension === '.cmd' || extension === '.bat') {
      const nodeEntry = await findAdjacentNodeEntry(filePath);
      if (nodeEntry) {
        return {
          kind: 'node',
          command: process.execPath,
          entry: nodeEntry,
          resolvedPath: filePath,
        };
      }
      return {
        kind: 'cmd',
        command: filePath,
        resolvedPath: filePath,
      };
    }
    if (extension === '.exe') {
      return {
        kind: 'direct',
        command: filePath,
        resolvedPath: filePath,
      };
    }
    if (extension === '.ps1') return null;
    return null;
  }

  return {
    kind: 'direct',
    command: filePath,
    resolvedPath: filePath,
  };
}

async function findOnPath(executableName) {
  const pathDirectories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const names = IS_WINDOWS
    ? WINDOWS_CANDIDATES.map((name) =>
        executableName === 'ccusage'
          ? name
          : `${executableName}${name.slice('ccusage'.length)}`,
      )
    : [executableName];

  for (const directory of pathDirectories) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (await exists(candidate)) {
        const strategy = await strategyForPath(candidate);
        if (strategy) return strategy;
      }
    }
  }
  return null;
}

function missingCcusageError() {
  return new AppError('CCUSAGE_NOT_FOUND', 'ccusage wasn’t found on this machine.', {
    status: 503,
    detail:
      'Tokenly reads usage by running the ccusage CLI locally. No ccusage command was found on your PATH.',
    hint: 'Install it with “npm install -g ccusage”, then choose Try again.',
    extra: {
      installCommand: 'npm install -g ccusage',
      docsUrl: 'https://ccusage.com/guide/installation',
    },
  });
}

export async function resolveCcusage({ force = false } = {}) {
  if (!force && resolutionCache) return resolutionCache;
  if (!force && resolutionPromise) return resolutionPromise;

  resolutionPromise = (async () => {
    const configured = process.env.CCUSAGE_BIN?.trim();
    if (configured) {
      let filePath = configured;
      if (!path.isAbsolute(filePath) && !/[\\/]/.test(filePath)) {
        const found = await findOnPath(filePath);
        if (found) {
          resolutionCache = found;
          return found;
        }
      } else {
        filePath = path.resolve(filePath);
      }
      const strategy = await strategyForPath(filePath);
      if (!strategy) {
        throw new AppError('CCUSAGE_BIN_INVALID', 'The configured ccusage path is not usable.', {
          status: 503,
          detail: `CCUSAGE_BIN is set to “${configured}”, but that file does not exist or is not an executable ccusage entry point.`,
          hint: 'Unset CCUSAGE_BIN or point it at ccusage’s CLI file.',
          extra: { ccusageBin: configured },
        });
      }
      resolutionCache = strategy;
      return strategy;
    }

    const found = await findOnPath('ccusage');
    if (found) {
      resolutionCache = found;
      return found;
    }

    if (IS_WINDOWS) {
      const extraDirectories = [
        process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : null,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'npm') : null,
      ].filter(Boolean);
      for (const directory of extraDirectories) {
        for (const name of WINDOWS_CANDIDATES) {
          const candidate = path.join(directory, name);
          if (await exists(candidate)) {
            const strategy = await strategyForPath(candidate);
            if (strategy) {
              resolutionCache = strategy;
              return strategy;
            }
          }
        }
      }
    }

    throw missingCcusageError();
  })();

  try {
    return await resolutionPromise;
  } finally {
    resolutionPromise = null;
  }
}

function quoteForCmd(value) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function spawnForStrategy(strategy, args, options) {
  if (strategy.kind === 'node') {
    return spawn(strategy.command, [strategy.entry, ...args], options);
  }
  if (strategy.kind === 'direct') {
    return spawn(strategy.command, args, options);
  }

  // Rare fallback: an npm .cmd shim without a discoverable JS entry.
  // Every argument is generated by the server and quoted; no request text is
  // ever passed as part of this command line.
  const commandLine = [strategy.command, ...args].map(quoteForCmd).join(' ');
  return spawn(commandLine, {
    ...options,
    shell: true,
  });
}

async function readCapped(filePath, maxBytes) {
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    if (length > 0) await handle.read(buffer, 0, length, 0);
    return {
      text: buffer.toString('utf8'),
      bytes: stat.size,
      truncated: stat.size > maxBytes,
    };
  } finally {
    await handle.close();
  }
}

export async function runCcusage(args, { displayCommand, timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
  const strategy = await resolveCcusage();
  const commandText = displayCommand || ['ccusage', ...args].join(' ');
  let tempDirectory;

  try {
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tokenly-ccusage-'));
  } catch (error) {
    throw new AppError('CCUSAGE_CAPTURE_FAILED', 'Tokenly could not prepare a workspace for ccusage.', {
      status: 500,
      detail: error.message,
      hint: 'Check that your system temp folder is writable.',
      cause: error,
    });
  }

  const stdoutPath = path.join(tempDirectory, 'stdout.txt');
  const stderrPath = path.join(tempDirectory, 'stderr.txt');

  try {
    let stdoutHandle;
    let stderrHandle;
    try {
      stdoutHandle = await fs.open(stdoutPath, 'w');
      stderrHandle = await fs.open(stderrPath, 'w');
    } catch (error) {
      await stdoutHandle?.close().catch(() => {});
      await stderrHandle?.close().catch(() => {});
      throw new AppError('CCUSAGE_CAPTURE_FAILED', 'Tokenly could not prepare a workspace for ccusage.', {
        status: 500,
        detail: error.message,
        cause: error,
      });
    }

    return await new Promise((resolve, reject) => {
      let child;
      try {
        child = spawnForStrategy(strategy, args, {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NO_COLOR: '1',
            FORCE_COLOR: '0',
          },
          windowsHide: true,
          stdio: ['ignore', stdoutHandle.fd, stderrHandle.fd],
        });
      } catch (error) {
        stdoutHandle.close().catch(() => {});
        stderrHandle.close().catch(() => {});
        reject(
          new AppError('CCUSAGE_SPAWN_FAILED', 'Tokenly could not start ccusage.', {
            status: 500,
            detail: error.message,
            extra: { command: commandText },
            cause: error,
          }),
        );
        return;
      }

      stdoutHandle.close().catch(() => {});
      stderrHandle.close().catch(() => {});

      let settled = false;
      let killedForTimeout = false;
      let killedForSize = false;

      const timeout = setTimeout(() => {
        killedForTimeout = true;
        child.kill();
      }, timeoutMs);

      const sizeMonitor = setInterval(async () => {
        try {
          const stats = await Promise.all([fs.stat(stdoutPath), fs.stat(stderrPath)]);
          if (
            stats[0].size > MAX_COMMAND_OUTPUT_BYTES ||
            stats[1].size > MAX_COMMAND_OUTPUT_BYTES * 2
          ) {
            killedForSize = true;
            child.kill();
          }
        } catch {
          // The files may be between writes or already gone; ignore.
        }
      }, 750);
      sizeMonitor.unref?.();

      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(sizeMonitor);
        if (error) reject(error);
        else resolve(result);
      }

      child.on('error', (error) => {
        if (error.code === 'ENOENT') {
          finish(missingCcusageError());
          return;
        }
        finish(
          new AppError('CCUSAGE_SPAWN_FAILED', 'Tokenly could not start ccusage.', {
            status: 500,
            detail: `${error.message} (${strategy.resolvedPath || strategy.command})`,
            hint: 'Check that ccusage is installed and can run in this terminal.',
            extra: { command: commandText },
            cause: error,
          }),
        );
      });

      child.on('close', async (code, signal) => {
        let out;
        let err;
        try {
          const [stdoutResult, stderrResult] = await Promise.all([
            readCapped(stdoutPath, MAX_COMMAND_OUTPUT_BYTES),
            readCapped(stderrPath, 2 * 1024 * 1024),
          ]);
          out = stdoutResult;
          err = stderrResult;
        } catch (error) {
          finish(
            new AppError('CCUSAGE_CAPTURE_FAILED', 'Tokenly could not read ccusage’s output.', {
              status: 500,
              detail: error.message,
              cause: error,
              extra: { command: commandText },
            }),
          );
          return;
        }

        if (killedForTimeout) {
          finish(
            new AppError('CCUSAGE_TIMEOUT', 'ccusage took too long to finish.', {
              status: 504,
              detail: `The report was stopped after ${Math.round(timeoutMs / 1000)} seconds.`,
              hint: 'Try a shorter date range, or run the command below in a terminal to investigate.',
              extra: {
                command: commandText,
                stderr: truncateText(err.text),
                stdout: truncateText(out.text),
              },
            }),
          );
          return;
        }

        if (killedForSize || out.bytes > MAX_COMMAND_OUTPUT_BYTES) {
          finish(
            new AppError('CCUSAGE_OUTPUT_TOO_LARGE', 'ccusage returned more data than Tokenly can display.', {
              status: 500,
              detail: `The output exceeded ${Math.round(MAX_COMMAND_OUTPUT_BYTES / 1024 / 1024)} MB.`,
              hint: 'Try a shorter date range.',
              extra: { command: commandText },
            }),
          );
          return;
        }

        if (code !== 0) {
          const message =
            err.text.trim() || out.text.trim() || `ccusage exited with code ${code}.`;
          finish(
            new AppError('CCUSAGE_FAILED', 'ccusage couldn’t generate this report.', {
              status: 500,
              detail: truncateText(message),
              hint: 'Run the command below in a terminal to see the full error.',
              extra: {
                command: commandText,
                exitCode: code,
                signal: signal ?? null,
                stderr: truncateText(err.text),
                stdout: truncateText(out.text),
              },
            }),
          );
          return;
        }

        finish(null, {
          stdout: out.text,
          stderr: err.text,
          stdoutTruncated: out.truncated,
          stderrTruncated: err.truncated,
          code,
          strategy,
        });
      });
    });
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getCcusageVersion({ force = false } = {}) {
  if (!force && versionCache) return versionCache;
  if (!force && versionPromise) return versionPromise;

  versionPromise = (async () => {
    const result = await runCcusage(['--version'], {
      displayCommand: 'ccusage --version',
      timeoutMs: 20_000,
    });
    const text = `${result.stdout}\n${result.stderr}`.trim();
    const match = /ccusage\s+v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/i.exec(text);
    const version = match?.[1] ?? text.split(/\r?\n/).find(Boolean) ?? 'unknown';
    versionCache = {
      version,
      raw: text,
      resolvedPath: result.strategy.resolvedPath,
      strategy: result.strategy.kind,
    };
    return versionCache;
  })();

  try {
    return await versionPromise;
  } finally {
    versionPromise = null;
  }
}

export function resetCcusageCachesForTests() {
  resolutionCache = null;
  resolutionPromise = null;
  versionCache = null;
  versionPromise = null;
}
