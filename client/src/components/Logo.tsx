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
      {/* Soft monogram: a stylised quotation mark sitting inside a rounded square */}
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="7"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.4"
      />
      <path
        d="M11.5 11.5c-2.4 0.6-4.2 2.6-4.2 5.4 0 2.4 1.6 4.1 3.8 4.1 1.7 0 3-1.2 3-2.9 0-1.6-1.2-2.7-2.7-2.7-0.3 0-0.6 0.04-0.9 0.13 0.2-1.5 1.4-2.7 2.9-3.1l-1.9-1z"
        fill="currentColor"
      />
      <path
        d="M21 11.5c-2.4 0.6-4.2 2.6-4.2 5.4 0 2.4 1.6 4.1 3.8 4.1 1.7 0 3-1.2 3-2.9 0-1.6-1.2-2.7-2.7-2.7-0.3 0-0.6 0.04-0.9 0.13 0.2-1.5 1.4-2.7 2.9-3.1l-1.9-1z"
        fill="currentColor"
      />
    </svg>
  );
}
