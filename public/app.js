import {
  MODEL_COLORS,
  TOKEN_SERIES,
  agentColor,
  clamp,
  escapeAttribute,
  escapeHtml,
  formatCompactNumber,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
  formatPriceInput,
  moneyParts,
  periodLabel,
  pluralize,
  rangeWindowLabel,
  relativeTime,
} from './formatters.js';
import { chartHeightForWidth, renderChart } from './charts.js';
import { renderAgentMark } from './agent-marks.js';

// Icons are the canonical Lucide set (ISC, lucide.dev), inlined at authoring time
// so the app keeps its zero-network, zero-build contract. Path data is copied
// verbatim; the wrapper only stamps the shared 24×24 box, stroke weight and
// accessibility attributes.
const icon = (body, strokeWidth = 1.75) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  refresh: icon(
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  ),
  settings: icon(
    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
    1.6,
  ),
  arrowUpRight: icon('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  external: icon(
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  ),
  link: icon(
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ),
  chevronDown: icon('<path d="m6 9 6 6 6-6"/>', 1.9),
  chevronsUpDown: icon('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>', 1.9),
  copy: icon(
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  ),
  shield: icon(
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  ),
  alert: icon(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
  info: icon('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  trash: icon(
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  ),
  plus: icon('<path d="M5 12h14"/><path d="M12 5v14"/>', 1.9),
  database: icon(
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  ),
  check: icon('<path d="M20 6 9 17l-5-5"/>', 1.9),
  x: icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 1.9),
  file: icon(
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  ),
  sun: icon(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  ),
  moon: icon(
    '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  ),
  grip: icon(
    '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    1.6,
  ),
};

// ── Theme ────────────────────────────────────────────────────────────────
// The palettes live in CSS. `data-theme` on <html> only records an explicit
// choice; with no attribute the stylesheet follows the OS through
// prefers-color-scheme, so the first paint is already correct.
const THEME_STORAGE_KEY = 'tokenly:theme';
const THEME_COLORS = { light: '#f1ede2', dark: '#101613' };
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function resolvedTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return darkScheme.matches ? 'dark' : 'light';
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function syncThemeChrome() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolvedTheme()]);
  const toggle = document.querySelector('[data-action="toggle-theme"]');
  if (!toggle) return;
  const dark = resolvedTheme() === 'dark';
  const next = dark ? 'light' : 'dark';
  const label = `Switch to ${next} theme`;
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('title', label);
  toggle.setAttribute('aria-pressed', String(dark));
  const glyph = toggle.querySelector('.theme-toggle-glyph');
  if (glyph) glyph.innerHTML = next === 'dark' ? ICONS.moon : ICONS.sun;
}

function themeToggleMarkup() {
  const dark = resolvedTheme() === 'dark';
  const next = dark ? 'light' : 'dark';
  const label = `Switch to ${next} theme`;
  return `<button class="theme-toggle" type="button" data-action="toggle-theme" aria-label="${label}" title="${label}" aria-pressed="${dark}"><span class="theme-toggle-glyph" aria-hidden="true">${
    next === 'dark' ? ICONS.moon : ICONS.sun
  }</span></button>`;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing keeps the choice for this session only.
  }
  syncThemeChrome();
}

function toggleTheme(anchor) {
  const next = resolvedTheme() === 'dark' ? 'light' : 'dark';
  if (!document.startViewTransition || prefersReducedMotion()) {
    applyTheme(next);
    return;
  }
  // Grow a circle out of the button so the new palette reads as a wipe. The
  // geometry travels as custom properties because the reveal runs on a
  // view-transition pseudo-element outside this scope.
  const rect = anchor?.getBoundingClientRect?.();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 44;
  const y = rect ? rect.top + rect.height / 2 : 44;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const root = document.documentElement;
  root.style.setProperty('--theme-origin-x', `${Math.round(x)}px`);
  root.style.setProperty('--theme-origin-y', `${Math.round(y)}px`);
  root.style.setProperty('--theme-origin-r', `${Math.round(radius)}px`);
  document.startViewTransition(() => applyTheme(next));
}

// A stored choice wins over the OS; without one the stylesheet follows the
// system setting on its own.
const initialTheme = storedTheme();
if (initialTheme) document.documentElement.dataset.theme = initialTheme;
syncThemeChrome();

darkScheme.addEventListener('change', () => {
  if (!storedTheme()) syncThemeChrome();
});

class ApiError extends Error {
  constructor(error, status = 0) {
    super(error?.message || 'The local Tokenly server returned an error.');
    this.name = 'ApiError';
    this.code = error?.code || 'API_ERROR';
    this.detail = error?.detail || null;
    this.hint = error?.hint || null;
    this.extra = error?.extra || null;
    this.status = status;
  }
}

const state = {
  boot: null,
  route: null,
  dashboard: null,
  loading: false,
  pendingPricingRefresh: false,
  error: null,
  chartMetric: 'tokens',
  chartRowsByPeriod: new Map(),
  reportSeq: 0,
  reportAbort: null,
  knownVersion: null,
  lastDashboardHref: null,
  settings: null,
  settingsRows: [],
  settingsSnapshot: '[]',
  settingsDirty: false,
  settingsLoading: false,
  settingsError: null,
  settingsSaving: false,
  formError: null,
  fieldErrors: new Set(),
  catalog: null,
  catalogError: null,
  lastSavedAt: null,
  settingsSeq: 0,
  suppressPricingEventsUntil: 0,
  bootError: null,
  routeReason: null,
};

let chartResizeTimer = null;
let chartObserver = null;
let ledgerObserver = null;
let freshnessTimer = null;
let eventSource = null;
let toastSequence = 0;

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function appVersion() {
  return state.boot?.app?.version ?? '1.0.0';
}

function agents() {
  return state.boot?.agents ?? [];
}

function agentLabel(agent) {
  if (agent === 'all') return 'All agents';
  return agents().find((entry) => entry.id === agent)?.label ?? agent;
}

function defaultRange(report) {
  return state.boot?.defaultRanges?.[report] ?? (report === 'monthly' ? '12m' : '30d');
}

function rangesFor(report) {
  return state.boot?.ranges?.[report] ?? [];
}

function dashboardHref(agent, report, range) {
  return `/usage/${encodeURIComponent(agent)}/${report}?range=${encodeURIComponent(range)}`;
}

function settingsHref() {
  return '/settings';
}

function isRangeFor(report, range) {
  return rangesFor(report).some((entry) => entry.id === range);
}

function serializableRows(rows) {
  return JSON.stringify(
    rows.map((row) => ({
      model: row.model,
      inputCostPerMillion: row.inputCostPerMillion,
      outputCostPerMillion: row.outputCostPerMillion,
      cacheReadCostPerMillion: row.cacheReadCostPerMillion,
      cacheCreationCostPerMillion: row.cacheCreationCostPerMillion,
      hasAdvancedFields: row.hasAdvancedFields,
    })),
  );
}

function rowsFromConfig(config) {
  return (config?.overrideRows ?? []).map((row) => ({
    model: row.model ?? '',
    inputCostPerMillion: formatPriceInput(row.inputCostPerMillion),
    outputCostPerMillion: formatPriceInput(row.outputCostPerMillion),
    cacheReadCostPerMillion: formatPriceInput(row.cacheReadCostPerMillion),
    cacheCreationCostPerMillion: formatPriceInput(row.cacheCreationCostPerMillion),
    hasAdvancedFields: row.hasAdvancedFields === true,
  }));
}

async function apiFetch(path, { method = 'GET', body = null, signal = null } = {}) {
  let response;
  try {
    const headers = { Accept: 'application/json' };
    if (body !== null) {
      headers['Content-Type'] = 'application/json';
      headers['X-Tokenly'] = 'settings';
    }
    response = await fetch(path, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(
      {
        code: 'NETWORK_ERROR',
        message: 'Tokenly’s local server stopped responding.',
        detail: error?.message || 'The fetch failed before a response arrived.',
        hint: 'Check the terminal running Tokenly. Start it again with “npm start” if it has stopped.',
      },
      0,
    );
  }

  let payload = null;
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      {
        code: 'BAD_RESPONSE',
        message: 'Tokenly’s local server sent a response it could not read.',
        detail: text.slice(0, 500),
      },
      response.status,
    );
  }

  if (!response.ok || payload?.ok === false) {
    throw new ApiError(payload?.error ?? { message: `Request failed (${response.status}).` }, response.status);
  }

  return payload;
}

function parseRoute() {
  const { pathname, search } = window.location;

  if (pathname === '/' || pathname === '') {
    const href = dashboardHref('all', 'daily', defaultRange('daily'));
    history.replaceState(null, '', href);
    return { name: 'dashboard', agent: 'all', report: 'daily', range: defaultRange('daily') };
  }

  if (pathname === '/settings' || pathname === '/settings/') {
    if (pathname !== '/settings' || search) {
      history.replaceState(null, '', '/settings');
    }
    return { name: 'settings' };
  }

  const match = /^\/usage\/([^/]+)\/(daily|monthly)\/?$/.exec(pathname);
  if (!match) {
    return { name: 'notfound', reason: 'That page isn’t part of Tokenly.' };
  }

  let agent;
  try {
    agent = decodeURIComponent(match[1]);
  } catch {
    return { name: 'notfound', reason: 'The agent name in this URL is malformed.' };
  }
  const report = match[2];
  const knownAgent = agent === 'all' || agents().some((entry) => entry.id === agent);
  if (!knownAgent) {
    return {
      name: 'notfound',
      reason: 'That agent isn’t supported by this version of ccusage.',
    };
  }

  const requestedRange = new URLSearchParams(search).get('range');
  const range = isRangeFor(report, requestedRange) ? requestedRange : defaultRange(report);
  const href = dashboardHref(agent, report, range);
  if (pathname + search !== href) history.replaceState(null, '', href);
  return { name: 'dashboard', agent, report, range };
}

function parseHref(href) {
  const url = new URL(href, window.location.origin);
  if (!url.pathname.startsWith('/usage/')) return null;
  const match = /^\/usage\/([^/]+)\/(daily|monthly)\/?$/.exec(url.pathname);
  if (!match) return null;
  try {
    const agent = decodeURIComponent(match[1]);
    const report = match[2];
    const range = isRangeFor(report, url.searchParams.get('range'))
      ? url.searchParams.get('range')
      : defaultRange(report);
    if (agent !== 'all' && !agents().some((entry) => entry.id === agent)) return null;
    return { name: 'dashboard', agent, report, range };
  } catch {
    return null;
  }
}

function routeHref(route) {
  if (!route) return dashboardHref('all', 'daily', defaultRange('daily'));
  if (route.name === 'settings') return '/settings';
  if (route.name === 'dashboard') return dashboardHref(route.agent, route.report, route.range);
  return '/';
}

function rememberDashboard(route) {
  if (route?.name !== 'dashboard') return;
  state.lastDashboardHref = routeHref(route);
  try {
    sessionStorage.setItem('tokenly:lastDashboard', state.lastDashboardHref);
  } catch {
    // Session storage is optional.
  }
}

function restoreLastDashboard() {
  try {
    const stored = sessionStorage.getItem('tokenly:lastDashboard');
    if (!stored) return null;
    const url = new URL(stored, window.location.origin);
    return parseHref(url.pathname + url.search);
  } catch {
    return null;
  }
}

function navigationRouteForReport(report) {
  const current =
    state.route?.name === 'dashboard'
      ? state.route
      : restoreLastDashboard() ?? {
          name: 'dashboard',
          agent: 'all',
          report: 'daily',
          range: defaultRange('daily'),
        };
  const range = isRangeFor(report, current.range) ? current.range : defaultRange(report);
  return { name: 'dashboard', agent: current.agent ?? 'all', report, range };
}

function buildShell(content, { pageClass = '', routeName = 'dashboard' } = {}) {
  const route = state.route;
  const activeReport = route?.name === 'dashboard' ? route.report : null;
  const dailyRoute = navigationRouteForReport('daily');
  const monthlyRoute = navigationRouteForReport('monthly');
  const version = state.knownVersion;
  const settingsActive = routeName === 'settings';
  const hasRefresh = routeName === 'dashboard';
  const freshness = renderFreshness();
  const breadcrumbs = renderBreadcrumbs();

  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary">
        <button class="brand" type="button" data-href="${dashboardHref(
          route?.name === 'dashboard' ? route.agent : dailyRoute.agent,
          'daily',
          defaultRange('daily'),
        )}" aria-label="Tokenly dashboard">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span class="brand-copy">
            <span class="brand-word">tokenly<i>.</i></span>
            <span class="brand-note">a local token ledger</span>
          </span>
        </button>
        <nav class="side-nav" aria-label="Reports">
          <p class="side-label">Reports</p>
          <ul class="nav-list">
            <li>
              <button class="nav-link" type="button" data-href="${routeHref(dailyRoute)}" ${
                activeReport === 'daily' ? 'aria-current="page"' : ''
              }>
                <span class="nav-index">01</span>
                <span>Daily</span>
              </button>
            </li>
            <li>
              <button class="nav-link" type="button" data-href="${routeHref(monthlyRoute)}" ${
                activeReport === 'monthly' ? 'aria-current="page"' : ''
              }>
                <span class="nav-index">02</span>
                <span>Monthly</span>
              </button>
            </li>
          </ul>
        </nav>
        <div class="sidebar-bottom">
          <div class="local-block">
            <div class="local-head"><span class="local-dot"></span>Local only</div>
            <p class="local-copy">No telemetry. No cloud. Your ledger stays on this machine.</p>
          </div>
          <div class="side-footer">
            <span class="version-readout">${version ? `ccusage ${escapeHtml(version)}` : 'ccusage · local'}</span>
            <button class="settings-link" type="button" data-href="/settings" ${
              settingsActive ? 'aria-current="page"' : ''
            } aria-label="Pricing settings">
              ${ICONS.settings}<span>Settings</span>
            </button>
          </div>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="breadcrumbs">${breadcrumbs}</div>
            <div class="topbar-actions">
              ${freshness}
              ${
                hasRefresh
                  ? `<button class="refresh-button ${
                      state.loading ? 'is-loading' : ''
                    }" type="button" data-action="refresh" ${
                      state.loading ? 'disabled' : ''
                    } aria-label="Refresh report">
                      ${ICONS.refresh}<span>Refresh</span>
                    </button>`
                  : `<button class="btn btn-sm btn-ghost" type="button" data-href="${state.lastDashboardHref ?? dashboardHref('all', 'daily', defaultRange('daily'))}">Usage ${ICONS.arrowUpRight}</button>`
              }
              ${themeToggleMarkup()}
            </div>
          </div>
        </header>
        <main id="main-content" ${
          state.loading || state.settingsLoading ? 'aria-busy="true"' : ''
        }>
          <div class="page-content ${pageClass}">
            ${content}
          </div>
        </main>
      </div>
    </div>`;
}

function renderBreadcrumbs() {
  if (state.route?.name === 'settings') {
    return `<span>Local config</span><span class="crumb-sep">/</span><strong>Settings</strong>`;
  }
  if (state.route?.name === 'dashboard') {
    return `<span class="crumb-extra">Usage</span><span class="crumb-sep crumb-extra">/</span><strong>${escapeHtml(
      agentLabel(state.route.agent),
    )}</strong><span class="crumb-sep">/</span><span>${escapeHtml(
      state.route.report === 'daily' ? 'Daily' : 'Monthly',
    )}</span>`;
  }
  return `<span>Tokenly</span><span class="crumb-sep">/</span><strong>Not found</strong>`;
}

function renderFreshness() {
  if (state.route?.name === 'settings') {
    if (state.settingsError) {
      return `<span class="freshness" data-tone="error"><span class="freshness-dot"></span>Config issue</span>`;
    }
    return `<span class="freshness" title="Your ccusage config stays on this machine"><span class="freshness-dot"></span>Local config</span>`;
  }
  if (state.route?.name !== 'dashboard') {
    return `<span class="freshness"><span class="freshness-dot"></span>Local only</span>`;
  }
  if (state.loading && !state.dashboard) {
    return `<span class="freshness" data-freshness>Reading ccusage…</span>`;
  }
  if (state.dashboard) {
    const generated = state.dashboard.meta.generatedAt;
    return `<span class="freshness" data-freshness title="Report generated ${escapeAttribute(
      formatDateTime(generated),
    )}"><span class="freshness-dot"></span><span data-freshness-text>Updated ${relativeTime(
      generated,
    )}</span></span>`;
  }
  if (state.error) {
    return `<span class="freshness" data-tone="error"><span class="freshness-dot"></span>No report</span>`;
  }
  return `<span class="freshness"><span class="freshness-dot"></span>No report</span>`;
}

function renderFooter() {
  return `
    <footer class="page-footer">
      <div class="footer-left">
        <span class="footer-seal">LOCAL ONLY</span>
        <span>No telemetry</span>
        <span>·</span>
        <span>Tokenly ${escapeHtml(appVersion())}</span>
      </div>
      <div>Powered by <a href="https://ccusage.com/guide/" target="_blank" rel="noreferrer noopener">ccusage</a> · <a href="https://ccusage.com/guide/config-files" target="_blank" rel="noreferrer noopener">pricing docs</a></div>
    </footer>`;
}

function agentMenuGroups(selected, report) {
  const detected = new Map((report?.detectedAgents ?? []).map((entry) => [entry.id, entry]));
  const known = new Map(agents().map((entry) => [entry.id, entry.label]));
  for (const entry of report?.detectedAgents ?? []) {
    if (!known.has(entry.id)) known.set(entry.id, entry.label ?? entry.id);
  }

  const option = (id, label, meta = null) => ({
    id,
    label,
    meta,
    selected: id === selected,
  });

  const seen = [...known.entries()].filter(([id]) => detected.has(id));
  const unseen = [...known.entries()].filter(([id]) => !detected.has(id));
  const groups = [
    {
      label: null,
      options: [option('all', 'All agents', 'Every source combined')],
    },
  ];

  if (seen.length) {
    groups.push({
      label: 'Seen in ccusage',
      options: seen.map(([id, label]) =>
        option(
          id,
          label,
          `${formatCompactNumber(detected.get(id)?.totalTokens ?? 0)} tokens in this window`,
        ),
      ),
    });
  }
  if (unseen.length) {
    groups.push({
      label: 'Other supported agents',
      options: unseen.map(([id, label]) => option(id, label, 'No activity in this window')),
    });
  }
  return groups;
}

function renderAgentDropdown(route, report) {
  let optionIndex = 0;
  const groups = agentMenuGroups(route.agent, report)
    .map((group) => {
      const options = group.options
        .map((entry) => {
          const index = optionIndex;
          optionIndex += 1;
          return `
            <button
              class="agent-option"
              type="button"
              role="option"
              id="agent-option-${escapeAttribute(entry.id)}"
              data-agent-option="${escapeAttribute(entry.id)}"
              data-agent-index="${index}"
              aria-selected="${entry.selected}"
              tabindex="-1"
            >
              <span class="agent-option-mark" aria-hidden="true">${renderAgentMark(
                entry.id,
              )}</span>
              <span class="agent-option-copy">
                <span class="agent-option-name">${escapeHtml(entry.label)}</span>
                ${
                  entry.meta
                    ? `<span class="agent-option-meta">${escapeHtml(entry.meta)}</span>`
                    : ''
                }
              </span>
              <span class="agent-option-check" aria-hidden="true">${ICONS.check}</span>
            </button>`;
        })
        .join('');
      return `
        <div class="agent-menu-group" role="group" ${
          group.label ? `aria-label="${escapeAttribute(group.label)}"` : ''
        }>
          ${group.label ? `<p class="agent-menu-label">${escapeHtml(group.label)}</p>` : ''}
          ${options}
        </div>`;
    })
    .join('');

  return `
    <div class="select-wrap source-dropdown" data-agent-dropdown data-open="false" data-active-index="-1">
      <button
        class="source-select"
        id="agent-select"
        type="button"
        data-action="toggle-agent-menu"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="agent-listbox"
        aria-label="Report source: ${escapeAttribute(agentLabel(route.agent))}"
      >
        <span class="source-select-mark" aria-hidden="true">${renderAgentMark(
          route.agent,
        )}</span>
        <span class="source-selected">${escapeHtml(agentLabel(route.agent))}</span>
        ${ICONS.chevronDown.replace('<svg ', '<svg class="select-chevron" ')}
      </button>
      <div class="agent-menu" id="agent-listbox" role="listbox" aria-label="Report source" hidden>
        ${groups}
      </div>
    </div>`;
}

function renderHero(route, report = null) {
  const range =
    report?.range ??
    rangesFor(route.report).find((entry) => entry.id === route.range) ?? {
      label: 'Selected range',
    };
  const windowLabel = report?.range
    ? rangeWindowLabel(report.range, route.report)
    : range.label ?? 'Selected window';
  const sub =
    route.agent === 'all'
      ? `Every coding agent on this machine, in one private ledger. Read offline from <strong>ccusage</strong>; nothing leaves your desk.`
      : `${escapeHtml(agentLabel(route.agent))}, in a private local ledger. Read offline from <strong>ccusage</strong>; nothing leaves your desk.`;
  const title = route.report === 'daily' ? `Days, <em>itemized.</em>` : `Months, <em>in full.</em>`;
  const rangeLinks = rangesFor(route.report)
    .map((entry) => {
      const href = dashboardHref(route.agent, route.report, entry.id);
      const active = entry.id === route.range;
      return `<button class="range-link" type="button" data-href="${href}" ${
        active ? 'aria-current="page"' : ''
      }>${escapeHtml(entry.short)}</button>`;
    })
    .join('');

  return `
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <div class="eyebrow">
          <span>Local usage</span>
          <span class="eyebrow-sep"></span>
          <span>${escapeHtml(range.label ?? '')}</span>
          ${
            report?.range
              ? `<span class="eyebrow-sep"></span><span class="eyebrow-date">${escapeHtml(
                  windowLabel,
                )}</span>`
              : ''
          }
        </div>
        <h1 id="page-title">${title}</h1>
        <p class="hero-sub">${sub}</p>
      </div>
      <div class="hero-controls">
        <div>
          <label class="control-label" for="agent-select">
            <span>Source</span>
            <span class="control-hint">${(report?.detectedAgents ?? []).length > 0 ? `${report.detectedAgents.length} seen` : ''}</span>
          </label>
          ${renderAgentDropdown(route, report)}
        </div>
        <div>
          <div class="control-label">
            <span>Window</span>
            <span class="control-hint">URL-routed</span>
          </div>
          <nav class="range-switch" aria-label="Report window">${rangeLinks}</nav>
        </div>
        <p class="url-hint">${ICONS.link}This exact view lives in the URL.</p>
      </div>
    </section>`;
}

function renderSkeleton() {
  return `
    <div aria-busy="true" aria-live="polite">
      <p class="loading-status"><span class="loading-dots"><i></i><i></i><i></i></span>Reading ccusage on this machine…</p>
      <div class="skeleton-ledger" aria-hidden="true">
        ${Array.from({ length: 5 }, () => '<div class="skeleton-block skeleton-metric"></div>').join('')}
      </div>
      <div class="skeleton-grid" aria-hidden="true">
        <div class="skeleton-block skeleton-panel"></div>
        <div class="skeleton-block skeleton-panel"></div>
      </div>
    </div>`;
}

function renderWarnings(report) {
  if (!report?.warnings?.length) return '';
  return report.warnings
    .map((warning) => {
      if (warning.code !== 'UNPRICED_MODELS') return '';
      const names = warning.models ?? [];
      const shown = names.slice(0, 3).join(', ');
      const more = names.length > 3 ? ` +${names.length - 3} more` : '';
      return `
        <div class="notice" role="status">
          <span class="notice-icon" aria-hidden="true">!</span>
          <div class="notice-copy">
            <div class="notice-title">${escapeHtml(warning.title || 'Some models have no known price')}</div>
            <p class="notice-text">${escapeHtml(shown)}${escapeHtml(
              more,
            )} ${names.length === 1 ? 'is' : 'are'} counted at $0.00 because ccusage has no price for ${names.length === 1 ? 'it' : 'them'}. Add an override if that should cost money.</p>
          </div>
          <button class="notice-action" type="button" data-href="/settings">Add Pricing →</button>
        </div>`;
    })
    .join('');
}

function metricMarkup({ label, value, display, foot, swatch, total = false, index }) {
  return `
    <div class="metric ${total ? 'metric--total' : ''}" style="--metric-index:${index}">
      <div class="metric-label">
        ${swatch ? `<span class="metric-dot" style="--swatch:${swatch}"></span>` : ''}
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="metric-value" title="${escapeAttribute(formatNumber(value))}">${escapeHtml(display)}</div>
      <div class="metric-foot">${foot}</div>
    </div>`;
}

function renderMetrics(report) {
  const totals = report.totals;
  const series = Object.fromEntries(TOKEN_SERIES.map((entry) => [entry.key, entry]));
  const periods = pluralize(report.counts.periods, 'active period');
  const share = (key) => formatPercent(totals[key], totals.totalTokens);
  return `
    <section class="metric-ledger" aria-label="Usage summary">
      ${metricMarkup({
        label: 'Total tokens',
        value: totals.totalTokens,
        display: formatCompactNumber(totals.totalTokens),
        foot: `<span>${periods}</span><strong>${report.counts.models} models</strong>`,
        total: true,
        index: 0,
      })}
      ${metricMarkup({
        label: 'Input',
        value: totals.inputTokens,
        display: formatCompactNumber(totals.inputTokens),
        foot: `<span>${share('inputTokens')} of total</span><span class="metric-share">prompt</span>`,
        swatch: series.inputTokens.color,
        index: 1,
      })}
      ${metricMarkup({
        label: 'Output',
        value: totals.outputTokens,
        display: formatCompactNumber(totals.outputTokens),
        foot: `<span>${share('outputTokens')} of total</span><span class="metric-share">generated</span>`,
        swatch: series.outputTokens.color,
        index: 2,
      })}
      ${metricMarkup({
        label: 'Cache read',
        value: totals.cacheReadTokens,
        display: formatCompactNumber(totals.cacheReadTokens),
        foot: `<span>${share('cacheReadTokens')} of total</span><span class="metric-share">cached</span>`,
        swatch: series.cacheReadTokens.color,
        index: 3,
      })}
      ${metricMarkup({
        label: 'Cache write',
        value: totals.cacheCreationTokens,
        display: formatCompactNumber(totals.cacheCreationTokens),
        foot: `<span>${share('cacheCreationTokens')} of total</span><span class="metric-share">stored</span>`,
        swatch: series.cacheCreationTokens.color,
        index: 4,
      })}
    </section>`;
}

function renderChartLegend(metric) {
  if (metric === 'cost') {
    return `<span class="legend-item"><span class="legend-swatch" style="--swatch:#e9643f"></span>Estimated cost</span>`;
  }
  return TOKEN_SERIES.map(
    (series) =>
      `<span class="legend-item"><span class="legend-swatch" style="--swatch:${series.color}"></span>${escapeHtml(
        series.label,
      )}</span>`,
  ).join('');
}

function renderChartPanel(report) {
  const limit = report.report === 'daily' ? 60 : 36;
  const shownCount = Math.min(report.rows.length, limit);
  const truncated = report.rows.length > limit;
  const isCost = state.chartMetric === 'cost';
  return `
    <article class="panel chart-panel" id="chart-panel" aria-labelledby="chart-title">
      <div class="panel-header">
        <div class="panel-heading">
          <div class="panel-kicker">${isCost ? 'Estimated spend' : 'Token volume'}</div>
          <h2 class="panel-title" id="chart-title">${isCost ? 'The cost curve' : 'Where the tokens go'}</h2>
          <p class="panel-subtitle" id="chart-subtitle">${
            isCost
              ? 'ccusage’s estimate for each period, at current pricing.'
              : 'Input, output, and cache, stacked by period.'
          }</p>
        </div>
        <div class="panel-tools">
          <div class="segmented" role="group" aria-label="Chart metric">
            <button type="button" data-action="chart-metric" data-metric="tokens" aria-pressed="${
              isCost ? 'false' : 'true'
            }">Tokens</button>
            <button type="button" data-action="chart-metric" data-metric="cost" aria-pressed="${
              isCost ? 'true' : 'false'
            }">Cost</button>
          </div>
        </div>
      </div>
      <div class="chart-shell" id="chart-shell">
        <div class="chart-mount" data-chart-mount aria-live="off"></div>
        <div class="chart-tooltip" id="chart-tooltip" aria-hidden="true"></div>
      </div>
      <div class="chart-legend">${renderChartLegend(state.chartMetric)}</div>
      <p class="chart-note">${
        isCost
          ? 'The line is an estimate from ccusage. Unpriced models count as $0 until you add a rate.'
          : 'Bars are stacked from input, output, cache read, and cache write. Hover or focus a bar for the exact split.'
      }${
        truncated
          ? ` The chart shows the latest ${shownCount} of ${report.rows.length} periods; the table has all of them.`
          : ''
      }</p>
    </article>`;
}

function otherAgentsTotals(agentTotals) {
  if (agentTotals.length <= 4) return agentTotals;
  const visible = agentTotals.slice(0, 3);
  const other = agentTotals.slice(3).reduce(
    (accumulator, entry) => {
      accumulator.totalTokens += entry.totalTokens;
      accumulator.totalCost += entry.totalCost;
      return accumulator;
    },
    { agent: '__other', label: 'Other agents', totalTokens: 0, totalCost: 0 },
  );
  return [...visible, other];
}

function renderSummaryPanel(report) {
  const parts = moneyParts(report.totals.totalCost);
  const agentEntries = otherAgentsTotals(report.agents ?? []);
  const totalTokens = report.totals.totalTokens || 1;
  const cacheRate = formatPercent(report.totals.cacheReadTokens, report.totals.totalTokens);
  const avgCost = report.counts.periods ? report.totals.totalCost / report.counts.periods : 0;
  const splitLabel = report.agent === 'all' ? 'Agent split' : 'Focused source';
  const splitMarkup = agentEntries.length
    ? agentEntries
        .map((entry) => {
          const color = agentColor(entry.agent);
          const percent = clamp((entry.totalTokens / totalTokens) * 100, 0, 100);
          return `
            <div class="agent-row">
              <div class="agent-name"><span class="agent-dot" style="--swatch:${color}"></span><span>${escapeHtml(
                entry.label ?? agentLabel(entry.agent),
              )}</span></div>
              <div class="agent-metric">${formatPercent(entry.totalTokens, report.totals.totalTokens)}</div>
              <div class="agent-bar" style="--width:${percent.toFixed(2)}%;--swatch:${color}"><span></span></div>
            </div>`;
        })
        .join('')
    : `<p class="summary-caption">No source breakdown in this report.</p>`;

  return `
    <aside class="panel summary-panel" aria-labelledby="summary-title">
      <div class="summary-kicker">Estimated spend</div>
      <h2 class="summary-cost" id="summary-title" title="${escapeAttribute(
        formatMoney(report.totals.totalCost, { precise: true }),
      )}" aria-label="Estimated spend ${escapeAttribute(formatMoney(report.totals.totalCost, { precise: true }))}">
        <span class="currency" aria-hidden="true">$</span><span aria-hidden="true">${escapeHtml(
          parts.whole,
        )}</span><span class="cost-decimals" aria-hidden="true">${escapeHtml(parts.fraction)}</span>
      </h2>
      <p class="summary-caption"><strong>${report.counts.periods}</strong> active ${report.report === 'daily' ? 'days' : 'months'} · ccusage estimate at current pricing</p>
      <div class="summary-divider"></div>
      <div class="agent-split-label"><span>${splitLabel}</span><span>${escapeHtml(
        String(report.counts.agents).padStart(2, '0'),
      )} ${report.counts.agents === 1 ? 'source' : 'sources'}</span></div>
      <div class="agent-list">${splitMarkup}</div>
      <div class="summary-stats">
        <div>
          <div class="summary-stat-label">Avg / ${report.report === 'daily' ? 'day' : 'month'}</div>
          <div class="summary-stat-value">${formatMoney(avgCost, { precise: true })}</div>
        </div>
        <div>
          <div class="summary-stat-label">Cache read</div>
          <div class="summary-stat-value">${cacheRate} <small>of tokens</small></div>
        </div>
      </div>
      ${
        report.counts.unpricedModels > 0
          ? `<p class="summary-caption" style="margin-top:10px">${report.counts.unpricedModels} unpriced ${
              report.counts.unpricedModels === 1 ? 'model' : 'models'
            } · $0.00.</p>`
          : ''
      }
    </aside>`;
}

function renderAgentChips(agentsForRow) {
  if (!agentsForRow?.length) return '';
  return `<div class="agent-chips">${agentsForRow
    .map((entry) => {
      const label = entry.label ?? entry.agent;
      return `<span class="agent-chip" role="img" aria-label="${escapeAttribute(
        label,
      )}" title="${escapeAttribute(label)}">${renderAgentMark(entry.agent)}</span>`;
    })
    .join('')}</div>`;
}

function renderDetailRow(row, report, index, label) {
  const detailId = `period-detail-${index}`;
  const models = row.models ?? [];
  const agentsForRow = report.agent === 'all' ? row.agents : row.agents?.slice(0, 1) ?? [];
  const modelMarkup = models.length
    ? models
        .map(
          (model) => `
            <div class="model-detail-row">
              <span class="model-detail-name" translate="no" title="${escapeAttribute(model.modelName)}">${escapeHtml(
                model.modelName,
              )}</span>
              <span class="model-detail-number">${formatNumber(model.totalTokens)}</span>
              <span class="model-detail-number">${formatPercent(
                model.totalTokens,
                row.totalTokens,
              )}</span>
              <span class="model-detail-number">${formatMoney(model.cost, { precise: true })}</span>
            </div>`,
        )
        .join('')
    : `<p class="summary-caption">No model breakdown for this period.</p>`;
  const agentMarkup = agentsForRow.length
    ? `<div class="detail-split">
        <div class="detail-label">${report.agent === 'all' ? 'By agent' : 'Source'}</div>
        ${agentsForRow
          .map(
            (entry) => `
              <div class="detail-split-row">
                <span class="detail-agent">${renderAgentMark(
                  entry.agent,
                )}${escapeHtml(entry.label ?? agentLabel(entry.agent))}</span>
                <strong>${formatNumber(entry.totalTokens)} · ${formatMoney(entry.totalCost, {
                  precise: true,
                })}</strong>
              </div>`,
          )
          .join('')}
      </div>`
    : `<div class="detail-split">
        <div class="detail-label">Pricing note</div>
        <p class="summary-caption">${row.missingPricing ? 'At least one model in this period has no known price and is counted at $0.' : 'All models in this period have a known ccusage price.'}</p>
      </div>`;

  return `
    <tr class="detail-row" id="${detailId}" hidden>
      <td colspan="8">
        <div class="detail-inner">
          <div>
            <div class="detail-label">Models · inputs, output, cache</div>
            <div class="model-detail-list">${modelMarkup}</div>
          </div>
          ${agentMarkup}
        </div>
      </td>
    </tr>`;
}

function renderTablePanel(report) {
  const heading = report.report === 'daily' ? 'The daily ledger' : 'The monthly ledger';
  const subtitle =
    report.report === 'daily'
      ? 'Every active day, newest first. Open a row for the model split.'
      : 'Every active month, newest first. Open a row for the model split.';
  const rows = [...report.rows].reverse();
  const countLabel =
    report.rows.length === 0
      ? 'No periods'
      : `${report.rows.length} ${report.rows.length === 1 ? 'period' : 'periods'}`;

  if (rows.length === 0) {
    return `
      <article class="panel table-panel" aria-labelledby="table-title">
        <div class="panel-header">
          <div class="panel-heading">
            <div class="panel-kicker">Line items</div>
            <h2 class="panel-title" id="table-title">${heading}</h2>
            <p class="panel-subtitle">${subtitle}</p>
          </div>
          <span class="override-count">${countLabel}</span>
        </div>
        <div class="empty-table">
          <strong>Nothing in this window.</strong>
          <p>ccusage found no usage for ${escapeHtml(
            agentLabel(report.agent),
          )} in this range. Widen the window, or check another agent.</p>
          ${
            report.range.id !== 'all'
              ? `<button class="btn btn-sm" type="button" data-href="${dashboardHref(
                  report.agent,
                  report.report,
                  'all',
                )}">See All Time</button>`
              : ''
          }
        </div>
      </article>`;
  }

  const body = rows
    .map((row, index) => {
      const label = periodLabel(row.period, report.report);
      const detailId = `period-detail-${index}`;
      const unpricedStar = row.missingPricing
        ? `<span class="unpriced-star" aria-hidden="true" title="A model in this period has no known price">*</span><span class="sr-only">Some models unpriced</span>`
        : '';
      return `
        <tr class="data-row">
          <td>
            <div class="period-cell">
              <div class="period-copy">
                <span class="period-primary">${escapeHtml(label.primary)}</span>
                <span class="period-secondary">${escapeHtml(label.secondary)}</span>
                ${report.agent === 'all' ? renderAgentChips(row.agents) : ''}
              </div>
            </div>
          </td>
          <td>${formatNumber(row.inputTokens)}</td>
          <td class="output-cell">${formatNumber(row.outputTokens)}</td>
          <td class="cache-cell">${formatNumber(row.cacheReadTokens)}</td>
          <td class="cache-cell">${formatNumber(row.cacheCreationTokens)}</td>
          <td class="total-cell">${formatNumber(row.totalTokens)}</td>
          <td class="cost-cell">${formatMoney(row.totalCost, { precise: true })}${unpricedStar}</td>
          <td>
            <button class="expand-button" type="button" data-action="toggle-detail" data-target="${detailId}" aria-expanded="false" aria-controls="${detailId}" aria-label="Show ${escapeAttribute(
              label.full,
            )} breakdown">
              ${ICONS.chevronDown}
            </button>
          </td>
        </tr>
        ${renderDetailRow(row, report, index, label)}`;
    })
    .join('');

  return `
    <article class="panel table-panel" aria-labelledby="table-title">
      <div class="panel-header">
        <div class="panel-heading">
          <div class="panel-kicker">Line items</div>
          <h2 class="panel-title" id="table-title">${heading}</h2>
          <p class="panel-subtitle">${subtitle}</p>
        </div>
        <div class="panel-tools">
          <span class="override-count">${countLabel}</span>
          <span class="scroll-hint">swipe →</span>
        </div>
      </div>
      <div class="table-frame">
        <div class="table-scroll" tabindex="0" role="region" aria-label="${report.report === 'daily' ? 'Daily' : 'Monthly'} usage table; scroll horizontally for all columns" data-ledger-scroll>
          <table class="data-table" data-ledger-body>
            <caption class="sr-only">${report.report === 'daily' ? 'Daily' : 'Monthly'} token usage by period, including input, output, cache reads, cache writes, total tokens, and estimated cost.</caption>
            <colgroup><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Input</th>
                <th scope="col">Output</th>
                <th scope="col">Cache read</th>
                <th scope="col">Cache write</th>
                <th scope="col">Total</th>
                <th scope="col">Cost</th>
                <th scope="col"><span class="sr-only">Expand</span></th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        <div class="table-foot" data-ledger-foot>
          <table class="data-table data-table--totals" aria-label="Totals for this range">
            <colgroup>
              <col /><col /><col /><col /><col /><col /><col /><col />
            </colgroup>
            <tbody>
              <tr class="total-row">
                <th scope="row">Total</th>
                <td>${formatNumber(report.totals.inputTokens)}</td>
                <td>${formatNumber(report.totals.outputTokens)}</td>
                <td>${formatNumber(report.totals.cacheReadTokens)}</td>
                <td>${formatNumber(report.totals.cacheCreationTokens)}</td>
                <td>${formatNumber(report.totals.totalTokens)}</td>
                <td>${formatMoney(report.totals.totalCost, { precise: true })}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>`;
}

function renderModelPanel(report) {
  const models = report.models.slice(0, 8);
  const unpriced = report.models.filter((model) => model.missingPricing).length;
  return `
    <aside class="panel model-panel" aria-labelledby="models-title">
      <div class="panel-header">
        <div class="panel-heading">
          <div class="panel-kicker">Distribution</div>
          <h2 class="panel-title" id="models-title">The model index</h2>
          <p class="panel-subtitle">Where this window’s tokens actually went.</p>
        </div>
      </div>
      ${
        models.length
          ? `<div class="model-list">
              ${models
                .map((model, index) => {
                  const share = formatPercent(model.totalTokens, report.totals.totalTokens);
                  const width = clamp(
                    (model.totalTokens / Math.max(report.totals.totalTokens, 1)) * 100,
                    0,
                    100,
                  );
                  return `
                    <div class="model-row">
                      <div class="model-row-head">
                        <div class="model-name-wrap">
                          <span class="model-swatch" style="--swatch:${MODEL_COLORS[index % MODEL_COLORS.length]}"></span>
                          <span class="model-name" translate="no" title="${escapeAttribute(model.modelName)}">${escapeHtml(
                            model.modelName,
                          )}</span>
                        </div>
                        <span class="model-share">${share}</span>
                      </div>
                      <div class="model-bar" style="--width:${width.toFixed(
                        2,
                      )}%;--swatch:${MODEL_COLORS[index % MODEL_COLORS.length]}"><span></span></div>
                      <div class="model-row-meta">
                        <span>${formatCompactNumber(model.totalTokens)} tokens</span>
                        <span>·</span>
                        <span>${formatMoney(model.totalCost, { precise: true })}</span>
                        ${model.missingPricing ? '<span class="unpriced-badge">Unpriced</span>' : ''}
                      </div>
                    </div>`;
                })
                .join('')}
            </div>`
          : `<div class="empty-table"><strong>No models yet.</strong><p>No token activity means no models to index.</p></div>`
      }
      <div class="model-footer">
        <span><strong>${report.counts.models}</strong> ${report.counts.models === 1 ? 'model' : 'models'}${unpriced ? ` · ${unpriced} unpriced` : ''}</span>
        ${
          unpriced
            ? `<button class="text-link" type="button" data-href="/settings">Add prices ${ICONS.arrowUpRight}</button>`
            : `<span>ccusage exact labels</span>`
        }
      </div>
    </aside>`;
}

function commandTokenClass(token, index) {
  if (index === 0) return 'cmd-name';
  if (token.startsWith('--')) return 'cmd-flag';
  if (/^["']/.test(token) || /[\\/]/.test(token) || token.startsWith('~')) return 'cmd-path';
  return '';
}

function highlightCommand(command) {
  const tokens = String(command).match(/(?:"[^"]*"|'[^']*'|\S+)/g) ?? [String(command)];
  return tokens
    .map((token, index) => {
      const cls = commandTokenClass(token, index);
      return cls ? `<span class="${cls}">${escapeHtml(token)}</span>` : escapeHtml(token);
    })
    .join(' ');
}

function middleEllipsis(value, max = 58) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function renderProvenance(report) {
  const meta = report.meta;
  const configPath = meta.configDisplayPath || meta.configPath;
  return `
    <section class="provenance" aria-labelledby="provenance-title">
      <div class="provenance-label">
        <div class="provenance-kicker">Provenance</div>
        <div class="provenance-title" id="provenance-title">This report ran <em>locally.</em></div>
      </div>
      <div class="provenance-command">
        <code class="provenance-code" translate="no">${highlightCommand(report.command)}</code>
        <button class="copy-button" type="button" data-action="copy" data-copy="${escapeAttribute(
          report.command,
        )}" data-copy-label="Command" aria-label="Copy the command used for this report">
          ${ICONS.copy}<span>Copy</span>
        </button>
      </div>
      <span class="provenance-local">${ICONS.shield}OFFLINE</span>
      <div class="provenance-meta">
        <span class="meta-chip"><span class="meta-dot"></span><strong>ccusage ${
          meta.version ? escapeHtml(meta.version) : 'local'
        }</strong></span>
        <span class="meta-chip"><strong>${formatDuration(meta.durationMs)}</strong></span>
        <span class="meta-chip"><strong>${escapeHtml(
          formatDateTime(meta.generatedAt),
        )}</strong></span>
        <span class="meta-chip" translate="no" title="${escapeAttribute(configPath)}">config <strong>${escapeHtml(
          middleEllipsis(configPath, 44),
        )}</strong></span>
        <span class="meta-chip">${report.agent === 'all' ? 'unified' : 'focused'} report</span>
      </div>
    </section>`;
}

function renderReport(report) {
  return `
    ${renderWarnings(report)}
    ${renderMetrics(report)}
    <div class="dashboard-grid">
      ${renderChartPanel(report)}
      ${renderSummaryPanel(report)}
    </div>
    <div class="dashboard-grid dashboard-grid--lower">
      ${renderTablePanel(report)}
      ${renderModelPanel(report)}
    </div>
    ${renderProvenance(report)}
    ${renderFooter()}`;
}

function errorTitle(error) {
  switch (error?.code) {
    case 'CCUSAGE_NOT_FOUND':
      return 'ccusage is missing.';
    case 'CCUSAGE_BIN_INVALID':
      return 'That ccusage path is unusable.';
    case 'CONFIG_INVALID':
      return 'The ledger can’t read your config.';
    case 'CONFIG_READ_FAILED':
    case 'CONFIG_WRITE_FAILED':
      return 'The config file is out of reach.';
    case 'CONFIG_FOLDER_READONLY':
      return 'Your config folder is read-only.';
    case 'CCUSAGE_BAD_DATA':
      return 'Unexpected ledger data.';
    case 'CCUSAGE_TIMEOUT':
      return 'The report took too long.';
    case 'CCUSAGE_OUTPUT_TOO_LARGE':
      return 'That report is too large.';
    case 'INVALID_AGENT':
    case 'INVALID_REPORT':
      return 'That view isn’t available.';
    default:
      return 'The report stopped.';
  }
}

function errorKicker(error, context) {
  if (error?.code === 'CCUSAGE_NOT_FOUND') return 'Dependency missing';
  if (error?.code === 'CONFIG_FOLDER_READONLY') return 'Permission denied';
  if (context === 'settings') return 'Settings unavailable';
  if (error?.code === 'CONFIG_INVALID') return 'Configuration error';
  return 'Report interrupted';
}

function isPermissionError(error) {
  return (
    error?.code === 'CONFIG_FOLDER_READONLY' ||
    error?.code === 'CONFIG_WRITE_FAILED' ||
    error?.code === 'CONFIG_BACKUP_FAILED'
  );
}

/**
 * Permission errors carry a copy-pasteable PowerShell fix in `hint`; render
 * any lines that look like commands as their own copyable block.
 */
function renderHintBlocks(hint) {
  if (!hint) return '';
  const lines = hint.split('\n');
  const commands = [];
  const prose = [];

  for (const line of lines) {
    const command = /`([^`]+)`/.exec(line)?.[1]?.trim();
    if (command) {
      commands.push(command);
      const before = line.slice(0, line.indexOf('`')).replace(/[\s,.;:]+$/, '').trim();
      if (before) prose.push(before);
      const after = line.slice(line.indexOf('`') + command.length + 2).replace(/^[\s,.;:]+/, '').trim();
      if (after) prose.push(after);
    } else if (/^[A-Za-z]:\\|^~?[\\/]/.test(line.trim())) {
      commands.push(line.trim());
    } else if (line.trim()) {
      prose.push(line.trim());
    }
  }

  let markup = prose.map((part) => `<p class="state-hint">${escapeHtml(part)}</p>`).join('');
  for (const command of commands) {
    markup += `<div class="state-code"><code translate="no">${escapeHtml(
      command,
    )}</code><button class="copy-button" type="button" data-action="copy" data-copy="${escapeAttribute(
      command,
    )}" data-copy-label="Command" aria-label="Copy this command">${ICONS.copy}<span>Copy</span></button></div>`;
  }
  return markup;
}

function renderErrorState(error, { context = 'report' } = {}) {
  if (!error) return '';
  const installCommand = error.extra?.installCommand;
  const command = error.extra?.command;
  const path = error.extra?.displayPath || error.extra?.path;
  const retryAction = context === 'settings' ? 'retry-settings' : 'retry-report';
  const detail = error.detail && error.detail !== error.message ? error.detail : null;
  const rawDocsUrl = error.extra?.docsUrl || 'https://ccusage.com/guide/installation';
  const docsUrl = /^https?:\/\//i.test(rawDocsUrl)
    ? rawDocsUrl
    : 'https://ccusage.com/guide/installation';

  return `
    <section class="state-card" role="alert" aria-labelledby="state-title">
      <div class="state-icon">${ICONS.alert}</div>
      <div>
        <div class="state-kicker">${escapeHtml(errorKicker(error, context))}</div>
        <h2 class="state-title" id="state-title">${escapeHtml(errorTitle(error))}</h2>
        <p class="state-message">${escapeHtml(error.message)}</p>
        ${renderHintBlocks(error.hint)}
        ${
          installCommand
            ? `<div class="install-card">
                <div class="install-label">Install ccusage, then retry</div>
                <div class="install-command">
                  <code>${escapeHtml(installCommand)}</code>
                  <button class="copy-button" type="button" data-action="copy" data-copy="${escapeAttribute(
                    installCommand,
                  )}" data-copy-label="Install command">${ICONS.copy}<span>Copy</span></button>
                </div>
              </div>`
            : ''
        }
        ${
          path
            ? `<div class="state-meta"><span class="meta-chip" translate="no">path <strong>${escapeHtml(
                path,
              )}</strong></span></div>`
            : ''
        }
        ${detail ? `<pre class="state-detail">${escapeHtml(detail)}</pre>` : ''}
        ${
          error.extra?.outputSnippet
            ? `<pre class="state-detail">${escapeHtml(error.extra.outputSnippet)}</pre>`
            : ''
        }
        ${
          command
            ? `<div class="state-code"><code translate="no">${escapeHtml(command)}</code><button class="copy-button" type="button" data-action="copy" data-copy="${escapeAttribute(
                command,
              )}" data-copy-label="Command" aria-label="Copy command">${ICONS.copy}<span>Copy</span></button></div>`
            : ''
        }
        <div class="state-actions">
          <button class="btn btn-primary" type="button" data-action="${retryAction}">${ICONS.refresh}${
            context === 'settings' && isPermissionError(error) ? 'Recheck Permissions' : 'Try Again'
          }</button>
          ${
            context === 'report'
              ? `<button class="btn" type="button" data-href="/settings">${ICONS.settings}Open Settings</button>`
              : `<button class="btn" type="button" data-href="${state.lastDashboardHref ?? dashboardHref('all', 'daily', defaultRange('daily'))}">Back to Usage</button>`
          }
          <a class="btn btn-ghost" href="${escapeAttribute(
            docsUrl,
          )}" target="_blank" rel="noreferrer noopener">ccusage docs ${ICONS.external}</a>
        </div>
        <div class="state-meta">
          <span class="meta-chip">error <strong>${escapeHtml(error.code ?? 'UNKNOWN')}</strong></span>
          ${error.status ? `<span class="meta-chip">http <strong>${escapeHtml(String(error.status))}</strong></span>` : ''}
        </div>
      </div>
    </section>`;
}

function renderDashboardPage() {
  const route = state.route;
  const report = state.dashboard;
  let content = renderHero(route, report);

  if (state.loading && !report) {
    content += renderSkeleton();
  } else if (state.error && !report) {
    content += renderErrorState(state.error, { context: 'report' });
    content += renderFooter();
  } else if (report) {
    content += renderReport(report);
  }

  return buildShell(content, { routeName: 'dashboard' });
}

function renderNotfound() {
  const content = `
    <div class="not-found">
      <div class="not-found-inner">
        <div class="eyebrow"><span>Off the ledger</span></div>
        <h1>404, <em>nicely.</em></h1>
        <p>${escapeHtml(state.routeReason || 'That page isn’t part of Tokenly.')} The dashboard can still get you back to your numbers.</p>
        <button class="btn btn-primary" type="button" data-href="${dashboardHref('all', 'daily', defaultRange('daily'))}">Back to the Ledger ${ICONS.arrowUpRight}</button>
      </div>
    </div>`;
  return buildShell(content, { routeName: 'notfound' });
}

function settingsHero() {
  return `
    <section class="settings-hero" aria-labelledby="page-title">
      <div>
        <div class="eyebrow"><span>Local configuration</span><span class="eyebrow-sep"></span><span>ccusage pricing</span></div>
        <h1 id="page-title">Pricing, <em>by hand.</em></h1>
        <p>Edit the per-model rates that ccusage uses for its estimates. Values are shown in dollars per million tokens and saved in ccusage’s own config file in your home folder.</p>
      </div>
    </section>`;
}

function renderConfigRibbon() {
  const config = state.settings;
  if (!config) return '';
  return `
    <section class="config-ribbon" aria-label="ccusage config location">
      <div class="config-main">
        <span class="config-icon">${ICONS.file}</span>
        <div class="config-copy">
          <div class="config-label">ccusage config · written on save</div>
          <div class="config-path" translate="no" title="${escapeAttribute(config.path)}">${escapeHtml(
            config.displayPath,
          )}</div>
        </div>
      </div>
      <div class="config-badges">
        <span class="config-badge"><span class="badge-dot"></span>${
          config.exists ? 'File found' : 'New file on save'
        }</span>
        <span class="config-badge">${config.overrideCount} ${
          config.overrideCount === 1 ? 'override' : 'overrides'
        }</span>
        ${
          config.writable === false
            ? `<span class="config-badge config-badge--warn" title="Tokenly cannot create or replace files in this folder. Pricing cannot be saved until that is fixed."><span class="badge-dot"></span>Read-only folder</span>`
            : `<span class="config-badge" title="A copy of the previous config is written to ${escapeAttribute(
                config.backupPath || 'the backup path',
              )} on each save">backup ${escapeHtml(
                middleEllipsis(config.backupDisplayPath || 'on save', 28),
              )}</span>`
        }
      </div>
    </section>`;
}

function renderReadOnlyFolderNotes() {
  if (state.settings?.writable !== false) return '';
  const folder = state.settings.folderDisplayPath || 'the config folder';
  return `
    <div class="notice notice--error" role="alert" style="margin-top:18px">
      <span class="notice-icon" aria-hidden="true">!</span>
      <div class="notice-copy">
        <div class="notice-title">Pricing can’t be saved yet: the config folder is read-only.</div>
        <p class="notice-text">Tokenly can read <span translate="no">${escapeHtml(
          state.settings.displayPath,
        )}</span>, but Windows blocks creating or replacing files in <span translate="no">${escapeHtml(
          folder,
        )}</span> (EPERM). This usually comes from Controlled Folder Access or tightened folder permissions. Grant your account write access there, edit the file by hand, or start Tokenly with <span translate="no">TOKENLY_CONFIG_PATH</span> pointing at a writable copy.</p>
      </div>
    </div>`;
}

// Only saved overrides become suggestions: the row being edited already feeds its
// own keystrokes through this list, which would otherwise offer the half-typed
// query back as a model name.
function savedRowModels() {
  try {
    const rows = JSON.parse(state.settingsSnapshot);
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => String(row?.model ?? '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function modelSuggestionsList() {
  const values = new Set((state.catalog?.models ?? []).map((model) => model.modelName));
  for (const model of savedRowModels()) values.add(model);
  return [...values].sort((a, b) => a.localeCompare(b));
}

// The pricing table lives inside a horizontally scrollable region, so the
// suggestion list is portalled to <body> and placed against the input on
// every open instead of being clipped by the table's overflow.
const modelMenu = { input: null, options: [], active: -1, portal: null };

function modelMenuPortal() {
  if (modelMenu.portal?.isConnected) return modelMenu.portal;
  const portal = document.createElement('div');
  portal.className = 'model-menu';
  portal.hidden = true;
  portal.innerHTML =
    '<div class="model-listbox" id="model-listbox" role="listbox" aria-label="Model suggestions"></div><p class="model-menu-empty" hidden></p>';
  portal.addEventListener('pointerdown', (event) => {
    const option =
      event.target instanceof Element ? event.target.closest('[data-model-option]') : null;
    if (!option) return;
    // Keep the caret in the input so the list closes on a clean blur.
    event.preventDefault();
    chooseModelOption(option.dataset.modelOption ?? '');
  });
  portal.addEventListener('pointerover', (event) => {
    const option =
      event.target instanceof Element ? event.target.closest('[data-model-option]') : null;
    if (!option) return;
    setActiveModelOption(modelMenu.options.indexOf(option.dataset.modelOption ?? ''));
  });
  document.body.append(portal);
  modelMenu.portal = portal;
  return portal;
}

function isModelMenuOpen() {
  return Boolean(modelMenu.input) && Boolean(modelMenu.portal) && !modelMenu.portal.hidden;
}

function filteredModelSuggestions(query) {
  const all = modelSuggestionsList();
  const needle = query.trim().toLowerCase();
  if (!needle) return all;
  const starts = [];
  const contains = [];
  for (const value of all) {
    const lower = value.toLowerCase();
    if (lower.startsWith(needle)) starts.push(value);
    else if (lower.includes(needle)) contains.push(value);
  }
  return [...starts, ...contains];
}

function positionModelMenu() {
  const input = modelMenu.input;
  const portal = modelMenu.portal;
  if (!input || !portal) return;
  const margin = 8;
  const rect = input.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 240), window.innerWidth - margin * 2);
  portal.style.width = `${Math.round(width)}px`;
  portal.style.left = `${Math.round(
    Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin),
  )}px`;
  portal.style.maxHeight = '';
  const wanted = Math.min(portal.scrollHeight || 200, 268);
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const dropUp = spaceBelow < Math.min(wanted, 150) && spaceAbove > spaceBelow;
  portal.dataset.placement = dropUp ? 'up' : 'down';
  portal.style.top = dropUp ? 'auto' : `${Math.round(rect.bottom + 6)}px`;
  portal.style.bottom = dropUp ? `${Math.round(window.innerHeight - rect.top + 6)}px` : 'auto';
  portal.style.maxHeight = `${Math.round(
    Math.max(120, (dropUp ? spaceAbove : spaceBelow) - 6),
  )}px`;
}

function renderModelMenu() {
  const portal = modelMenuPortal();
  const list = portal.querySelector('#model-listbox');
  const empty = portal.querySelector('.model-menu-empty');
  const input = modelMenu.input;
  if (!input || !list || !empty) return;
  const query = input.value.trim();
  if (modelMenu.options.length) {
    list.innerHTML = modelMenu.options
      .map(
        (value, index) =>
          `<button class="model-option${
            index === modelMenu.active ? ' is-active' : ''
          }" type="button" role="option" id="model-option-${index}" data-model-option="${escapeAttribute(
            value,
          )}" aria-selected="${value === query}">${escapeHtml(value)}</button>`,
      )
      .join('');
    empty.hidden = true;
    empty.textContent = '';
  } else {
    list.innerHTML = '';
    empty.hidden = false;
    empty.textContent = `No model matches “${query}”. Type the exact label ccusage reports.`;
  }
  portal.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  if (modelMenu.active >= 0) {
    input.setAttribute('aria-activedescendant', `model-option-${modelMenu.active}`);
  } else {
    input.removeAttribute('aria-activedescendant');
  }
  positionModelMenu();
}

// Opening the list shows every known model and highlights the current value;
// only typing narrows it down.
function openModelMenu(input, { filter = '' } = {}) {
  if (!input) return;
  if (modelMenu.input && modelMenu.input !== input) closeModelMenu();
  modelMenu.input = input;
  modelMenu.options = filteredModelSuggestions(filter).slice(0, 80);
  const current = modelMenu.options.indexOf(input.value.trim());
  modelMenu.active = current;
  renderModelMenu();
  if (current >= 0) setActiveModelOption(current);
}

function closeModelMenu({ focusInput = false } = {}) {
  const input = modelMenu.input;
  if (modelMenu.portal) modelMenu.portal.hidden = true;
  modelMenu.input = null;
  modelMenu.options = [];
  modelMenu.active = -1;
  if (!input) return;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  if (focusInput) input.focus({ preventScroll: true });
}

function setActiveModelOption(index) {
  const portal = modelMenu.portal;
  const input = modelMenu.input;
  if (!portal || !input || !Number.isInteger(index)) return;
  if (index < 0 || index >= modelMenu.options.length) return;
  modelMenu.active = index;
  const options = portal.querySelectorAll('[data-model-option]');
  options.forEach((option, position) => {
    option.classList.toggle('is-active', position === index);
  });
  const active = options[index];
  if (!active) return;
  input.setAttribute('aria-activedescendant', active.id);
  active.scrollIntoView({ block: 'nearest' });
}

function moveActiveModelOption(delta) {
  const count = modelMenu.options.length;
  if (!count) return;
  const current = modelMenu.active;
  const next =
    current < 0 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count;
  setActiveModelOption(next);
}

function chooseModelOption(value) {
  const input = modelMenu.input;
  if (!input) return;
  input.value = value;
  closeModelMenu();
  // Reuse the regular input pipeline so validation, dirty state and the save
  // dock keep working exactly as they do for typed values.
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleModelFieldInput(event) {
  const input =
    event.target instanceof Element ? event.target.closest('[data-model-field]') : null;
  if (!input) return;
  if (!isModelMenuOpen() || modelMenu.input !== input) {
    openModelMenu(input, { filter: input.value });
    return;
  }
  modelMenu.options = filteredModelSuggestions(input.value).slice(0, 80);
  modelMenu.active = -1;
  renderModelMenu();
}

function handleModelFieldKeydown(event) {
  const input =
    event.target instanceof Element ? event.target.closest('[data-model-field]') : null;
  if (!input) return;
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      event.preventDefault();
      if (!isModelMenuOpen() || modelMenu.input !== input) {
        openModelMenu(input);
        if (event.key === 'ArrowUp') moveActiveModelOption(-1);
        return;
      }
      moveActiveModelOption(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    case 'Home':
    case 'End': {
      if (!isModelMenuOpen()) return;
      event.preventDefault();
      setActiveModelOption(event.key === 'Home' ? 0 : modelMenu.options.length - 1);
      return;
    }
    case 'Enter': {
      if (!isModelMenuOpen()) return;
      event.preventDefault();
      if (modelMenu.active >= 0) chooseModelOption(modelMenu.options[modelMenu.active]);
      else closeModelMenu();
      return;
    }
    case 'Escape': {
      if (!isModelMenuOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      closeModelMenu();
      return;
    }
    case 'Tab': {
      if (isModelMenuOpen()) closeModelMenu();
      return;
    }
    default:
  }
}

// ── Row reordering ──────────────────────────────────────────────────────
const rowDrag = {
  active: false,
  pointerId: null,
  startY: 0,
  from: -1,
  to: -1,
  row: null,
  metrics: [],
};

function reorderRows(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  if (from === to || from < 0 || to < 0) return false;
  if (from >= state.settingsRows.length || to >= state.settingsRows.length) return false;
  const [row] = state.settingsRows.splice(from, 1);
  state.settingsRows.splice(to, 0, row);
  state.formError = null;
  state.fieldErrors.clear();
  state.settingsDirty = serializableRows(state.settingsRows) !== state.settingsSnapshot;
  return true;
}

function announceReorder(index) {
  const status = document.getElementById('reorder-status');
  if (!status) return;
  const row = state.settingsRows[index];
  const label = row?.model?.trim() || `row ${index + 1}`;
  status.textContent = `Moved ${label} to position ${index + 1} of ${
    state.settingsRows.length
  }.`;
}

function focusDragHandle(index) {
  requestAnimationFrame(() => {
    const handle = document.querySelector(`[data-drag-row="${index}"]`);
    handle?.focus({ preventScroll: true });
    handle?.scrollIntoView({ block: 'nearest' });
  });
}

function beginRowDrag(handle, event) {
  const row = handle.closest('tr[data-row-index]');
  if (!row) return;
  const rows = [...document.querySelectorAll('.price-table tbody tr[data-row-index]')];
  const tableTop = rows[0]?.closest('table')?.getBoundingClientRect().top ?? 0;
  rowDrag.active = true;
  rowDrag.pointerId = event.pointerId;
  rowDrag.startY = event.clientY;
  rowDrag.from = Number(row.dataset.rowIndex);
  rowDrag.to = rowDrag.from;
  rowDrag.row = row;
  rowDrag.metrics = rows.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      element,
      index: Number(element.dataset.rowIndex),
      top: rect.top - tableTop,
      height: rect.height,
    };
  });
  row.classList.add('is-dragged');
  document.body.classList.add('is-row-dragging');
  handle.setPointerCapture?.(event.pointerId);
}

function moveRowDrag(event) {
  if (!rowDrag.active || event.pointerId !== rowDrag.pointerId) return;
  const delta = event.clientY - rowDrag.startY;
  rowDrag.row?.style.setProperty('--drag-y', `${delta}px`);
  const dragged = rowDrag.metrics.find((metric) => metric.index === rowDrag.from);
  if (!dragged) return;
  const centre = dragged.top + dragged.height / 2 + delta;
  let to = rowDrag.from;
  for (const metric of rowDrag.metrics) {
    if (metric.index === rowDrag.from) continue;
    const middle = metric.top + metric.height / 2;
    if (metric.index < rowDrag.from && centre < middle) to = Math.min(to, metric.index);
    if (metric.index > rowDrag.from && centre > middle) to = Math.max(to, metric.index);
  }
  rowDrag.to = to;
  for (const metric of rowDrag.metrics) {
    if (metric.index === rowDrag.from) continue;
    let shift = 0;
    if (rowDrag.from < to && metric.index > rowDrag.from && metric.index <= to) {
      shift = -dragged.height;
    } else if (rowDrag.from > to && metric.index >= to && metric.index < rowDrag.from) {
      shift = dragged.height;
    }
    metric.element.style.transform = shift ? `translateY(${shift}px)` : '';
    metric.element.classList.toggle('is-shifted', shift !== 0);
  }
}

function endRowDrag(event) {
  if (!rowDrag.active) return;
  if (event.pointerId !== undefined && event.pointerId !== rowDrag.pointerId) return;
  const { from, to } = rowDrag;
  rowDrag.active = false;
  rowDrag.pointerId = null;
  document.body.classList.remove('is-row-dragging');
  for (const metric of rowDrag.metrics) {
    metric.element.style.transform = '';
    metric.element.classList.remove('is-shifted');
  }
  rowDrag.row?.classList.remove('is-dragged');
  rowDrag.row?.style.removeProperty('--drag-y');
  rowDrag.metrics = [];
  rowDrag.row = null;
  if (from === to) return;
  if (!reorderRows(from, to)) return;
  renderApp();
  focusDragHandle(to);
  announceReorder(to);
}

function handleRowReorderKeydown(event) {
  const handle =
    event.target instanceof Element ? event.target.closest('[data-drag-row]') : null;
  if (!handle) return;
  const index = Number(handle.dataset.dragRow);
  if (!Number.isInteger(index)) return;
  const last = state.settingsRows.length - 1;
  let target = index;
  if (event.key === 'ArrowUp') target = index - 1;
  else if (event.key === 'ArrowDown') target = index + 1;
  else if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = last;
  else return;
  event.preventDefault();
  if (target < 0 || target > last || target === index) return;
  if (!reorderRows(index, target)) return;
  renderApp();
  focusDragHandle(target);
  announceReorder(target);
}

function handleDocumentPointerDown(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const handle = target.closest('[data-drag-row]');
  if (handle) {
    event.preventDefault();
    handle.focus({ preventScroll: true });
    beginRowDrag(handle, event);
    return;
  }
  if (
    isModelMenuOpen() &&
    !target.closest('.model-field') &&
    !target.closest('.model-menu')
  ) {
    closeModelMenu();
  }
}

function renderPricingTable() {
  if (!state.settingsRows.length) {
    return `
      <div class="pricing-empty">
        <div class="pricing-empty-title">No overrides yet.</div>
        <p>Your ccusage config is using its built-in prices. Add a model below when you need a different rate.</p>
        <button class="btn btn-sm" type="button" data-action="add-row" style="margin-top:14px">${ICONS.plus}Add a Model</button>
      </div>`;
  }

  return `
    <div class="price-editor-scroll" role="region" aria-label="Pricing overrides table">
      <table class="price-table">
        <caption class="sr-only">Model pricing overrides in US dollars per million tokens</caption>
        <thead>
          <tr>
            <th scope="col" class="drag-col"><span class="sr-only">Reorder</span></th>
            <th scope="col">Model</th>
            <th scope="col">Input $/1M</th>
            <th scope="col">Output $/1M</th>
            <th scope="col">Cache read $/1M</th>
            <th scope="col">Cache write $/1M</th>
            <th scope="col"><span class="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          ${state.settingsRows
            .map((row, index) => {
              const rowNumber = index + 1;
              const modelError = state.fieldErrors.has(`${index}:model`);
              const modelErrorId = `field-error-${index}-model`;
              return `
                <tr data-row-index="${index}">
                  <td class="drag-cell">
                    <button class="drag-handle" type="button" data-drag-row="${index}" aria-label="Reorder row ${rowNumber}" aria-describedby="reorder-hint">${ICONS.grip}</button>
                  </td>
                  <td class="model-cell">
                    <div class="model-field">
                      <input class="model-input ${modelError ? 'has-error' : ''}" type="text" name="model-${rowNumber}" value="${escapeAttribute(
                        row.model,
                      )}" placeholder="exact model label" spellcheck="false" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="model-listbox" data-model-field data-field="model" aria-label="Model name for row ${rowNumber}" aria-invalid="${modelError}" ${
                        modelError ? `aria-describedby="${modelErrorId}"` : ''
                      } />
                      <button class="model-field-toggle" type="button" tabindex="-1" data-action="toggle-model-menu" aria-label="Show model suggestions for row ${rowNumber}">${ICONS.chevronsUpDown}</button>
                    </div>
                    ${modelError ? `<span class="field-error" id="${modelErrorId}">Check this model name.</span>` : ''}
                    ${
                      row.hasAdvancedFields
                        ? `<div class="advanced-row"><span class="advanced-badge">preserved</span><span>Advanced ccusage fields stay hidden</span></div>`
                        : ''
                    }
                  </td>
                  ${[
                    ['inputCostPerMillion', 'Input'],
                    ['outputCostPerMillion', 'Output'],
                    ['cacheReadCostPerMillion', 'Cache read'],
                    ['cacheCreationCostPerMillion', 'Cache write'],
                  ]
                    .map(([field, label]) => {
                      const fieldError = state.fieldErrors.has(`${index}:${field}`);
                      const fieldErrorId = `field-error-${index}-${field}`;
                      return `<td>
                        <div class="price-input-wrap">
                          <span class="currency-prefix">$</span>
                          <input class="price-input ${fieldError ? 'has-error' : ''}" type="text" inputmode="decimal" name="${field}-${rowNumber}" value="${escapeAttribute(
                            row[field] ?? '',
                          )}" placeholder="—" spellcheck="false" autocomplete="off" data-price-field data-field="${field}" aria-label="${label} rate per million tokens for row ${rowNumber}" aria-invalid="${fieldError}" ${
                            fieldError ? `aria-describedby="${fieldErrorId}"` : ''
                          } />
                        </div>
                        ${fieldError ? `<span class="field-error" id="${fieldErrorId}">Check this rate.</span>` : ''}
                      </td>`;
                    })
                    .join('')}
                  <td>
                    <button class="row-remove" type="button" data-action="remove-row" data-index="${index}" aria-label="Remove pricing row ${rowNumber}">${ICONS.trash}</button>
                  </td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="scroll-hint scroll-hint-block">Swipe the table sideways for all rates.</p>
    <p class="sr-only" id="reorder-hint">Press the up or down arrow keys to move this row.</p>
    <p class="sr-only" role="status" aria-live="polite" id="reorder-status"></p>
    <div class="pricing-help">
      ${ICONS.info}
      <p>Rates are displayed per <strong>1,000,000 tokens</strong>; ccusage stores them per token. Clearing a field removes that part of the override. Existing advanced tier or multiplier fields are preserved unless you delete the row.</p>
    </div>`;
}

function formErrorMessage() {
  if (!state.formError) return '';
  return `<div class="form-error" id="settings-form-error" role="alert">${ICONS.alert}<div><strong>${escapeHtml(
    state.formError.message,
  )}</strong>${state.formError.hint ? `<div>${escapeHtml(state.formError.hint)}</div>` : ''}</div></div>`;
}

function saveStatusText() {
  if (state.settingsSaving) return '<span data-save-status-text>Writing config…</span>';
  if (state.settingsDirty) return '<span data-save-status-text>Unsaved changes</span>';
  if (state.lastSavedAt) {
    return `<span data-save-status-text>Saved ${relativeTime(
      state.lastSavedAt,
    )} · dashboard ready</span>`;
  }
  return '<span data-save-status-text>No unsaved changes</span>';
}

function renderSaveDock() {
  const disabled = !state.settingsDirty || state.settingsSaving || Boolean(state.settingsError);
  return `
    <div class="save-dock" data-dirty="${state.settingsDirty ? 'true' : 'false'}">
      <div class="save-status" data-save-status data-dirty="${
        state.settingsDirty ? 'true' : 'false'
      }" role="status" aria-live="polite"><span class="status-mark"></span>${saveStatusText()}</div>
      <div class="save-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-href="${
          state.lastDashboardHref ?? dashboardHref('all', 'daily', defaultRange('daily'))
        }">Dashboard ${ICONS.arrowUpRight}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="discard-settings" ${
          disabled ? 'disabled' : ''
        }>Discard</button>
        <button class="btn btn-acid btn-sm" id="save-settings" type="button" data-action="save-settings" ${
          disabled ? 'disabled' : ''
        }>${ICONS.check}Save Pricing</button>
      </div>
    </div>`;
}

function renderCatalogPanel() {
  const catalog = state.catalog;
  let listMarkup = '';
  if (state.catalogError) {
    listMarkup = `
      <div class="catalog-error">
        <strong>Couldn’t read models from ccusage.</strong>
        ${escapeHtml(state.catalogError.message)}
        ${state.catalogError.hint ? `<div>${escapeHtml(state.catalogError.hint)}</div>` : ''}
      </div>`;
  } else if (!catalog) {
    listMarkup = `<div class="catalog-loading" role="status">
      <span class="sr-only">Loading models…</span>
      <div class="skeleton-block catalog-skeleton"></div>
      <div class="skeleton-block catalog-skeleton"></div>
      <div class="skeleton-block catalog-skeleton"></div>
    </div>`;
  } else if (!catalog.models?.length) {
    listMarkup = `<div class="empty-table" style="padding:36px 24px 40px"><strong>No models found.</strong><p>ccusage saw no model usage in the last 90 days.</p></div>`;
  } else {
    const sorted = [...catalog.models].sort(
      (a, b) =>
        Number(b.missingPricing) - Number(a.missingPricing) || b.totalTokens - a.totalTokens,
    );
    listMarkup = `<div class="catalog-list">
      ${sorted
        .map((model) => {
          const added = state.settingsRows.some((row) => row.model.trim() === model.modelName);
          return `
            <div class="catalog-row">
              <div class="catalog-copy">
                <div class="catalog-name">
                  <span translate="no" title="${escapeAttribute(model.modelName)}">${escapeHtml(model.modelName)}</span>
                  ${model.missingPricing ? '<span class="unpriced-badge">Unpriced</span>' : ''}
                </div>
                <div class="catalog-meta">
                  <span>${formatCompactNumber(model.totalTokens)} tokens</span>
                  <span>·</span>
                  <span>${formatMoney(model.totalCost, { precise: true })}</span>
                </div>
              </div>
              <button class="catalog-add" type="button" data-action="add-catalog-model" data-model="${escapeAttribute(
                model.modelName,
              )}" ${added ? 'disabled' : ''}>${added ? 'Added' : 'Price'}</button>
            </div>`;
        })
        .join('')}
    </div>`;
  }

  const unpriced = catalog?.models?.filter((model) => model.missingPricing).length ?? 0;
  return `
    <aside class="panel catalog-panel" aria-labelledby="catalog-title">
      <div class="panel-header">
        <div class="panel-heading">
          <div class="panel-kicker">Seen in ccusage</div>
          <h2 class="panel-title" id="catalog-title">Models on this machine</h2>
          <p class="panel-subtitle">Observed in the last 90 days. Add one to price it.</p>
        </div>
        <span class="override-count">${catalog?.models?.length ?? 0}</span>
      </div>
      ${listMarkup}
      <div class="catalog-footer">
        ${ICONS.info}
        <p>${unpriced ? `<strong>${unpriced} unpriced ${unpriced === 1 ? 'model' : 'models'}.</strong> ` : ''}Overrides match ccusage’s exact model label; built-in prices stay in effect for everything else.</p>
      </div>
    </aside>`;
}

function renderSettingsPage() {
  let content = settingsHero();

  if (state.settingsLoading) {
    content += `
      <div class="settings-skeleton" aria-busy="true" aria-live="polite">
        <div class="config-ribbon skeleton-block" style="height:68px"></div>
        <div class="settings-skeleton-grid">
          <div class="skeleton-block skeleton-panel"></div>
          <div class="skeleton-block skeleton-panel"></div>
        </div>
      </div>`;
    return buildShell(content, { pageClass: 'is-settings', routeName: 'settings' });
  }

  if (state.settingsError) {
    content += renderErrorState(state.settingsError, { context: 'settings' });
    content += renderFooter();
    return buildShell(content, { pageClass: 'is-settings', routeName: 'settings' });
  }

  if (!state.settings) {
    content += renderSkeleton();
    return buildShell(content, { pageClass: 'is-settings', routeName: 'settings' });
  }

  content += renderConfigRibbon();
  content += renderReadOnlyFolderNotes();
  content += `
    <div class="settings-grid">
      <article class="panel pricing-panel" aria-labelledby="pricing-title">
        <div class="panel-header">
          <div class="panel-heading">
            <div class="panel-kicker">Overrides</div>
            <div class="pricing-heading-row">
              <h2 class="panel-title" id="pricing-title">Model pricing</h2>
              <span class="override-count">${state.settingsRows.length}</span>
            </div>
            <p class="panel-subtitle">Leave a rate blank to keep it unspecified. Rates apply to exact model labels.</p>
          </div>
          <div class="panel-tools">
            <button class="btn btn-sm" type="button" data-action="add-row">${ICONS.plus}Add Model</button>
          </div>
        </div>
        ${renderPricingTable()}
        ${formErrorMessage()}
      </article>
      ${renderCatalogPanel()}
    </div>
    ${renderSaveDock()}
    ${renderFooter()}`;

  return buildShell(content, { pageClass: 'is-settings', routeName: 'settings' });
}

function renderFatal(error) {
  return `
    <main class="not-found" id="main-content">
      <div class="not-found-inner">
        <div class="eyebrow"><span>Local server</span></div>
        <h1>No <em>signal.</em></h1>
        <p>${escapeHtml(error?.message || 'Tokenly could not reach its local server.')}</p>
        <p style="margin-top:10px;font-size:11px">${escapeHtml(
          error?.hint || 'Check the terminal running Tokenly, then reload this page.',
        )}</p>
        <button class="btn btn-primary" type="button" data-action="reload-app">Reload Page</button>
      </div>
    </main>`;
}

function renderApp({ focusHeading = false } = {}) {
  const app = qs('#app');
  if (!app) return;
  closeModelMenu();

  let html;
  let title;
  if (state.route?.name === 'settings') {
    html = renderSettingsPage();
    title = 'Pricing settings — Tokenly';
  } else if (state.route?.name === 'notfound') {
    html = renderNotfound();
    title = 'Not found — Tokenly';
  } else {
    html = renderDashboardPage();
    title =
      state.route?.name === 'dashboard'
        ? `${state.route.report === 'daily' ? 'Daily' : 'Monthly'} usage · ${agentLabel(
            state.route.agent,
          )} — Tokenly`
        : 'Tokenly — local token ledger';
  }

  app.innerHTML = html;
  document.title = title;
  updateRefreshButton();
  scheduleMountChart();
  observeLedger();
  if (focusHeading) {
    requestAnimationFrame(() => qs('#page-title')?.focus({ preventScroll: true }));
  }
}

function updateRefreshButton() {
  const button = qs('[data-action="refresh"]');
  if (!button) return;
  button.classList.toggle('is-loading', state.loading);
  button.disabled = state.loading;
}

function scheduleMountChart() {
  // Measure synchronously: background tabs can throttle requestAnimationFrame,
  // and a chart should not wait for a tab to become visible to render.
  mountChart();
  observeChart();
  requestAnimationFrame(() => {
    mountChart();
  });
}

function observeChart() {
  chartObserver?.disconnect();
  chartObserver = null;
  const mount = qs('[data-chart-mount]');
  if (!mount || typeof ResizeObserver === 'undefined') return;
  chartObserver = new ResizeObserver(() => {
    mountChart();
  });
  chartObserver.observe(mount);
}

/**
 * The totals row lives outside the scrollport so neither scrollbar can cross
 * it. Mirror the body table's column widths and horizontal scroll onto it.
 */
function syncLedgerFooter() {
  const scroll = qs('[data-ledger-scroll]');
  const body = qs('[data-ledger-body]');
  const foot = qs('[data-ledger-foot]');
  if (!scroll || !body || !foot) return;
  const footTable = foot.querySelector('table');
  const bodyColumns = [...body.querySelectorAll('colgroup col')];
  const footColumns = [...(footTable?.querySelectorAll('colgroup col') ?? [])];
  const headCells = [...(body.tHead?.rows[0]?.cells ?? [])];
  const footCells = [...(footTable?.querySelectorAll('tbody tr:first-child > *') ?? [])];
  if (!footTable || headCells.length === 0) return;

  // Measure both tables content-sized, then lock them to identical columns so
  // the totals row sits exactly under the data.
  body.style.tableLayout = 'auto';
  body.style.width = '100%';
  footTable.style.tableLayout = 'auto';
  footTable.style.width = 'max-content';

  const bodyWidths = headCells.map((cell) => cell.getBoundingClientRect().width);
  const footWidths = footCells.map((cell) => cell.getBoundingClientRect().width);
  const widths = bodyWidths.map((width, index) => Math.max(width, footWidths[index] ?? 0));

  const available = scroll.clientWidth;
  const measured = widths.reduce((sum, width) => sum + width, 0);
  if (measured < available) widths[0] += available - measured;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  body.style.tableLayout = 'fixed';
  body.style.width = `${tableWidth}px`;
  footTable.style.tableLayout = 'fixed';
  footTable.style.width = `${tableWidth}px`;
  widths.forEach((width, index) => {
    if (bodyColumns[index]) bodyColumns[index].style.width = `${width}px`;
    if (footColumns[index]) footColumns[index].style.width = `${width}px`;
  });
  foot.scrollLeft = scroll.scrollLeft;
}

function observeLedger() {
  ledgerObserver?.disconnect();
  ledgerObserver = null;
  syncLedgerFooter();
  if (document.fonts?.status === 'loading') {
    document.fonts.ready.then(() => syncLedgerFooter());
  }
  const body = qs('[data-ledger-body]');
  if (!body || typeof ResizeObserver === 'undefined') return;
  ledgerObserver = new ResizeObserver(() => syncLedgerFooter());
  ledgerObserver.observe(qs('.table-frame') ?? body);
}

function chartLimit(report) {
  return report.report === 'daily' ? 60 : 36;
}

function mountChart() {
  if (state.route?.name !== 'dashboard' || !state.dashboard) return;
  const mount = qs('[data-chart-mount]');
  const shell = qs('#chart-shell');
  if (!mount || !shell) return;

  const width = Math.floor(mount.getBoundingClientRect().width);
  if (width < 120) {
    window.setTimeout(() => mountChart(), 80);
    return;
  }
  if (mount.dataset.lastWidth === String(width) && mount.dataset.lastMetric === state.chartMetric) {
    return;
  }

  const report = state.dashboard;
  const rows = report.rows.slice(-chartLimit(report));
  state.chartRowsByPeriod = new Map(rows.map((row) => [row.period, row]));
  const minHeight = chartHeightForWidth(width);
  mount.style.minHeight = `${minHeight}px`;
  mount.innerHTML = renderChart({
    rows,
    report: report.report,
    metric: state.chartMetric,
    width,
  });
  mount.dataset.lastWidth = String(width);
  mount.dataset.lastMetric = state.chartMetric;
  shell.onpointerleave = hideChartTooltip;
}

function hideChartTooltip() {
  const tooltip = qs('#chart-tooltip');
  if (tooltip) {
    tooltip.dataset.visible = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('.bar-group.is-active').forEach((group) => {
    group.classList.remove('is-active');
  });
}

function tooltipHtml(row, report) {
  const label = periodLabel(row.period, report);
  return `
    <div class="tooltip-date">${escapeHtml(label.full)}</div>
    <div class="tooltip-row"><span>Total tokens</span><strong>${formatNumber(
      row.totalTokens,
    )}</strong></div>
    <div class="tooltip-row"><span>Estimated cost</span><strong>${formatMoney(row.totalCost, {
      precise: true,
    })}</strong></div>
    <div class="tooltip-rule"></div>
    ${TOKEN_SERIES.map(
      (series) => `<div class="tooltip-row"><span>${escapeHtml(series.label)}</span><strong>${formatNumber(
        row[series.key],
      )}</strong></div>`,
    ).join('')}`;
}

function positionChartTooltip(group, source) {
  const shell = group.closest('.chart-shell');
  const tooltip = qs('#chart-tooltip');
  if (!shell || !tooltip) return;
  const row = state.chartRowsByPeriod.get(group.dataset.chartPeriod);
  if (!row) return;
  const groupRect = group.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  let x;
  let y;
  if (source?.clientX !== undefined) {
    x = source.clientX - shellRect.left + 14;
    y = source.clientY - shellRect.top + 14;
  } else {
    x = groupRect.left - shellRect.left + groupRect.width / 2;
    y = groupRect.top - shellRect.top + 10;
  }

  tooltip.innerHTML = tooltipHtml(row, state.dashboard.report);
  tooltip.dataset.visible = 'true';
  tooltip.setAttribute('aria-hidden', 'false');
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const maxX = shellRect.width - tooltipWidth - 8;
  const maxY = shellRect.height - tooltipHeight - 8;
  let left = x;
  let top = y - tooltipHeight - 12;
  if (source?.clientX !== undefined) {
    if (left > maxX) left = x - tooltipWidth - 28;
    if (top < 0) top = y + 18;
  } else if (groupRect.width < 1) {
    top = 0;
  }
  tooltip.style.left = `${clamp(left, 8, Math.max(8, maxX))}px`;
  tooltip.style.top = `${clamp(top, 4, Math.max(4, maxY))}px`;
  document.querySelectorAll('.bar-group.is-active').forEach((element) => {
    element.classList.remove('is-active');
  });
  group.classList.add('is-active');
}

function handleChartPointer(event) {
  if (state.route?.name !== 'dashboard') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const group = target.closest('[data-chart-period]');
  if (!group) {
    hideChartTooltip();
    return;
  }
  positionChartTooltip(group, event);
}

function handleChartFocus(event) {
  const target = event.target instanceof Element ? event.target : null;
  const group = target?.closest('[data-chart-period]');
  if (!group) return;
  positionChartTooltip(group, null);
}

function handleChartBlur(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-chart-period]')) hideChartTooltip();
}

function showToast(message, tone = 'success', timeout = 4200) {
  const region = qs('#toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.tone = tone;
  toast.dataset.toastId = String(++toastSequence);
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.innerHTML = `<span class="toast-icon">${
    tone === 'error' ? ICONS.alert : ICONS.check
  }</span><span class="toast-message"></span><button class="toast-close" type="button" aria-label="Dismiss notification">${ICONS.x}</button>`;
  toast.querySelector('.toast-message').textContent = message;
  region.append(toast);
  const dismiss = () => {
    if (!toast.isConnected) return;
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 180);
  };
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  if (timeout > 0) window.setTimeout(dismiss, timeout);
}

async function copyText(value, label = 'Value') {
  const text = String(value ?? '');
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API unavailable');
    }
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch {
      textarea.remove();
      showToast('Couldn’t copy automatically. Select the text and copy it.', 'error');
      return;
    }
    textarea.remove();
  }
  showToast(`${label} copied to clipboard.`);
}

function updateFreshness() {
  const element = qs('[data-freshness]');
  if (!element || !state.dashboard) return;
  const generated = state.dashboard.meta.generatedAt;
  element.innerHTML = `<span class="freshness-dot"></span><span data-freshness-text>Updated ${relativeTime(
    generated,
  )}</span>`;
  element.title = `Report generated ${formatDateTime(generated)}`;
}

function showSettingsFormError(message, hint = null) {
  state.formError = { message, hint };
  const existing = qs('#settings-form-error');
  if (existing) {
    existing.hidden = false;
    existing.innerHTML = `${ICONS.alert}<div><strong>${escapeHtml(message)}</strong>${
      hint ? `<div>${escapeHtml(hint)}</div>` : ''
    }</div>`;
  } else {
    const table = qs('.price-table') ?? qs('.pricing-empty');
    if (table) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = formErrorMessage();
      table.closest('.pricing-panel')?.insertBefore(wrapper.firstElementChild, qs('.pricing-help'));
    }
  }
}

function clearSettingsFormError() {
  state.formError = null;
  state.fieldErrors.clear();
  const existing = qs('#settings-form-error');
  if (existing) existing.hidden = true;
  document.querySelectorAll('.has-error').forEach((element) => element.classList.remove('has-error'));
}

function updateSaveDock() {
  const dock = qs('.save-dock');
  if (!dock) return;
  dock.dataset.dirty = state.settingsDirty ? 'true' : 'false';
  const status = qs('[data-save-status]');
  if (status) {
    status.dataset.dirty = state.settingsDirty ? 'true' : 'false';
    status.innerHTML = `<span class="status-mark"></span>${saveStatusText()}`;
  }
  const save = qs('#save-settings');
  if (save) save.disabled = !state.settingsDirty || state.settingsSaving;
  const discard = qs('[data-action="discard-settings"]');
  if (discard) discard.disabled = !state.settingsDirty || state.settingsSaving;
}

function markSettingsDirty() {
  state.settingsDirty = serializableRows(state.settingsRows) !== state.settingsSnapshot;
  updateSaveDock();
}

async function loadReport({ force = false, silent = false, notify = false } = {}) {
  if (state.route?.name !== 'dashboard') return;
  const route = state.route;
  const seq = ++state.reportSeq;
  state.reportAbort?.abort();
  const controller = new AbortController();
  state.reportAbort = controller;
  state.loading = true;
  state.error = null;

  if (!silent || !state.dashboard) {
    renderApp();
  } else {
    updateRefreshButton();
  }

  const params = new URLSearchParams({
    report: route.report,
    agent: route.agent,
    range: route.range,
  });
  if (force) params.set('refresh', '1');

  try {
    const data = await apiFetch(`/api/report?${params.toString()}`, {
      signal: controller.signal,
    });
    if (seq !== state.reportSeq || state.route?.name !== 'dashboard') return;
    state.dashboard = data;
    state.loading = false;
    state.error = null;
    state.knownVersion = data.meta.version ?? state.knownVersion;
    rememberDashboard(route);
    if (!isRangeFor(route.report, route.range)) {
      route.range = defaultRange(route.report);
    }
    renderApp();
    if (notify) showToast('Report refreshed from ccusage.');
    if (state.pendingPricingRefresh) {
      state.pendingPricingRefresh = false;
      loadReport({ force: true, silent: true });
    }
  } catch (error) {
    if (error?.name === 'AbortError' || seq !== state.reportSeq) return;
    if (state.route?.name !== 'dashboard') return;
    state.loading = false;
    if (state.dashboard) {
      updateRefreshButton();
      showToast(error.message || 'Refresh failed. The previous report is still shown.', 'error');
    } else {
      state.error = error;
      renderApp();
    }
  }
}

async function loadSettings({ focusAfter = false } = {}) {
  if (state.route?.name !== 'settings') return;
  const seq = ++state.settingsSeq;
  state.settingsLoading = true;
  state.settingsError = null;
  state.settings = null;
  state.settingsRows = [];
  state.settingsSnapshot = '[]';
  state.settingsDirty = false;
  state.settingsSaving = false;
  state.formError = null;
  state.fieldErrors = new Set();
  state.catalog = null;
  state.catalogError = null;
  state.lastSavedAt = null;
  renderApp();

  const [settingsResult, catalogResult] = await Promise.allSettled([
    apiFetch('/api/settings'),
    apiFetch('/api/models'),
  ]);
  if (seq !== state.settingsSeq || state.route?.name !== 'settings') return;

  state.settingsLoading = false;
  if (settingsResult.status === 'fulfilled') {
    state.settings = settingsResult.value.config;
    state.settingsRows = rowsFromConfig(state.settings);
    state.settingsSnapshot = serializableRows(state.settingsRows);
    state.settingsDirty = false;
  } else {
    state.settingsError = settingsResult.reason;
  }
  if (catalogResult.status === 'fulfilled') {
    state.catalog = catalogResult.value;
    state.catalogError = null;
  } else {
    state.catalog = null;
    state.catalogError = catalogResult.reason;
  }
  renderApp();
  if (focusAfter) {
    requestAnimationFrame(() => qs('#page-title')?.focus({ preventScroll: true }));
  }
}

async function reloadSettingsQuietly() {
  if (state.route?.name !== 'settings' || state.settingsDirty || state.settingsSaving) return;
  try {
    const [settingsResult, catalogResult] = await Promise.allSettled([
      apiFetch('/api/settings'),
      apiFetch('/api/models?refresh=1'),
    ]);
    if (state.route?.name !== 'settings' || state.settingsDirty) return;
    if (settingsResult.status === 'fulfilled') {
      state.settings = settingsResult.value.config;
      state.settingsRows = rowsFromConfig(state.settings);
      state.settingsSnapshot = serializableRows(state.settingsRows);
      state.settingsError = null;
      state.settingsDirty = false;
    } else {
      state.settingsError = settingsResult.reason;
    }
    if (catalogResult.status === 'fulfilled') {
      state.catalog = catalogResult.value;
      state.catalogError = null;
    } else {
      state.catalogError = catalogResult.reason;
    }
    renderApp();
    showToast('Pricing changed in another tab. Settings refreshed.');
  } catch (error) {
    showToast(error.message || 'Could not refresh settings.', 'error');
  }
}

async function refreshCatalogAfterSave() {
  try {
    const data = await apiFetch('/api/models?refresh=1');
    if (state.route?.name !== 'settings' || state.settingsDirty) return;
    state.catalog = data;
    state.catalogError = null;
    const panel = qs('.catalog-panel');
    if (panel) panel.outerHTML = renderCatalogPanel();
  } catch (error) {
    state.catalogError = error;
    const panel = qs('.catalog-panel');
    if (panel) panel.outerHTML = renderCatalogPanel();
  }
}

function validateSettingsRows() {
  state.fieldErrors = new Set();
  const cleaned = [];
  const seen = new Set();
  const rows = state.settingsRows;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const model = String(row.model ?? '').trim();
    const priceStrings = {
      inputCostPerMillion: String(row.inputCostPerMillion ?? '').trim(),
      outputCostPerMillion: String(row.outputCostPerMillion ?? '').trim(),
      cacheReadCostPerMillion: String(row.cacheReadCostPerMillion ?? '').trim(),
      cacheCreationCostPerMillion: String(row.cacheCreationCostPerMillion ?? '').trim(),
    };
    const hasAnyPrice = Object.values(priceStrings).some(Boolean);

    if (!model) {
      state.fieldErrors.add(`${index}:model`);
      return {
        message: hasAnyPrice
          ? `Name the model in row ${index + 1}.`
          : `Row ${index + 1} is empty.`,
        hint: hasAnyPrice
          ? 'Use the exact model label reported by ccusage.'
          : 'Fill in a model and at least one rate, or remove the row.',
        focus: { index, field: 'model' },
      };
    }
    if (seen.has(model)) {
      state.fieldErrors.add(`${index}:model`);
      return {
        message: `“${model}” appears more than once.`,
        hint: 'Each model can have one override row.',
        focus: { index, field: 'model' },
      };
    }
    seen.add(model);

    const prices = {};
    for (const field of [
      'inputCostPerMillion',
      'outputCostPerMillion',
      'cacheReadCostPerMillion',
      'cacheCreationCostPerMillion',
    ]) {
      const raw = priceStrings[field].replace(/[$,]/g, '');
      if (!raw) {
        prices[field] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        state.fieldErrors.add(`${index}:${field}`);
        return {
          message: `The ${field
            .replace('CostPerMillion', '')
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim()} rate for “${model}” isn’t a number.`,
          hint: 'Use a plain decimal such as 3, 0.75, or 0.00025.',
          focus: { index, field },
        };
      }
      if (value < 0) {
        state.fieldErrors.add(`${index}:${field}`);
        return {
          message: `Rates can’t be negative.`,
          hint: `Check “${model}”.`,
          focus: { index, field },
        };
      }
      prices[field] = value;
    }

    const hasAnyStoredPrice = Object.values(prices).some((value) => value !== null);
    if (!hasAnyStoredPrice && !row.hasAdvancedFields) {
      state.fieldErrors.add(`${index}:inputCostPerMillion`);
      return {
        message: `Add at least one rate for “${model}”, or remove the row.`,
        hint: 'An empty row would not change ccusage pricing.',
        focus: { index, field: 'inputCostPerMillion' },
      };
    }

    cleaned.push({ model, ...prices });
  }

  return { models: cleaned };
}

function focusInvalidField(focus) {
  if (!focus) return;
  requestAnimationFrame(() => {
    const input = qs(
      `[data-row-index="${focus.index}"] [data-field="${focus.field}"]`,
    );
    input?.focus();
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

async function saveSettings() {
  if (state.settingsSaving) return;
  clearSettingsFormError();
  const validation = validateSettingsRows();
  if (validation.message) {
    state.formError = { message: validation.message, hint: validation.hint };
    renderApp();
    showSettingsFormError(validation.message, validation.hint);
    focusInvalidField(validation.focus);
    return;
  }

  state.settingsSaving = true;
  state.formError = null;
  state.suppressPricingEventsUntil = Date.now() + 2500;
  updateSaveDock();
  const dockStatus = qs('[data-save-status]');
  if (dockStatus) {
    dockStatus.innerHTML = `<span class="status-mark"></span><span data-save-status-text>Writing config…</span>`;
  }
  const saveButton = qs('#save-settings');
  if (saveButton) saveButton.disabled = true;

  try {
    const result = await apiFetch('/api/settings', {
      method: 'PUT',
      body: { models: validation.models },
    });
    state.settings = result.config;
    state.settingsRows = rowsFromConfig(result.config);
    state.settingsSnapshot = serializableRows(state.settingsRows);
    state.settingsDirty = false;
    state.settingsSaving = false;
    state.settingsError = null;
    state.lastSavedAt = result.savedAt;
    state.fieldErrors.clear();
    state.formError = null;
    renderApp();
    if (result.backupUnavailable) {
      showToast(
        'Pricing saved, but no backup copy could be written. Consider saving one by hand.',
        'error',
        7000,
      );
    } else {
      showToast('Pricing saved. Dashboard data is now using the new rates.');
    }
    refreshCatalogAfterSave();
  } catch (error) {
    state.settingsSaving = false;
    state.formError = {
      message: error.message || 'The pricing changes could not be saved.',
      hint: error.detail || error.hint || null,
    };
    updateSaveDock();
    showSettingsFormError(state.formError.message, state.formError.hint);
    showToast(error.message || 'The pricing changes could not be saved.', 'error');
  }
}

function addSettingsRow(model = '') {
  state.settingsRows.push({
    model,
    inputCostPerMillion: '',
    outputCostPerMillion: '',
    cacheReadCostPerMillion: '',
    cacheCreationCostPerMillion: '',
    hasAdvancedFields: false,
  });
  state.formError = null;
  state.fieldErrors.clear();
  state.settingsDirty = true;
  renderApp();
  requestAnimationFrame(() => {
    const inputs = document.querySelectorAll('[data-model-field]');
    const target = inputs[inputs.length - 1];
    target?.focus();
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function removeSettingsRow(index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.settingsRows.length) return;
  state.settingsRows.splice(index, 1);
  state.formError = null;
  state.fieldErrors.clear();
  state.settingsDirty = serializableRows(state.settingsRows) !== state.settingsSnapshot;
  renderApp();
}

function discardSettings() {
  state.settingsRows = rowsFromConfig(state.settings);
  state.settingsSnapshot = serializableRows(state.settingsRows);
  state.settingsDirty = false;
  state.formError = null;
  state.fieldErrors.clear();
  renderApp();
  showToast('Unsaved pricing changes discarded.');
}

function addCatalogModel(modelName) {
  if (!modelName) return;
  if (state.settingsRows.some((row) => row.model.trim() === modelName)) {
    showToast('That model already has a pricing row.');
    return;
  }
  addSettingsRow(modelName);
}

function applyRoute(route, { replace = false, focusHeading = false } = {}) {
  const href =
    route.name === 'settings'
      ? '/settings'
      : route.name === 'dashboard'
        ? routeHref(route)
        : null;
  if (href) {
    if (replace) history.replaceState(null, '', href);
    else history.pushState(null, '', href);
  }

  state.route = route;
  state.routeReason = route.reason ?? null;
  state.reportAbort?.abort();
  state.reportSeq += 1;
  state.settingsSeq += 1;
  state.loading = false;
  state.pendingPricingRefresh = false;
  state.error = null;
  state.settingsError = null;
  state.formError = null;
  state.fieldErrors.clear();

  if (route.name === 'dashboard') {
    state.dashboard = null;
    rememberDashboard(route);
    renderApp({ focusHeading });
    window.scrollTo({ top: 0, behavior: 'auto' });
    loadReport();
  } else if (route.name === 'settings') {
    state.dashboard = null;
    renderApp({ focusHeading });
    window.scrollTo({ top: 0, behavior: 'auto' });
    loadSettings();
  } else {
    state.dashboard = null;
    renderApp({ focusHeading });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function hasUnsavedSettings() {
  return state.route?.name === 'settings' && state.settingsDirty && !state.settingsSaving;
}

// A themed stand-in for window.confirm. <dialog> hands us focus trapping,
// Escape handling and a real backdrop without re-implementing any of it.
let openDialog = null;

function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
}) {
  if (openDialog) return Promise.resolve(false);

  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
  dialog.setAttribute('aria-describedby', 'confirm-dialog-message');
  dialog.innerHTML = `<div class="confirm-card">
      <span class="confirm-icon" aria-hidden="true">${ICONS.alert}</span>
      <h2 class="confirm-title" id="confirm-dialog-title">${escapeHtml(title)}</h2>
      <p class="confirm-message" id="confirm-dialog-message">${escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-confirm="cancel">${escapeHtml(
          cancelLabel,
        )}</button>
        <button class="btn btn-sm ${
          tone === 'danger' ? 'btn-danger' : 'btn-acid'
        }" type="button" data-confirm="accept">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`;

  const previous = document.activeElement;
  let settle;
  const answer = new Promise((resolve) => {
    settle = resolve;
  });

  const close = (result) => {
    if (!dialog.isConnected) return;
    if (dialog.open) dialog.close();
    dialog.remove();
    openDialog = null;
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    settle(result);
  };

  dialog.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-confirm]') : null;

    if (button) {
      close(button.dataset.confirm === 'accept');
      return;
    }
    if (event.target === dialog) close(false);
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(false);
  });

  document.body.append(dialog);
  openDialog = dialog;
  dialog.showModal();
  const focusTarget = dialog.querySelector(
    tone === 'danger' ? '[data-confirm="cancel"]' : '[data-confirm="accept"]',
  );
  focusTarget?.focus({ preventScroll: true });

  return answer;
}

async function confirmDiscardSettings() {
  return confirmDialog({
    title: 'Discard unsaved pricing?',
    message:
      'You have unsaved pricing changes. Leaving this page throws them away.',
    confirmLabel: 'Discard and leave',
    cancelLabel: 'Keep editing',
  });
}

async function navigate(href, { replace = false } = {}) {
  let url;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return;
  }
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return;
  }
  if (
    hasUnsavedSettings() &&
    url.pathname !== '/settings' &&
    !(await confirmDiscardSettings())
  ) {
    return;
  }
  if (url.pathname === '/settings') {
    applyRoute({ name: 'settings' }, { replace, focusHeading: true });
    return;
  }
  const route = parseHref(url.pathname + url.search);
  if (!route) {
    applyRoute(
      { name: 'notfound', reason: 'That dashboard view doesn’t exist.' },
      { replace, focusHeading: true },
    );
    return;
  }
  applyRoute(route, { replace, focusHeading: true });
}

async function boot() {
  try {
    state.boot = await apiFetch('/api/bootstrap');
  } catch (error) {
    state.bootError = error;
    qs('#app').innerHTML = renderFatal(error);
    return;
  }

  const restored = restoreLastDashboard();
  if (restored) state.lastDashboardHref = routeHref(restored);

  const route = parseRoute();
  if (route.name === 'dashboard') {
    state.lastDashboardHref = routeHref(route);
    try {
      sessionStorage.setItem('tokenly:lastDashboard', state.lastDashboardHref);
    } catch {
      // Optional.
    }
  }

  state.route = route;
  state.routeReason = route.reason ?? null;

  if (route.name === 'dashboard') {
    state.loading = true;
    renderApp();
    loadReport();
  } else if (route.name === 'settings') {
    renderApp();
    loadSettings();
  } else {
    renderApp();
  }

  connectEvents();
  freshnessTimer = window.setInterval(updateFreshness, 30_000);
}

function connectEvents() {
  if (eventSource) return;
  try {
    eventSource = new EventSource('/api/events');
  } catch {
    return;
  }
  eventSource.addEventListener('pricing-updated', (event) => {
    if (Date.now() < state.suppressPricingEventsUntil) return;
    let payload = {};
    try {
      payload = JSON.parse(event.data || '{}');
    } catch {
      payload = {};
    }
    if (state.route?.name === 'settings') {
      if (state.settingsDirty || state.settingsSaving) {
        showToast('Pricing changed in another tab. Your unsaved edits are still here.', 'error');
      } else {
        reloadSettingsQuietly();
      }
      return;
    }
    if (state.route?.name === 'dashboard') {
      showToast('Pricing changed. Refreshing the ledger…');
      if (state.loading) {
        state.pendingPricingRefresh = true;
        return;
      }
      loadReport({ force: true, silent: Boolean(state.dashboard) });
    }
    void payload;
  });
  eventSource.addEventListener('error', () => {
    // EventSource reconnects automatically; no data is lost.
  });
}

function handleDocumentClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (isAgentMenuOpen() && !target.closest('[data-agent-dropdown]')) {
    closeAgentMenu();
  }

  const navTrigger = target.closest('[data-href]');
  if (navTrigger) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    hideChartTooltip();
    navigate(navTrigger.dataset.href);
    return;
  }

  const agentOption = target.closest('[data-agent-option]');
  if (agentOption) {
    event.preventDefault();
    chooseAgent(agentOption.dataset.agentOption);
    return;
  }

  const anchor = target.closest('a[data-link]');
  if (anchor) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    hideChartTooltip();
    navigate(anchor.getAttribute('href'));
    return;
  }

  const actionElement = target.closest('[data-action]');
  if (!actionElement) return;
  const action = actionElement.dataset.action;

  if (action === 'toggle-theme') {
    event.preventDefault();
    toggleTheme(actionElement);
    return;
  }

  if (action === 'toggle-model-menu') {
    event.preventDefault();
    const field = actionElement.closest('.model-field');
    const input = field?.querySelector('[data-model-field]');
    if (!input) return;
    input.focus({ preventScroll: true });
    if (isModelMenuOpen() && modelMenu.input === input) {
      closeModelMenu();
    } else {
      openModelMenu(input);
    }
    return;
  }

  if (action === 'toggle-agent-menu') {

    event.preventDefault();
    if (isAgentMenuOpen()) closeAgentMenu({ focusTrigger: true });
    else openAgentMenu();
    return;
  }

  if (action === 'reload-app') {
    event.preventDefault();
    window.location.reload();
    return;
  }

  if (action === 'refresh') {
    event.preventDefault();
    loadReport({ force: true, silent: Boolean(state.dashboard), notify: true });
    return;
  }

  if (action === 'retry-report') {
    event.preventDefault();
    loadReport({ force: true });
    return;
  }

  if (action === 'retry-settings') {
    event.preventDefault();
    loadSettings({ focusAfter: true });
    return;
  }

  if (action === 'toggle-detail') {
    event.preventDefault();
    const id = actionElement.dataset.target;
    const detail = document.getElementById(id);
    if (!detail) return;
    const willOpen = detail.hidden;
    detail.hidden = !willOpen;
    actionElement.setAttribute('aria-expanded', String(willOpen));
    actionElement.setAttribute(
      'aria-label',
      `${willOpen ? 'Hide' : 'Show'} breakdown`,
    );
    return;
  }

  if (action === 'copy') {
    event.preventDefault();
    copyText(actionElement.dataset.copy, actionElement.dataset.copyLabel || 'Value');
    return;
  }

  if (action === 'chart-metric') {
    event.preventDefault();
    const metric = actionElement.dataset.metric;
    if (metric !== 'tokens' && metric !== 'cost') return;
    if (state.chartMetric === metric) return;
    state.chartMetric = metric;
    const panel = qs('#chart-panel');
    if (panel && state.dashboard) {
      hideChartTooltip();
      panel.outerHTML = renderChartPanel(state.dashboard);
      scheduleMountChart();
      requestAnimationFrame(() => {
        qs(`[data-action="chart-metric"][data-metric="${metric}"]`)?.focus();
      });
    }
    return;
  }

  if (state.route?.name !== 'settings') return;

  if (action === 'add-row') {
    event.preventDefault();
    addSettingsRow();
    return;
  }

  if (action === 'remove-row') {
    event.preventDefault();
    removeSettingsRow(Number(actionElement.dataset.index));
    return;
  }

  if (action === 'add-catalog-model') {
    event.preventDefault();
    addCatalogModel(actionElement.dataset.model);
    return;
  }

  if (action === 'discard-settings') {
    event.preventDefault();
    discardSettings();
    return;
  }

  if (action === 'save-settings') {
    event.preventDefault();
    saveSettings();
  }
}

function handleSettingsInput(event) {
  if (state.route?.name !== 'settings') return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const rowIndex = Number(input.dataset.rowIndex ?? input.closest('[data-row-index]')?.dataset.rowIndex);
  if (!Number.isInteger(rowIndex) || !state.settingsRows[rowIndex]) return;
  const field = input.dataset.field;
  if (!field) return;
  if (input.dataset.modelField !== undefined) {
    state.settingsRows[rowIndex].model = input.value;
  } else if (input.dataset.priceField !== undefined) {
    state.settingsRows[rowIndex][field] = input.value;
  } else {
    return;
  }
  document.querySelectorAll('.has-error').forEach((element) => element.classList.remove('has-error'));
  state.formError = null;
  const error = qs('#settings-form-error');
  if (error) error.hidden = true;
  state.fieldErrors.clear();
  markSettingsDirty();
}

function agentDropdown() {
  return qs('[data-agent-dropdown]');
}

function isAgentMenuOpen() {
  return agentDropdown()?.dataset.open === 'true';
}

function agentOptions() {
  return [...document.querySelectorAll('[data-agent-option]')];
}

function activeAgentOptionIndex() {
  return Number(agentDropdown()?.dataset.activeIndex ?? -1);
}

function setActiveAgentOption(index, { scroll = true } = {}) {
  const dropdown = agentDropdown();
  if (!dropdown) return;
  const options = agentOptions();
  if (!options.length) return;
  const next = ((index % options.length) + options.length) % options.length;
  dropdown.dataset.activeIndex = String(next);
  options.forEach((option, optionIndex) => {
    option.classList.toggle('is-active', optionIndex === next);
  });
  const button = qs('#agent-select', dropdown);
  const active = options[next];
  button?.setAttribute('aria-activedescendant', active.id);
  if (!scroll) return;
  const menu = qs('#agent-listbox', dropdown);
  if (!menu) return;
  const menuRect = menu.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  if (activeRect.top < menuRect.top) {
    menu.scrollTop -= menuRect.top - activeRect.top + 4;
  } else if (activeRect.bottom > menuRect.bottom) {
    menu.scrollTop += activeRect.bottom - menuRect.bottom + 4;
  }
}

function openAgentMenu() {
  const dropdown = agentDropdown();
  if (!dropdown) return;
  const button = qs('#agent-select', dropdown);
  const menu = qs('#agent-listbox', dropdown);
  if (!button || !menu) return;
  dropdown.dataset.open = 'true';
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  const selected = agentOptions().findIndex(
    (option) => option.getAttribute('aria-selected') === 'true',
  );
  setActiveAgentOption(selected < 0 ? 0 : selected, { scroll: false });
}

function closeAgentMenu({ focusTrigger = false } = {}) {
  const dropdown = agentDropdown();
  if (!dropdown) return;
  const button = qs('#agent-select', dropdown);
  const menu = qs('#agent-listbox', dropdown);
  dropdown.dataset.open = 'false';
  dropdown.dataset.activeIndex = '-1';
  if (menu) menu.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
  button?.removeAttribute('aria-activedescendant');
  agentOptions().forEach((option) => option.classList.remove('is-active'));
  if (focusTrigger) button?.focus();
}

function chooseAgent(agent) {
  if (!agent || state.route?.name !== 'dashboard' || agent === state.route.agent) {
    closeAgentMenu({ focusTrigger: true });
    return;
  }
  closeAgentMenu();
  navigate(routeHref({ name: 'dashboard', agent, report: state.route.report, range: state.route.range }));
}

function handleAgentMenuKeydown(event) {
  if (event.key === 'Escape' && isAgentMenuOpen()) {
    event.preventDefault();
    closeAgentMenu({ focusTrigger: true });
    return;
  }
  if (event.target?.id !== 'agent-select') return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!isAgentMenuOpen()) {
      openAgentMenu();
      return;
    }
    setActiveAgentOption(activeAgentOptionIndex() + (event.key === 'ArrowDown' ? 1 : -1));
    return;
  }
  if (!isAgentMenuOpen()) return;
  const options = agentOptions();
  if (!options.length) return;
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    setActiveAgentOption(event.key === 'Home' ? 0 : options.length - 1);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const active = options[activeAgentOptionIndex()];
    if (active) chooseAgent(active.dataset.agentOption);
    return;
  }
  if (event.key === 'Tab') closeAgentMenu();
}

function handleAgentMenuPointer(event) {
  if (!isAgentMenuOpen()) return;
  const target = event.target instanceof Element ? event.target : null;
  const option = target?.closest('[data-agent-option]');
  if (!option) return;
  const index = Number(option.dataset.agentIndex);
  if (Number.isInteger(index) && index !== activeAgentOptionIndex()) {
    setActiveAgentOption(index, { scroll: false });
  }
}

async function handlePopState() {
  if (!state.boot) return;
  if (hasUnsavedSettings() && !(await confirmDiscardSettings())) {
    history.pushState(null, '', '/settings');
    return;
  }
  const route = parseRoute();
  applyRoute(route, {
    replace: true,
    focusHeading: true,
  });
}

function handleBeforeUnload(event) {
  if (state.route?.name === 'settings' && state.settingsDirty && !state.settingsSaving) {
    event.preventDefault();
    event.returnValue = 'You have unsaved pricing changes.';
  }
}


window.addEventListener('click', handleDocumentClick);
window.addEventListener('input', handleSettingsInput);
window.addEventListener('input', handleModelFieldInput);
window.addEventListener('keydown', handleAgentMenuKeydown);
window.addEventListener('keydown', handleModelFieldKeydown);
window.addEventListener('keydown', handleRowReorderKeydown);
window.addEventListener('pointerover', handleAgentMenuPointer, { passive: true });
window.addEventListener('pointerdown', handleDocumentPointerDown);
window.addEventListener('pointermove', moveRowDrag);
window.addEventListener('pointerup', endRowDrag);
window.addEventListener('pointercancel', endRowDrag);
window.addEventListener(
  'scroll',
  () => {
    if (isModelMenuOpen()) positionModelMenu();
  },
  true,
);
window.addEventListener('resize', () => {
  if (isModelMenuOpen()) positionModelMenu();
});

window.addEventListener('popstate', handlePopState);
window.addEventListener(
  'scroll',
  (event) => {
    const target = event.target;
    if (target instanceof Element && target.matches('[data-ledger-scroll]')) syncLedgerFooter();
  },
  true,
);
window.addEventListener('beforeunload', handleBeforeUnload);
window.addEventListener('pointermove', handleChartPointer, { passive: true });
window.addEventListener('pointerout', (event) => {
  const related = event.relatedTarget;
  if (!(related instanceof Element) || !related.closest('.chart-shell')) hideChartTooltip();
});
window.addEventListener('focusin', handleChartFocus);
window.addEventListener('focusout', handleChartBlur);
window.addEventListener('resize', () => {
  window.clearTimeout(chartResizeTimer);
  chartResizeTimer = window.setTimeout(() => {
    const mount = qs('[data-chart-mount]');
    if (mount) mount.dataset.lastWidth = '';
    mountChart();
  }, 140);
});
window.addEventListener('pagehide', () => {
  if (eventSource) eventSource.close();
  if (freshnessTimer) window.clearInterval(freshnessTimer);
});

boot();
