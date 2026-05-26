/**
 * CitaDex logo — open book with a citation mark.
 * Uses CSS custom property --primary so the mark adopts the brand accent
 * colour in both light and dark themes.
 *
 * Layout in header:
 *   [Logo 28px]  CitaDex
 *                Academic Citation Workspace
 */
export function CodexLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      role="img"
      aria-label="CitaDex"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rounded background tile */}
      <rect
        x="1" y="1" width="34" height="34" rx="9"
        fill="hsl(var(--primary) / 0.10)"
        stroke="hsl(var(--primary) / 0.25)"
        strokeWidth="1.2"
      />

      {/* Open book — left page */}
      <path
        d="M18 11 C15 10.5 11 11 9 12.5 L9 25.5 C11 24 15 23.5 18 24"
        stroke="hsl(var(--primary))"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Open book — right page */}
      <path
        d="M18 11 C21 10.5 25 11 27 12.5 L27 25.5 C25 24 21 23.5 18 24"
        stroke="hsl(var(--primary))"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Spine line */}
      <line
        x1="18" y1="11"
        x2="18" y2="24"
        stroke="hsl(var(--primary) / 0.55)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Citation bracket — bottom right corner */}
      <text
        x="22"
        y="30"
        fontSize="8"
        fontWeight="700"
        fontFamily="Georgia, serif"
        fill="hsl(var(--primary))"
        letterSpacing="-0.5"
      >[1]</text>
    </svg>
  );
}
