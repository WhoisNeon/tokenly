import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Martian_Mono } from 'next/font/google';

import { ThemeProvider } from '@/components/ThemeToggle';

import './globals.css';

const display = Martian_Mono({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-martian' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Tokenly — coding agent token usage',
  description: 'A dashboard for visualising coding agent token usage from the ccusage CLI.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2efe8' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0e0c' },
  ],
};

// Applies the saved theme before first paint so the page never flashes the wrong one.
const themeScript = `try{var t=localStorage.getItem('tokenly-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The pre-paint script and browser extensions both mutate <html> before React
    // hydrates (data-theme, data-google-analytics-opt-out, …). React would report
    // those as a mismatch, so suppress it on this element only.
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}