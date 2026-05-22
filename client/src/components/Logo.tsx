/**
 * CitaDex logo — open book with cursor mark.
 *
 * Design rationale:
 *   - Open book shape = academic document editing
 *   - Small cursor triangle = active editing / citation insertion
 *   - Works at 16px (favicon) through 200px (splash)
 *   - Monochrome-first: uses currentColor for all strokes
 *   - Tinted fill uses a CSS custom-property-safe opacity layer
 *
 * Theming: place inside any element that sets `color` — the mark
 * adopts that colour automatically via currentColor.
 * For the brand teal, wrap in a container with `color: hsl(var(--primary))`.
 */

interface LogoProps {
  size?: number;
  className?: string;
}

export function CitaDexLogo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CitaDex"
      className={className}
    >
      {/* ── Background pill ─────────────────────────────────────────── */}
      <rect
        x="1" y="1" width="30" height="30" rx="8"
        fill="currentColor"
        fillOpacity="0.09"
        aria-hidden="true"
      />
      <rect
        x="1" y="1" width="30" height="30" rx="8"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1"
        aria-hidden="true"
      />

      {/* ── Left page of open book ──────────────────────────────────── */}
      {/*
        Spine at x=16, left page sweeps to x=6.
        Bottom corners rest at y=22; top arcs slightly to suggest a page.
      */}
      <path
        d="M16 8.5 C13 8 9 8.5 6.5 10 L6.5 22.5 C9 21.2 13 20.8 16 21.5 Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      />

      {/* ── Right page of open book ─────────────────────────────────── */}
      <path
        d="M16 8.5 C19 8 23 8.5 25.5 10 L25.5 22.5 C23 21.2 19 20.8 16 21.5 Z"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      />

      {/* ── Spine line ──────────────────────────────────────────────── */}
      <line
        x1="16" y1="8.5"
        x2="16" y2="21.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        aria-hidden="true"
      />

      {/* ── Cursor / insertion mark (bottom-right) ──────────────────── */}
      {/*
        A small blinking-cursor triangle — signals active editing.
        Sits at bottom-right, intentionally breaking the book symmetry.
      */}
      <path
        d="M20 24 L23.2 27.5 L23.2 24 Z"
        fill="currentColor"
        fillOpacity="0.85"
        aria-hidden="true"
      />
    </svg>
  );
}

/** @deprecated Use CitaDexLogo instead. Kept for back-compat. */
export const CodexLogo = CitaDexLogo;
