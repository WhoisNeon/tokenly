export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      {/* Palette comes from CSS so the mark reverses with the theme: dark tile on
          paper, near-white tile on ink. Nothing here touches JS state, so it is
          correct on the server-rendered first paint. */}
      <rect x="16" y="16" width="224" height="224" rx="60" fill="var(--logo-tile)" />
      <rect x="64" y="64" width="128" height="30" rx="8" fill="var(--logo-bar-1)" />
      <rect x="92" y="113" width="100" height="30" rx="8" fill="var(--logo-bar-2)" />
      <rect x="120" y="162" width="72" height="30" rx="8" fill="var(--logo-bar-3)" />
    </svg>
  );
}