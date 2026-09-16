// =================================
//  IMPORTS
// =================================

// =================================
//  COMPONENT
// =================================
/**
 * Logo dell'app: scudo con globo, in stile "vault" (navy + oro). Disegnato come SVG
 * inline così è nitido a qualsiasi dimensione (header, favicon, splash).
 */
export default function Logo({
  size = 28,
  rounded = true,
  className = "",
}: {
  size?: number;
  rounded?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="ScanDex"
    >
      <defs>
        <linearGradient id="scandex-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <rect
        width="48"
        height="48"
        rx={rounded ? 12 : 0}
        fill="#0F172A"
      />
      <path
        d="M24 8 L35 12 V22 C35 30.5 30.5 36.5 24 39.5 C17.5 36.5 13 30.5 13 22 V12 Z"
        fill="none"
        stroke="url(#scandex-gold)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle
        cx="24"
        cy="22.5"
        r="8"
        fill="none"
        stroke="url(#scandex-gold)"
        strokeWidth="1.4"
      />
      <ellipse
        cx="24"
        cy="22.5"
        rx="3.4"
        ry="8"
        fill="none"
        stroke="url(#scandex-gold)"
        strokeWidth="1.2"
      />
      <line
        x1="16"
        y1="22.5"
        x2="32"
        y2="22.5"
        stroke="url(#scandex-gold)"
        strokeWidth="1.2"
      />
    </svg>
  );
}
