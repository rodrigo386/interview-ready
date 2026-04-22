type Variant = "horizontal" | "vertical" | "symbol";

export function Logo({
  variant = "horizontal",
  size = 32,
  className = "",
}: {
  variant?: Variant;
  size?: number;
  className?: string;
}) {
  if (variant === "symbol") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 80"
        width={size}
        height={size}
        className={className}
        aria-label="PrepaVaga"
        role="img"
      >
        <g transform="translate(40, 40)">
          <path
            d="M -24 20 Q -24 -20 0 -20 Q 24 -20 24 20"
            fill="none"
            stroke="#EA580C"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="-24" cy="20" r="4.5" className="fill-text-primary" />
          <circle cx="24" cy="20" r="4.5" fill="#EA580C" />
        </g>
      </svg>
    );
  }

  if (variant === "vertical") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 140"
        width={size}
        height={(size * 140) / 160}
        className={className}
        aria-label="PrepaVaga"
        role="img"
      >
        <g transform="translate(80, 45)">
          <path
            d="M -24 20 Q -24 -20 0 -20 Q 24 -20 24 20"
            fill="none"
            stroke="#EA580C"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="-24" cy="20" r="4.5" className="fill-text-primary" />
          <circle cx="24" cy="20" r="4.5" fill="#EA580C" />
        </g>
        <text
          x="80"
          y="115"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="28"
          fontWeight="700"
          letterSpacing="-0.5"
          className="fill-text-primary"
        >
          Prepa<tspan fill="#EA580C">Vaga</tspan>
        </text>
      </svg>
    );
  }

  // horizontal (default)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 80"
      width={(size * 360) / 80}
      height={size}
      className={className}
      aria-label="PrepaVaga"
      role="img"
    >
      <g transform="translate(40, 40)">
        <path
          d="M -24 20 Q -24 -20 0 -20 Q 24 -20 24 20"
          fill="none"
          stroke="#EA580C"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="-24" cy="20" r="4.5" className="fill-text-primary" />
        <circle cx="24" cy="20" r="4.5" fill="#EA580C" />
      </g>
      <text
        x="95"
        y="50"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="32"
        fontWeight="700"
        letterSpacing="-0.5"
        className="fill-text-primary"
      >
        Prepa<tspan fill="#EA580C">Vaga</tspan>
      </text>
    </svg>
  );
}
