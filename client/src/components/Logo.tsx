/**
 * CitaDex logo — a refined monogram mark combining the letters C and D
 * within a rounded square. Uses CSS custom property --primary so the mark
 * adopts the brand accent colour in both light and dark themes.
 */
export function CodexLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="CitaDex"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1" y="1" width="30" height="30" rx="8"
        fill="hsl(var(--primary) / 0.12)"
        stroke="hsl(var(--primary) / 0.30)"
        strokeWidth="1.2"
      />
      {/* C arc — Citation */}
      <path
        d="M18.5 9.5 C14.5 9.5 11 12.4 11 16 C11 19.6 14.5 22.5 18.5 22.5"
        stroke="hsl(var(--primary))"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* D vertical bar — Dex/index */}
      <line x1="21" y1="9.5"  x2="21" y2="22.5" stroke="hsl(var(--primary))" strokeWidth="2.4" strokeLinecap="round" />
      {/* D upper connector */}
      <line x1="18.5" y1="9.5"  x2="21" y2="9.5"  stroke="hsl(var(--primary))" strokeWidth="2.4" strokeLinecap="round" />
      {/* D lower connector */}
      <line x1="18.5" y1="22.5" x2="21" y2="22.5" stroke="hsl(var(--primary))" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
