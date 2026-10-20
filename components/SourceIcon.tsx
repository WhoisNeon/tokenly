'use client';

import type { CSSProperties } from 'react';
import { Bot, Boxes, Layers, SquareTerminal } from 'lucide-react';

/**
 * Agent marks come from the LobeHub icon set, served by jsDelivr. Every one is
 * a monochrome SVG painted with `currentColor`, so it is applied as a CSS
 * mask: the mark then takes the colour of the text around it and reads the
 * same on paper and on ink.
 *
 * Pinned to the major version, so the URLs cannot change under us.
 */
const LOBEHUB = 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1/icons';

/** ccusage source name -> icon slug in the LobeHub set. */
const SLUGS: Record<string, string> = {
  claude: 'claude',
  codex: 'codex',
  gemini: 'gemini',
  copilot: 'githubcopilot',
  amp: 'amp',
  pi: 'pi',
  goose: 'goose',
  kilo: 'kilocode',
  antigravity: 'antigravity',
  kimi: 'kimi',
  qwen: 'qwen',
  openclaw: 'openclaw',
  grok: 'grok',
  opencode: 'opencode',
  hermes: 'hermesagent',
};

/**
 * The three agents below have no mark in the set, so they get a generic one.
 * Swap in a real mark if the set ever grows one.
 */
const FALLBACKS: Record<string, 'bot' | 'terminal' | 'boxes'> = {
  droid: 'bot',
  codebuff: 'terminal',
  zcode: 'boxes',
};

function maskStyle(slug: string): CSSProperties {
  const url = `url("${LOBEHUB}/${slug}.svg")`;
  return {
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };
}

export function SourceIcon({ source }: { source: string }) {
  if (source === 'all') {
    return (
      <span className="source-icon" aria-hidden="true">
        <Layers size={15} strokeWidth={1.75} />
      </span>
    );
  }

  const slug = SLUGS[source];
  if (slug) {
    return (
      <span className="source-icon source-icon--mask" style={maskStyle(slug)} aria-hidden="true" />
    );
  }

  const fallback = FALLBACKS[source];
  if (fallback === 'bot') {
    return (
      <span className="source-icon" aria-hidden="true">
        <Bot size={15} strokeWidth={1.75} />
      </span>
    );
  }
  if (fallback === 'terminal') {
    return (
      <span className="source-icon" aria-hidden="true">
        <SquareTerminal size={15} strokeWidth={1.75} />
      </span>
    );
  }
  if (fallback === 'boxes') {
    return (
      <span className="source-icon" aria-hidden="true">
        <Boxes size={15} strokeWidth={1.75} />
      </span>
    );
  }

  // An agent ccusage reports that has no mark of its own keeps its name.
  return <span className="source-icon source-icon--text">{source}</span>;
}
