# AGENTS.md

Guidance for coding agents working on Tokenly. Read this before changing code.

## What this project is

Tokenly is a **local-only** web dashboard for coding-agent token usage. It runs a
small Node.js HTTP server that shells out to the [ccusage](https://ccusage.com/guide/)
CLI, normalizes its JSON, and renders a dependency-free single-page UI.

- Runtime: Node.js 20+, ES modules (`.mjs` on the server, `.js` in `public/`).
- **Zero runtime dependencies.** Do not add `dependencies` to `package.json`. The
  lockfile and `node_modules` are not part of this project.
- No build step. `public/` is served as-is and the browser loads native ES modules.

## Commands

```bash
npm start                 # http://127.0.0.1:4777
npm run dev               # same, with node --watch
node server.mjs --port 4781
npm test                  # node:test suite, no network needed
```

Useful environment variables: `TOKENLY_PORT`, `TOKENLY_CONFIG_PATH`,
`CCUSAGE_BIN`, `TOKENLY_OPEN=1`. `CCUSAGE_BIN` lets tests and manual checks point
at a fake CLI entry point instead of the real one.

## Hard constraints

1. **Never add a runtime dependency, CDN request, or build step.**
2. **Local only.** Bind to `127.0.0.1`. No telemetry, analytics, remote logging,
   cloud storage, or outbound requests from the app. Fonts are bundled in
   `public/fonts/`; keep it that way.
3. **Keep the CSP strict.** `server.mjs` sets
   `script-src 'self'; style-src 'self' 'unsafe-inline'`. Do not add inline
   `<script>`, `onclick=` attributes, or external script/style origins.
4. **Always run ccusage with `--offline`** and pass the resolved config with
   `--config`. Never fetch pricing over the network.
5. **Never delete or overwrite an invalid ccusage config.** Writes must stay
   atomic and back up first (`lib/config.mjs`).
6. **Do not push to GitHub** unless the user explicitly asks. There is no CI here;
   verify locally.
7. **Do not add or edit app screenshots by hand.** They are captured from the real
   running UI (see “Screenshots” below).

## Architecture

```text
server.mjs              HTTP server, JSON APIs, static assets, SSE, security headers
lib/constants.mjs       agent roster, ranges, pricing fields, limits
lib/ccusage.mjs         resolves and runs the ccusage binary safely
lib/config.mjs          config discovery, validation, atomic writes, backups
lib/report.mjs          command construction, JSON normalization, aggregation, caches
lib/util.mjs            errors, escaping, date/path helpers
public/index.html       shell + boot screen
public/app.js           SPA: routing, rendering, icons, custom dropdowns,
                        reorderable settings rows, settings form, SSE
public/charts.js        dependency-free responsive SVG charts
public/formatters.js    Intl-based number/date/currency formatting
public/agent-marks.js   inline 24x24 LobeHub brand marks for the agent roster
public/agent-codebuff.png  monochrome mask for the one raster agent mark
public/styles.css       all styling and design tokens
public/fonts/           bundled fonts and their OFL licenses
test/tokenly.test.mjs   node:test suite (temp dirs + fake ccusage)
```

Data flow: `app.js` calls `/api/bootstrap`, `/api/report`, `/api/settings`, and
`/api/models`. `lib/report.mjs` builds the command, parses/null-checks the JSON,
then aggregates rows, models, and agents. Settings writes go through
`lib/config.mjs` and broadcast a `pricing-updated` SSE event.

## UI conventions

- **Navigation uses `<button data-href="…">`, not `<a href>`.** Internal anchors
  trigger a browser link preview on hover, which the owner does not want. The
  delegated click handler in `app.js` calls `navigate()` and `history.pushState`.
  External documentation links may remain normal anchors.
- **The report source picker is a custom accessible dropdown** (`renderAgentDropdown`,
  `role="listbox"` + `role="option"`, `aria-activedescendant`, Arrow/Home/End/
  Enter/Space/Escape). Do not replace it with a native `<select>`.
- **The model field has its own suggestion list** with the same listbox contract
  (`renderModelMenu`, keyboard handled in `handleModelFieldKeydown`). It renders into
  a body-level fixed portal because `.price-editor-scroll` clips inline popups, and it
  flips up near the viewport bottom. Suggestions come from *saved* rows, since
  `/api/models` returns nothing offline; opening shows every saved model with the
  current value highlighted.
- **Interface icons are inline Lucide paths.** `ICONS` in `public/app.js` holds the
  path data (`lucide-static`, ISC, credited in `THIRD_PARTY_NOTICES.md`); `icon()`
  builds the SVG with `stroke="currentColor"`. No icon font, sprite, or CDN — do not
  add one. The agent brand marks are the one exception; they come from LobeHub (see
  the chip bullet below).
- **Settings rows reorder by pointer or keyboard** (`reorderRows`, `renderDragHandle`).
  The handle is the focus target, arrow keys move the row, and announcements go to
  `#reorder-status`; `body.is-row-dragging` suppresses text selection while dragging.
- **Confirmations use the app's own dialog**, never `window.confirm`/`alert`/`prompt`
  (`confirmDialog`, `.confirm-dialog` in the top layer). The card background is
  transparent on purpose — the backdrop paints the scrim, so keep the `::backdrop`
  rule in sync. `beforeunload` stays native: a browser cannot replace that one.
- **Typography floor:** micro labels stay at **11.5px**, body/table copy at **13px**.
  The small-print overrides live at the end of `styles.css`; keep them last so they
  win over the responsive rules. Do not use 6–9px text.
- **Agent chips show a brand mark, not a name.** The daily table renders each source
  as a 20px `.agent-chip` holding the mark from `public/agent-marks.js`; the agent name
  lives in `aria-label`/`title`. Every mark is the product's real vector from
  [LobeHub](https://lobehub.com/icons?type=mono), painted with `fill="currentColor"`,
  so it inherits the chip's ink and stays monochrome in both themes — no `--swatch`,
  no `agentColor()` on chips, no colour baked into the artwork. Two entries cannot
  use that set: Droid keeps its vendor mark (LobeHub has none) and Codebuff is the
  only raster asset, painted through `mask-image` from `public/agent-codebuff.png`
  so it takes the same ink. The expanded row reuses the same 12px mark in front of
  each source name, and the source picker repeats it in the trigger and before every
  option; the combined "All agents" row uses a neutral four-tile glyph from the same
  module.
- Design tokens live in `:root` (`--paper`, `--ink`, `--acid`, `--coral`, …). Reuse
  them instead of hard-coded colors. The look is warm editorial: Instrument Serif
  display type, Instrument Sans body, IBM Plex Mono for data.
- **There are three token blocks and they must stay in sync:** light `:root`, the
  `@media (prefers-color-scheme: dark)` block for `:root:not([data-theme='light'])`,
  and `:root[data-theme='dark']` for an explicit choice. No stored theme means the OS
  decides. `npm test` compares the two dark blocks, so add new tokens to all three and
  keep the two dark blocks key-identical; only the light block may hold a different
  set.
- **The palette is photo-negative across themes.** `--forest` is the ink *surface*,
  not a fixed green: deep green in light, cream in dark. Everything that sits on it —
  nav, sidebar, panels, hero — takes its colours from the `--on-forest*` family
  (`--on-forest` primary, `--on-forest-2` secondary, `--on-forest-3` tertiary micro,
  `--on-forest-rgb` for alpha tints, `--forest-float-rgb` for the floating ink
  panels) plus `--forest-accent*`, `--forest-warn*`, `--forest-coral`,
  `--forest-code-blue`, `--forest-code-gold`, and the `--pill-*` trio for the
  active nav pill. Never hard-code cream or `--ink` on that surface.
- **Muted text on the ink surface uses solid tokens.** `--on-forest-2` and
  `--on-forest-3` replace the low-alpha `rgb(var(--on-forest-rgb) / 0.5)` tints: one
  alpha cannot clear 4.5:1 on both a dark green and a cream surface, and the test
  asserts both palettes.
- **`--cream` and `--acid` stay light in both palettes** (boot marks, selection,
  `.btn-acid`). Text on them must use the non-flipping pins `--on-cream`, `--on-acid`,
  or `--coral-ink` — using `--ink` there breaks the theme. `--forest-2` and
  `--forest-3` belong to `.btn-primary:hover` alone, so they stay dark green in both
  palettes. `--agent-*` lives in the two dark blocks only: `agentColor()` falls back
  to a hex in `formatters.js` for light mode and picks up the dark override after.
- **The theme toggle animates a circular reveal** from the button: `startViewTransition`
  in `public/app.js` sets `--theme-origin-x/y/r`, and `@keyframes theme-reveal` grows
  a `clip-path: circle()` on `::view-transition-new(root)`. There is a
  `prefers-reduced-motion` kill switch at the end of the stylesheet — keep it.
- Use `escapeHtml` / `escapeAttribute` for every interpolated value in templates.
- Respect `prefers-reduced-motion`; do not add autoplaying or infinite motion that
  is not covered there.

## Tests and verification

Before finishing a change:

```bash
npm test
node --check public/app.js
node --check public/charts.js
```

Then start the server and check the real UI at **1440px, 1024px, 768px, and 430px**:

- no horizontal page overflow;
- the source dropdown opens, is keyboard operable, and navigates on selection;
- no console errors;
- no text below ~11px;
- settings table scrolls horizontally on mobile without breaking the page.

`npm test` also guards the client contract without a browser: the inline monochrome
agent marks and their sources, the `agentColor()` indirection, the three token blocks
with the ink contrast in both palettes, the theme reveal, and the "no native dialogs /
no inline handlers" rule.

The test suite uses `test/.tmp/`, temporary configs, and a fake ccusage script.
**Never point tests at the real home ccusage config.**

## Screenshots

`docs/screenshots/` is generated from the running app, not hand-made. Capture with
headless Chrome via the DevTools protocol (`Page.captureScreenshot`) at a 1440px
viewport, waiting for `.metric-value`/`.chart-svg` (dashboard) or `.price-table`
(settings) before shooting. Pin the theme first with
`document.documentElement.setAttribute('data-theme', 'light'|'dark')` so the files
never depend on the host OS scheme. Keep the logo at `public/logo.svg` in sync with
`public/favicon.svg` if the mark changes.

## Editing style

- 2-space indentation, single quotes, semicolons, trailing commas.
- Prefer small pure helpers; keep DOM code in `public/app.js`.
- Match the surrounding naming and comment density. Comments explain *why*, not *what*.
- Keep the app dependency-free and the README accurate when behavior changes.
