'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChartColumn, Settings } from 'lucide-react';

import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const LAST_USAGE = 'tokenly-usage-path';

/**
 * The frame every page sits in: header, navigation and the content well.
 * `toolbar` holds the controls that belong to the current page, `footer` is
 * optional — the Settings page has no command line to show.
 */
export function AppShell({
  toolbar,
  footer,
  children,
}: {
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const inSettings = pathname.startsWith('/settings');

  // Coming back from Settings should return to the report you left, not to
  // the default one.
  const [usagePath, setUsagePath] = useState('/usage/daily/all');
  useEffect(() => {
    if (inSettings) return;
    setUsagePath(pathname);
    try {
      sessionStorage.setItem(LAST_USAGE, pathname);
    } catch {
      /* private mode — the default path is fine */
    }
  }, [pathname, inSettings]);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(LAST_USAGE);
      if (saved) setUsagePath(saved);
    } catch {
      /* private mode — the default path is fine */
    }
  }, []);

  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <Link className="brand" href="/usage/daily/all">
            <Logo size={30} />
            <span className="brand__text">
              <span className="brand__word">
                Token<span>ly</span>
              </span>
              <span className="brand__sub">agent usage telemetry</span>
            </span>
          </Link>

          {/* Buttons, not links: no link preview on hover, and the router
              handles the navigation. */}
          <nav className="segmented masthead__nav" aria-label="Sections">
            <button
              type="button"
              className="btn"
              aria-current={inSettings ? undefined : 'page'}
              onClick={() => {
                // Already on a report: nothing to go back to.
                if (!inSettings) return;
                router.push(usagePath);
              }}
            >
              <ChartColumn size={13} aria-hidden="true" />
              Usage
            </button>
            <button
              type="button"
              className="btn"
              aria-current={inSettings ? 'page' : undefined}
              onClick={() => router.push('/settings')}
            >
              <Settings size={13} aria-hidden="true" />
              Settings
            </button>
          </nav>

          <div className="toolbar">
            {toolbar}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="shell">{children}</main>

      {footer}
    </>
  );
}
