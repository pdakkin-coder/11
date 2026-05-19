/**
 * CitaDex logo — a refined monogram mark combining the letters C and D
 * within a rounded square. The C arc represents "Citation" and the vertical
 * bar of the D represents "Dex" / index. Works at any size, uses currentColor
 * so it adapts to both light and dark themes automatically.
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
      {/* Rounded-square background tile */}
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="currentColor"
        fillOpacity="0.10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />

      {/* C arc — open circle on the left, representing “Citation” */}
      <path
        d="M18.5 9.5 C14.5 9.5 11 12.4 11 16 C11 19.6 14.5 22.5 18.5 22.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.90"
      />

      {/* D vertical bar — right side, representing “Dex” / index */}
      <line
        x1="21"
        y1="9.5"
        x2="21"
        y2="22.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.90"
      />

      {/* D upper serif connector */}
      <line
        x1="18.5"
        y1="9.5"
        x2="21"
        y2="9.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.90"
      />

      {/* D lower serif connector */}
      <line
        x1="18.5"
        y1="22.5"
        x2="21"
        y2="22.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.90"
      />
    </svg>
  );
}
