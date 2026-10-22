import path from 'node:path';
import os from 'node:os';

export class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? 500;
    this.detail = options.detail ?? null;
    this.hint = options.hint ?? null;
    this.extra = options.extra ?? null;
  }
}

export function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function asFiniteNumber(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function asNonNegativeNumber(value, fallback = 0) {
  const number = asFiniteNumber(value, fallback);
  return number >= 0 ? number : fallback;
}

export function homeDirectory() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

export function displayPath(filePath) {
  const home = homeDirectory();
  if (!filePath || !home) return filePath;
  const relative = path.relative(home, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return filePath;
  return `~${path.sep}${relative}`;
}

export function shortPath(filePath, max = 68) {
  const friendly = displayPath(filePath);
  if (!friendly || friendly.length <= max) return friendly;
  const head = Math.max(12, Math.floor((max - 1) * 0.45));
  const tail = Math.max(12, max - head - 1);
  return `${friendly.slice(0, head)}…${friendly.slice(-tail)}`;
}

export function safeJsonStringify(value, space = 2) {
  return `${JSON.stringify(value, null, space)}\n`;
}

export function formatCommandPart(part) {
  if (part === '') return '""';
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(part)) return part;
  return `"${String(part).replaceAll('"', '\\"')}"`;
}

export function buildCommandDisplay(parts) {
  return parts.map(formatCommandPart).join(' ');
}

export function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function truncateText(value, max = 8_000) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… output truncated`;
}
