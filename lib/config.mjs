import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BASE_PRICING_KEYS,
  DEFAULT_CONFIG_PATH_SEGMENTS,
  MAX_MODEL_NAME_LENGTH,
  MAX_PRICE_PER_MILLION,
  MAX_PRICING_OVERRIDES,
  PRICING_FIELDS,
} from './constants.mjs';
import {
  AppError,
  asFiniteNumber,
  displayPath,
  homeDirectory,
  isPlainObject,
  safeJsonStringify,
} from './util.mjs';

const DEFAULT_SCHEMA = 'https://ccusage.com/config-schema.json';
const isSandboxDenial = (error) =>
  error?.message === 'Access denied' || error?.cause?.message === 'Access denied';

function isPermissionError(error) {
  return (
    Boolean(error) &&
    (error.code === 'EACCES' ||
      error.code === 'EPERM' ||
      error.code === 'EROFS' ||
      isSandboxDenial(error))
  );
}

function configPathHint(configPath) {
  const file = displayPath(configPath);
  const folder = displayPath(path.dirname(configPath));
  const fileName = path.basename(configPath);
  if (process.platform === 'win32') {
    return `Run \`icacls "${folder}" /grant "$env:USERNAME:(OI)(CI)F" /T\` in PowerShell, or edit this file by hand:\n${file}`;
  }
  return `Fix the folder permissions (chmod u+rw "${folder}") or edit this file by hand:\n${file}`;
}

/**
 * Some managed Windows machines (and cloud-synced folders) deny file creation
 * inside the config folder while still allowing reads. The app should say that
 * plainly instead of failing later with a cryptic copy error.
 */
async function probeConfigFolder(configPath) {
  const probePath = `${configPath}.tokenly-write-test`;
  try {
    await fs.writeFile(probePath, '{}', { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (isPermissionError(error)) return false;
    return true;
  }
  await fs.rm(probePath, { force: true }).catch(() => {});
  return true;
}

export function resolveConfigPath({ home = homeDirectory() } = {}) {
  const explicit = process.env.TOKENLY_CONFIG_PATH?.trim();
  if (explicit) return path.resolve(explicit);

  const userConfig = path.join(home, ...DEFAULT_CONFIG_PATH_SEGMENTS);
  const legacyConfig = path.join(home, '.claude', 'ccusage.json');
  return { userConfig, legacyConfig };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the config ccusage should use. We deliberately target the user's
 * home config only; the dashboard never edits a project-local config.
 */
export async function resolveUserConfigPath({ home = homeDirectory() } = {}) {
  const resolved = resolveConfigPath({ home });
  if (typeof resolved === 'string') {
    return resolved;
  }
  if (await pathExists(resolved.userConfig)) return resolved.userConfig;
  if (await pathExists(resolved.legacyConfig)) return resolved.legacyConfig;
  return resolved.userConfig;
}

function parseConfigText(text, configPath) {
  const withoutBom = text.replace(/^\uFEFF/, '');
  if (!withoutBom.trim()) {
    throw new AppError('CONFIG_INVALID', 'Your ccusage config file is empty.', {
      status: 422,
      detail: `${configPath} exists but contains no JSON. Add a valid object or remove the file, then try again.`,
      hint: 'Tokenly will not overwrite a config file it cannot parse.',
      extra: { path: configPath, displayPath: displayPath(configPath) },
    });
  }

  try {
    return JSON.parse(withoutBom);
  } catch (error) {
    const position = /position (\d+)/.exec(error.message)?.[1];
    const detail =
      position !== undefined
        ? `${configPath} could not be parsed at character ${position}: ${error.message}`
        : `${configPath} could not be parsed: ${error.message}`;
    throw new AppError('CONFIG_INVALID', 'Your ccusage config is not valid JSON.', {
      status: 422,
      detail,
      hint: 'Fix the JSON by hand, then reload. Tokenly will not overwrite a file it cannot parse.',
      cause: error,
      extra: { path: configPath, displayPath: displayPath(configPath) },
    });
  }
}

function assertConfigObject(config, configPath) {
  if (!isPlainObject(config)) {
    throw new AppError('CONFIG_INVALID', 'Your ccusage config must contain a JSON object.', {
      status: 422,
      detail: `${configPath} parsed successfully, but its top-level value is not an object.`,
      hint: 'Tokenly will not overwrite a config file it cannot understand.',
      extra: { path: configPath, displayPath: displayPath(configPath) },
    });
  }
}

function assertPricingOverrides(config, configPath) {
  if (config.defaults === undefined) return {};
  if (!isPlainObject(config.defaults)) {
    throw new AppError('CONFIG_INVALID', 'The “defaults” section of your ccusage config is invalid.', {
      status: 422,
      detail: `${configPath} has a non-object “defaults” value.`,
      extra: { path: configPath, displayPath: displayPath(configPath) },
    });
  }

  const overrides = config.defaults.pricingOverrides;
  if (overrides === undefined) return {};
  if (!isPlainObject(overrides)) {
    throw new AppError(
      'CONFIG_INVALID',
      'The pricing overrides in your ccusage config are invalid.',
      {
        status: 422,
        detail: `${configPath} has a “defaults.pricingOverrides” value that is not an object.`,
        hint: 'It should look like { "model-name": { "inputCostPerToken": 0.000003 } }.',
        extra: { path: configPath, displayPath: displayPath(configPath) },
      },
    );
  }

  for (const [model, value] of Object.entries(overrides)) {
    if (!isPlainObject(value)) {
      throw new AppError('CONFIG_INVALID', `The pricing override for “${model}” is invalid.`, {
        status: 422,
        detail: `“defaults.pricingOverrides.${model}” must be an object containing numeric rates.`,
        extra: { path: configPath, displayPath: displayPath(configPath) },
      });
    }
    for (const field of PRICING_FIELDS) {
      if (value[field.key] === undefined) continue;
      if (
        typeof value[field.key] !== 'number' ||
        !Number.isFinite(value[field.key]) ||
        value[field.key] < 0
      ) {
        throw new AppError(
          'CONFIG_INVALID',
          `The ${field.label.toLowerCase()} rate for “${model}” is invalid.`,
          {
            status: 422,
            detail: `“defaults.pricingOverrides.${model}.${field.key}” must be a non-negative number. Per-token rates are used in the file; the Settings page shows them per million tokens.`,
            extra: { path: configPath, displayPath: displayPath(configPath) },
          },
        );
      }
    }
  }

  return overrides;
}

export async function readConfig({ configPath } = {}) {
  const resolvedPath = configPath ?? (await resolveUserConfigPath());
  let stat = null;

  try {
    stat = await fs.stat(resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        path: resolvedPath,
        displayPath: displayPath(resolvedPath),
        exists: false,
        config: null,
        overrides: {},
        modifiedAt: null,
        backupPath: `${resolvedPath}.tokenly-backup`,
        backupDisplayPath: displayPath(`${resolvedPath}.tokenly-backup`),
      };
    }
    const permission = isPermissionError(error);
    throw new AppError(
      permission ? 'CONFIG_FOLDER_READONLY' : 'CONFIG_READ_FAILED',
      permission
        ? 'Tokenly is not allowed to read your ccusage config.'
        : 'Tokenly could not inspect your ccusage config.',
      {
        status: 500,
        detail: permission
          ? `Windows blocked reading ${resolvedPath} with ${error.code} (operation not permitted).`
          : `${resolvedPath}: ${error.message}`,
        hint: permission ? configPathHint(resolvedPath) : null,
        cause: error,
        extra: { path: resolvedPath, displayPath: displayPath(resolvedPath) },
      },
    );
  }

  if (!stat.isFile()) {
    throw new AppError('CONFIG_READ_FAILED', 'The ccusage config path is not a file.', {
      status: 422,
      detail: `${resolvedPath} exists, but it is a directory.`,
      extra: { path: resolvedPath, displayPath: displayPath(resolvedPath) },
    });
  }

  let text;
  try {
    text = await fs.readFile(resolvedPath, 'utf8');
  } catch (error) {
    const permission = isPermissionError(error);
    throw new AppError(
      permission ? 'CONFIG_FOLDER_READONLY' : 'CONFIG_READ_FAILED',
      permission
        ? 'Tokenly is not allowed to read your ccusage config.'
        : 'Tokenly could not read your ccusage config.',
      {
        status: 500,
        detail: permission
          ? `Windows blocked reading ${resolvedPath} with ${error.code} (operation not permitted).`
          : `${resolvedPath}: ${error.message}`,
        hint: permission ? configPathHint(resolvedPath) : null,
        cause: error,
        extra: { path: resolvedPath, displayPath: displayPath(resolvedPath) },
      },
    );
  }

  const config = parseConfigText(text, resolvedPath);
  assertConfigObject(config, resolvedPath);
  const overrides = assertPricingOverrides(config, resolvedPath);

  return {
    path: resolvedPath,
    displayPath: displayPath(resolvedPath),
    exists: true,
    config,
    overrides,
    modifiedAt: stat.mtime.toISOString(),
    backupPath: `${resolvedPath}.tokenly-backup`,
    backupDisplayPath: displayPath(`${resolvedPath}.tokenly-backup`),
  };
}

export function overridesToRows(overrides) {
  return Object.entries(overrides).map(([model, rates]) => {
    const row = { model, hasAdvancedFields: false };
    for (const field of PRICING_FIELDS) {
      const perToken = rates[field.key];
      row[field.apiKey] =
        typeof perToken === 'number' && Number.isFinite(perToken)
          ? Number((perToken * 1_000_000).toPrecision(12))
          : null;
    }
    row.hasAdvancedFields = Object.keys(rates).some((key) => !BASE_PRICING_KEYS.has(key));
    return row;
  });
}

export async function getConfigSummary({ configPath } = {}) {
  const loaded = await readConfig({ configPath });
  return {
    path: loaded.path,
    displayPath: loaded.displayPath,
    folderDisplayPath: displayPath(path.dirname(loaded.path)),
    exists: loaded.exists,
    writable: await probeConfigFolder(loaded.path),
    modifiedAt: loaded.modifiedAt,
    backupPath: loaded.backupPath,
    backupDisplayPath: loaded.backupDisplayPath,
    overrideRows: overridesToRows(loaded.overrides),
    overrideCount: Object.keys(loaded.overrides).length,
    schema: loaded.config?.$schema ?? DEFAULT_SCHEMA,
  };
}

function validateModelName(value, index) {
  if (typeof value !== 'string') {
    throw new AppError('INVALID_PRICING', `Model ${index + 1} needs a name.`, {
      status: 400,
      hint: 'Use the exact model label reported by ccusage.',
    });
  }
  const model = value.trim();
  if (!model) {
    throw new AppError('INVALID_PRICING', `Model ${index + 1} needs a name.`, {
      status: 400,
    });
  }
  if (model.length > MAX_MODEL_NAME_LENGTH) {
    throw new AppError(
      'INVALID_PRICING',
      `The model name in row ${index + 1} is too long (max ${MAX_MODEL_NAME_LENGTH} characters).`,
      { status: 400 },
    );
  }
  if (/[\u0000-\u001F\u007F]/.test(model)) {
    throw new AppError('INVALID_PRICING', `The model name in row ${index + 1} contains a control character.`, {
      status: 400,
    });
  }
  return model;
}

function validatePrice(value, field, model) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError('INVALID_PRICING', `The ${field.label.toLowerCase()} rate for “${model}” is not a number.`, {
      status: 400,
    });
  }
  if (value < 0) {
    throw new AppError('INVALID_PRICING', `The ${field.label.toLowerCase()} rate for “${model}” cannot be negative.`, {
      status: 400,
    });
  }
  if (value > MAX_PRICE_PER_MILLION) {
    throw new AppError(
      'INVALID_PRICING',
      `The ${field.label.toLowerCase()} rate for “${model}” is above ${MAX_PRICE_PER_MILLION.toLocaleString('en-US')} USD per million tokens.`,
      { status: 400 },
    );
  }
  return Number((value / 1_000_000).toPrecision(15));
}

export function validatePricingRows(rows) {
  if (!Array.isArray(rows)) {
    throw new AppError('INVALID_PRICING', 'Pricing changes must be sent as an array.', {
      status: 400,
    });
  }
  if (rows.length > MAX_PRICING_OVERRIDES) {
    throw new AppError(
      'INVALID_PRICING',
      `Too many pricing overrides (max ${MAX_PRICING_OVERRIDES}).`,
      { status: 400 },
    );
  }

  const seen = new Set();
  return rows.map((rawRow, index) => {
    if (!isPlainObject(rawRow)) {
      throw new AppError('INVALID_PRICING', `Pricing row ${index + 1} is invalid.`, {
        status: 400,
      });
    }
    const model = validateModelName(rawRow.model, index);
    if (seen.has(model)) {
      throw new AppError('INVALID_PRICING', `Model “${model}” appears more than once.`, {
        status: 400,
      });
    }
    seen.add(model);

    const prices = {};
    for (const field of PRICING_FIELDS) {
      prices[field.key] = validatePrice(rawRow[field.apiKey], field, model);
    }
    return { model, prices };
  });
}

function buildNextConfig(existingConfig, rows) {
  const config = existingConfig ? structuredClone(existingConfig) : {};
  if (!isPlainObject(config)) {
    throw new AppError('CONFIG_INVALID', 'Your ccusage config must contain a JSON object.', {
      status: 422,
    });
  }

  if (config.$schema === undefined) config.$schema = DEFAULT_SCHEMA;
  if (config.defaults === undefined) config.defaults = {};
  if (!isPlainObject(config.defaults)) {
    throw new AppError('CONFIG_INVALID', 'The “defaults” section of your ccusage config is invalid.', {
      status: 422,
    });
  }

  const existingOverrides = isPlainObject(config.defaults.pricingOverrides)
    ? config.defaults.pricingOverrides
    : {};
  const nextOverrides = {};

  for (const row of rows) {
    const previous = isPlainObject(existingOverrides[row.model])
      ? existingOverrides[row.model]
      : {};
    const next = structuredClone(previous);

    for (const field of PRICING_FIELDS) {
      const perToken = row.prices[field.key];
      if (perToken === null) {
        delete next[field.key];
      } else {
        next[field.key] = perToken;
      }
    }

    if (Object.keys(next).length > 0) {
      nextOverrides[row.model] = next;
    }
  }

  config.defaults.pricingOverrides = nextOverrides;
  return config;
}

async function writeAtomic(filePath, contents) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.tokenly-${process.pid}-${Date.now()}.tmp`,
  );

  try {
    await fs.writeFile(tempPath, contents, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function savePricingRows(rows, { configPath } = {}) {
  const validated = validatePricingRows(rows);
  const resolvedPath = configPath ?? (await resolveUserConfigPath());
  const loaded = await readConfig({ configPath: resolvedPath });
  const nextConfig = buildNextConfig(loaded.config, validated);
  const backupPath = `${resolvedPath}.tokenly-backup`;

  if (loaded.exists && !(await probeConfigFolder(resolvedPath))) {
    throw new AppError(
      'CONFIG_FOLDER_READONLY',
      'Your ccusage config folder is read-only for Tokenly.',
      {
        status: 500,
        detail: `The file at ${resolvedPath} can be read, but Windows blocks creating or replacing files in ${path.dirname(resolvedPath)} with code EPERM (operation not permitted). Tokenly needs to write a copy of the file there before it can save.`,
        hint: configPathHint(resolvedPath),
        extra: { path: resolvedPath, displayPath: displayPath(resolvedPath) },
      },
    );
  }

  let backupCreated = false;
  let backupUnavailable = false;

  if (loaded.exists) {
    try {
      await fs.copyFile(resolvedPath, backupPath);
      backupCreated = true;
    } catch (error) {
      // Prefer a real backup, but never make it the reason a save is lost.
      try {
        await writeAtomic(backupPath, safeJsonStringify(loaded.config));
        backupCreated = true;
      } catch (fallbackError) {
        const permission = isPermissionError(fallbackError) || isPermissionError(error);
        if (permission) {
          throw new AppError(
            'CONFIG_WRITE_FAILED',
            'Tokenly does not have permission to write your ccusage config.',
            {
              status: 500,
              detail: `Tokenly could not back up ${resolvedPath} before saving: ${fallbackError.message}`,
              hint: 'No changes were written. Check the folder permissions and try again.',
              cause: fallbackError,
              extra: { path: resolvedPath, backupPath },
            },
          );
        }
        backupUnavailable = true;
      }
    }
  }

  try {
    await writeAtomic(resolvedPath, safeJsonStringify(nextConfig));
  } catch (error) {
    const permission = isPermissionError(error);
    throw new AppError(
      'CONFIG_WRITE_FAILED',
      permission
        ? 'Tokenly does not have permission to write your ccusage config.'
        : 'Tokenly could not save your ccusage config.',
      {
        status: 500,
        detail: `${resolvedPath}: ${error.message}`,
        hint: permission
          ? 'No changes were written. Check the folder permissions and try again.'
          : 'No changes were written. The previous file was left in place.',
        cause: error,
        extra: { path: resolvedPath, backupPath, backupCreated },
      },
    );
  }

  let verified;
  try {
    verified = await readConfig({ configPath: resolvedPath });
  } catch (error) {
    throw new AppError(
      'CONFIG_VERIFY_FAILED',
      'The config was written, but Tokenly could not verify it.',
      {
        status: 500,
        detail: error instanceof Error ? error.message : String(error),
        hint: `Check ${resolvedPath}; a backup is available at ${backupPath}.`,
        cause: error,
        extra: { path: resolvedPath, backupPath, backupCreated },
      },
    );
  }

  return {
    config: {
      path: verified.path,
      displayPath: verified.displayPath,
      exists: verified.exists,
      modifiedAt: verified.modifiedAt,
      backupPath: verified.backupPath,
      backupDisplayPath: verified.backupDisplayPath,
      overrideRows: overridesToRows(verified.overrides),
      overrideCount: Object.keys(verified.overrides).length,
      schema: verified.config?.$schema ?? DEFAULT_SCHEMA,
    },
    backupPath,
    backupDisplayPath: displayPath(backupPath),
    backupCreated,
    backupUnavailable,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Used before invoking ccusage: validates the config we are about to pass as
 * --config, so a broken JSON file surfaces as a Tokenly error instead of a
 * cryptic CLI failure.
 */
export async function getRunnableConfig() {
  const loaded = await readConfig();
  return {
    path: loaded.path,
    exists: loaded.exists,
    overrides: loaded.overrides,
    modifiedAt: loaded.modifiedAt,
  };
}

export function convertPricePerMillionToPerToken(value) {
  const number = asFiniteNumber(value, NaN);
  if (!Number.isFinite(number)) return null;
  return Number((number / 1_000_000).toPrecision(15));
}
