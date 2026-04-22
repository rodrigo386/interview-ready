export function CrossingArc({ className = "" }: { className?: string }) {
  // Arc drawn with stroke-dasharray animation on mount (CSS only).
  // Left dot = candidato (neutro); arc = jornada; right dot = contratado (coral).
  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg
        viewBox="0 0 360 220"
        className="w-full max-w-sm"
        role="img"
        aria-label="Arco de travessia de candidato a contratado"
      >
        <defs>
          <style>{`
            .arc-path {
              stroke-dasharray: 420;
              stroke-dashoffset: 420;
              animation: arc-draw 2s ease-out 0.2s forwards;
            }
            .arc-dot-right {
              opacity: 0;
              animation: arc-pop 0.4s ease-out 2.1s forwards;
            }
            @keyframes arc-draw {
              to { stroke-dashoffset: 0; }
            }
            @keyframes arc-pop {
              from { opacity: 0; transform: scale(0.5); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </defs>

        {/* Left dot (candidato) */}
        <circle cx="40" cy="180" r="8" className="fill-text-tertiary" />
        <text
          x="40"
          y="210"
          textAnchor="middle"
          fontSize="12"
          fontWeight="500"
          className="fill-text-secondary"
        >
          Candidato
        </text>

        {/* Arc */}
        <path
          d="M 40 180 Q 180 20 320 180"
          fill="none"
          stroke="#EA580C"
          strokeWidth="3"
          strokeDasharray="6 6"
          strokeLinecap="round"
          className="arc-path"
          style={{ transformOrigin: "center" }}
        />

        {/* Right dot (contratado) */}
        <g className="arc-dot-right" style={{ transformOrigin: "320px 180px" }}>
          <circle cx="320" cy="180" r="10" fill="#EA580C" />
          <circle cx="320" cy="180" r="16" fill="#EA580C" opacity="0.15" />
        </g>
        <text
          x="320"
          y="210"
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="#EA580C"
        >
          Contratado
        </text>
      </svg>
    </div>
  );
}
