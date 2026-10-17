export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      {/* Fixed brand palette so the mark reads identically on paper and on ink.
          The hairline rim only shows in dark mode, where the tile could vanish. */}
      <rect
        x="16"
        y="16"
        width="224"
        height="224"
        rx="60"
        fill="#0C0F0E"
        stroke="currentColor"
        strokeOpacity="0.16"
      />
      <rect x="64" y="64" width="128" height="30" rx="8" fill="#A3E635" />
      <rect x="92" y="113" width="100" height="30" rx="8" fill="#8C9A8F" />
      <rect x="120" y="162" width="72" height="30" rx="8" fill="#6E7A72" />
    </svg>
  );
}