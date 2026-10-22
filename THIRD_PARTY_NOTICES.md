# Third-party notices

## Fonts

Tokenly bundles the following fonts as local WOFF2 files. They are distributed under
the SIL Open Font License 1.1.

- **Instrument Serif** — Copyright 2022 The Instrument Serif Project Authors
  <https://github.com/Instrument/instrument-serif>
  License: [`public/fonts/licenses/Instrument-Serif-OFL.txt`](public/fonts/licenses/Instrument-Serif-OFL.txt)
- **Instrument Sans** — Copyright 2022 The Instrument Sans Project Authors
  <https://github.com/Instrument/instrument-sans>
  License: [`public/fonts/licenses/Instrument-Sans-OFL.txt`](public/fonts/licenses/Instrument-Sans-OFL.txt)
- **IBM Plex Mono** — Copyright 2017 IBM Corp. All rights reserved.
  <https://github.com/IBM/plex>
  License: [`public/fonts/licenses/IBM-Plex-Mono-OFL.txt`](public/fonts/licenses/IBM-Plex-Mono-OFL.txt)

## ccusage

Tokenly invokes the separately installed [ccusage](https://github.com/ryoppippi/ccusage)
CLI and reads its output. ccusage is not bundled with Tokenly. It is distributed under
the MIT License by its authors.

## Icons

`public/app.js` inlines the path data of the icons the interface draws (refresh,
settings, external link, arrow up-right, link, copy, shield, alert, info, trash,
plus, database, check, close, file, sun, moon, chevron down, chevrons up-down, and
the drag grip). They are plain SVG strings inside Tokenly's own module: no icon
font, no sprite, no build step, no request. Every glyph is stroked with
`currentColor`, so it follows the active theme.

- **Lucide** — <https://lucide.dev>, ISC License, path data taken from
  `lucide-static` v1.60.0 (`@license lucide-static v1.60.0 - ISC`). Portions of the
  set derive from Feather, MIT, Copyright 2013-2022 Cole Bemis.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Agent marks

`public/agent-marks.js` inlines one small mark per supported coding agent so the
ledger can show a source instead of an abbreviation. Every mark is monochrome: the
paths are filled with `currentColor`, so a mark inherits the ink of whatever it sits
on and reads the same in the light and the dark theme. The paths ship as data inside
Tokenly's own module, and the single raster mark ships as
`public/agent-codebuff.png` — no icon font, sprite, CDN, or network request is
involved.

- **LobeHub mono icons** (<https://lobehub.com/icons>) — every agent in the roster
  except Droid and Codebuff: Claude, Codex, OpenCode, Amp, Hermes, Pi, Goose,
  OpenClaw, Kilo, Kimi, Qwen, Copilot, Gemini, Antigravity, Grok, and ZCode, taken
  from `@lobehub/icons-static-svg` 1.95.1 (MIT collection). LobeHub republishes each
  product's official mark as a 24x24 single-colour SVG; each entry's `source` records
  the exact file, and the marks stay under their owners' terms. Tokenly uses the mono
  set and drops any colour an upstream file carries, so the artwork is
  `currentColor` only.
- **Product artwork** — Droid keeps its own vendor mark, because LobeHub does not
  carry one.
- **Codebuff** — a monochrome mask derived from the product's official
  [apple-touch-icon](https://www.codebuff.com/favicon/apple-touch-icon.png).
- All of these marks remain trademarks of their owners and appear here for
  identification only, not as a claim of affiliation.
