import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_RANGES,
  MAX_JSON_BODY_BYTES,
  RANGES,
  SUPPORTED_AGENTS,
  getAgentLabel,
} from './lib/constants.mjs';
import {
  getConfigSummary,
  resolveUserConfigPath,
  savePricingRows,
} from './lib/config.mjs';
import { clearReportCache, getDetectedModels, getReport } from './lib/report.mjs';
import { AppError, displayPath } from './lib/util.mjs';

const modulePath = fileURLToPath(import.meta.url);
const appRoot = path.dirname(modulePath);
const publicDir = path.join(appRoot, 'public');
const DEFAULT_PORT = 4777;
const HOST = '127.0.0.1';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
]);

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

function applySecurityHeaders(res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  applySecurityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendError(res, error) {
  const appError =
    error instanceof AppError
      ? error
      : new AppError('INTERNAL_ERROR', 'Something went wrong inside Tokenly.', {
          status: 500,
          detail: error instanceof Error ? error.message : String(error),
        });

  if (appError.status >= 500 && appError.code === 'INTERNAL_ERROR') {
    console.error(`[tokenly] ${appError.code}:`, error);
  }

  sendJson(res, appError.status, {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      detail: appError.detail,
      hint: appError.hint,
      extra: appError.extra,
    },
  });
}

async function readJsonBody(req) {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Send pricing changes as JSON.', {
      status: 415,
    });
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BODY_BYTES) {
      throw new AppError('BODY_TOO_LARGE', 'That request is too large.', {
        status: 413,
      });
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) {
    throw new AppError('INVALID_JSON', 'The request body is empty.', {
      status: 400,
    });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AppError('INVALID_JSON', 'The request body is not valid JSON.', {
      status: 400,
      detail: error.message,
    });
  }
}

function assertMutationAllowed(req) {
  if (req.headers['x-tokenly'] !== 'settings') {
    throw new AppError('FORBIDDEN', 'This change must come from the Tokenly settings page.', {
      status: 403,
    });
  }

  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AppError('FORBIDDEN', 'This request origin is not allowed.', { status: 403 });
  }
  const expectedHost = req.headers.host;
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.host !== expectedHost
  ) {
    throw new AppError('FORBIDDEN', 'Cross-origin config changes are not allowed.', {
      status: 403,
    });
  }
}

async function serveStatic(req, res, pathname) {
  let requested;
  try {
    requested = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  let filePath = path.join(publicDir, requested === '/' ? 'index.html' : requested);
  const relative = path.relative(publicDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    stat = null;
  }

  const isAppRoute =
    requested.startsWith('/settings') || requested.startsWith('/usage');
  const looksLikeAsset = path.extname(requested) !== '';
  const acceptsHtml = String(req.headers.accept || '').includes('text/html');

  if (!stat || !stat.isFile()) {
    if ((isAppRoute || acceptsHtml) && !looksLikeAsset) {
      filePath = path.join(publicDir, 'index.html');
      stat = await fs.stat(filePath);
    } else {
      applySecurityHeaders(res);
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end('Not found');
      return;
    }
  }

  const extension = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES.get(extension) ?? 'application/octet-stream';
  const isFont = extension === '.woff2' || extension === '.woff';
  const isHtml = extension === '.html';

  applySecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': isFont
      ? 'public, max-age=31536000, immutable'
      : isHtml
        ? 'no-cache'
        : 'no-cache',
    'Last-Modified': stat.mtime.toUTCString(),
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Could not read file');
    })
    .pipe(res);
}

function sseHeaders(res) {
  applySecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

function createEventHub() {
  const clients = new Set();

  function connect(req, res) {
    sseHeaders(res);
    res.write('retry: 3000\n\n');
    res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    clients.add(res);

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, 20_000);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  }

  function broadcast(event, data) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  }

  function close() {
    for (const client of clients) {
      try {
        client.end();
      } catch {
        // Already closed.
      }
    }
    clients.clear();
  }

  return { connect, broadcast, close };
}

export function createTokenlyServer() {
  const eventHub = createEventHub();

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    try {
      const address = server.address();
      const actualPort =
        typeof address === 'object' && address ? address.port : DEFAULT_PORT;
      const allowedHosts = new Set([
        `127.0.0.1:${actualPort}`,
        `localhost:${actualPort}`,
        `[::1]:${actualPort}`,
      ]);
      const requestHost = String(req.headers.host || '').toLowerCase();
      if (!allowedHosts.has(requestHost)) {
        throw new AppError(
          'INVALID_HOST',
          'Tokenly only accepts requests addressed to localhost.',
          { status: 421 },
        );
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        res.setHeader('X-Tokenly-Duration', String(Date.now() - started));

        if (url.pathname === '/api/health') {
          if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
          }
          sendJson(res, 200, {
            ok: true,
            app: { name: APP_NAME, version: APP_VERSION },
            now: new Date().toISOString(),
          });
          return;
        }

        if (url.pathname === '/api/bootstrap') {
          if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
          }
          const configPath = await resolveUserConfigPath();
          sendJson(res, 200, {
            ok: true,
            app: { name: APP_NAME, version: APP_VERSION },
            agents: SUPPORTED_AGENTS,
            ranges: RANGES,
            defaultRanges: DEFAULT_RANGES,
            config: {
              path: configPath,
              displayPath: displayPath(configPath),
              backupDisplayPath: displayPath(`${configPath}.tokenly-backup`),
            },
            localOnly: true,
          });
          return;
        }

        if (url.pathname === '/api/report') {
          if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
          }

          const report = url.searchParams.get('report') || 'daily';
          const agent = url.searchParams.get('agent') || 'all';
          const rangeId = url.searchParams.get('range');
          const force = url.searchParams.get('refresh') === '1';
          const data = await getReport({ report, agent, rangeId, force });
          if (data.agent) data.agentLabel = getAgentLabel(data.agent);
          sendJson(res, 200, data);
          return;
        }

        if (url.pathname === '/api/settings') {
          if (req.method === 'GET') {
            const config = await getConfigSummary();
            sendJson(res, 200, { ok: true, config });
            return;
          }

          if (req.method === 'PUT') {
            assertMutationAllowed(req);
            const body = await readJsonBody(req);
            if (!body || typeof body !== 'object' || !Array.isArray(body.models)) {
              throw new AppError('INVALID_PRICING', 'Send the complete pricing table as “models”.', {
                status: 400,
              });
            }
            const result = await savePricingRows(body.models);
            clearReportCache();
            eventHub.broadcast('pricing-updated', {
              at: result.savedAt,
              configPath: result.config.path,
            });
            sendJson(res, 200, {
              ok: true,
              ...result,
            });
            return;
          }

          res.setHeader('Allow', 'GET, PUT');
          throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
        }

        if (url.pathname === '/api/models') {
          if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
          }
          const force = url.searchParams.get('refresh') === '1';
          const data = await getDetectedModels({ force });
          sendJson(res, 200, { ok: true, ...data });
          return;
        }

        if (url.pathname === '/api/events') {
          if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
          }
          eventHub.connect(req, res);
          return;
        }

        throw new AppError('NOT_FOUND', 'API route not found.', { status: 404 });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.', { status: 405 });
      }

      await serveStatic(req, res, url.pathname);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendError(res, error);
    }
  });

  server.on('close', () => eventHub.close());
  return server;
}

export async function startServer({ port = DEFAULT_PORT, open = false } = {}) {
  const server = createTokenlyServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => resolve());
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://${HOST}:${actualPort}`;
  return { server, port: actualPort, url, eventHub: null, close: () => server.close() };
}

function parsePort(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return port;
}

function parseArgs(argv) {
  let port = parsePort(process.env.TOKENLY_PORT);
  let open = process.env.TOKENLY_OPEN === '1';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port' || arg === '-p') {
      port = parsePort(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--port=')) {
      port = parsePort(arg.slice('--port='.length));
    } else if (arg === '--open') {
      open = true;
    }
  }
  return { port, open };
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = process.env.ComSpec || 'cmd.exe';
    args = ['/d', '/s', '/c', 'start', '""', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Opening the browser is a convenience; the printed URL is authoritative.
  }
}

function printBanner(url) {
  const line = '─'.repeat(52);
  console.log(`\n  ${line}`);
  console.log(`  ${APP_NAME} is running`);
  console.log(`  ${url}`);
  console.log(`  ${line}`);
  console.log('  Local only · reads ccusage on this machine');
  console.log('  Press Ctrl+C to stop.\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[tokenly] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const { url } = await startServer(options);
    printBanner(url);
    if (options.open) openBrowser(url);
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[tokenly] Port ${options.port} is already in use. Stop the other process, or run: node server.mjs --port ${options.port + 1}`,
      );
    } else {
      console.error('[tokenly] Could not start:', error);
    }
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(modulePath).href;

if (invokedDirectly) {
  main();
}
