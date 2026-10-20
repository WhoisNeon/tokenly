'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'tokenly-theme';

type Theme = { dark: boolean; toggle: () => void };

const ThemeContext = createContext<Theme>({ dark: false, toggle: () => {} });

/**
 * One provider for the whole app: the header toggle and the chart both need
 * to know the theme, and two copies of this state would drift apart.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  /** Resolves after mount so server and client render the same markup. */
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* private mode — the in-memory toggle still works */
    }
  };

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      type="button"
      className="btn btn--icon"
      onClick={toggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    >
      {dark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
    </button>
  );
}
