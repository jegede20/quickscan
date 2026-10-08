// The QuickScan mark: black rounded square, four white corner brackets,
// one orange scan line through the middle.

export function LogoMark({
  size = 72,
  rounded = true,
  className = "",
}: {
  size?: number;
  /** Rounded (favicon / icons) or full-bleed square (maskable / Apple). */
  rounded?: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 72 72"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <rect width="72" height="72" rx={rounded ? 16 : 0} fill="#111111" />
      <g
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M18 28V18H28M44 18H54V28M54 44V54H44M28 54H18V44" />
      </g>
      <rect x="11" y="34" width="50" height="4" rx="2" fill="#FF5A1F" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`tracking-tight ${className}`}>
      <span className="font-bold">Quick</span>
      <span className="font-normal">Scan</span>
    </span>
  );
}
