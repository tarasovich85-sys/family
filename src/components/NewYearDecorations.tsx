const BULBS = [
  { cx: 30, cy: 20, color: '#EF4444', phase: 'a' },
  { cx: 80, cy: 26, color: '#FBBF24', phase: 'b' },
  { cx: 130, cy: 22, color: '#34D399', phase: 'a' },
  { cx: 180, cy: 17, color: '#38BDF8', phase: 'b' },
  { cx: 230, cy: 23, color: '#F472B6', phase: 'a' },
  { cx: 280, cy: 27, color: '#FBBF24', phase: 'b' },
  { cx: 330, cy: 21, color: '#EF4444', phase: 'a' },
  { cx: 380, cy: 17, color: '#34D399', phase: 'b' },
  { cx: 430, cy: 23, color: '#38BDF8', phase: 'a' },
  { cx: 480, cy: 26, color: '#EF4444', phase: 'b' },
  { cx: 530, cy: 20, color: '#FBBF24', phase: 'a' },
  { cx: 580, cy: 17, color: '#F472B6', phase: 'b' },
  { cx: 630, cy: 23, color: '#34D399', phase: 'a' },
  { cx: 680, cy: 27, color: '#38BDF8', phase: 'b' },
  { cx: 730, cy: 21, color: '#EF4444', phase: 'a' },
  { cx: 780, cy: 17, color: '#FBBF24', phase: 'b' },
  { cx: 830, cy: 23, color: '#34D399', phase: 'a' },
  { cx: 880, cy: 26, color: '#F472B6', phase: 'b' },
  { cx: 930, cy: 21, color: '#38BDF8', phase: 'a' },
  { cx: 980, cy: 17, color: '#EF4444', phase: 'b' },
  { cx: 1030, cy: 23, color: '#FBBF24', phase: 'a' },
  { cx: 1080, cy: 27, color: '#34D399', phase: 'b' },
  { cx: 1130, cy: 21, color: '#F472B6', phase: 'a' },
  { cx: 1175, cy: 17, color: '#38BDF8', phase: 'b' },
] as const;

const SNOWFLAKES = [
  { left: '4%', size: 13, duration: '11s', delay: '0s', opacity: 0.45 },
  { left: '11%', size: 10, duration: '14s', delay: '-3s', opacity: 0.35 },
  { left: '19%', size: 15, duration: '12s', delay: '-7s', opacity: 0.4 },
  { left: '27%', size: 11, duration: '15s', delay: '-2s', opacity: 0.32 },
  { left: '35%', size: 14, duration: '10.5s', delay: '-5s', opacity: 0.42 },
  { left: '44%', size: 10, duration: '13.5s', delay: '-8s', opacity: 0.3 },
  { left: '53%', size: 16, duration: '11.5s', delay: '-1s', opacity: 0.45 },
  { left: '61%', size: 11, duration: '14.5s', delay: '-6s', opacity: 0.34 },
  { left: '69%', size: 14, duration: '12.5s', delay: '-4s', opacity: 0.4 },
  { left: '77%', size: 10, duration: '15.5s', delay: '-9s', opacity: 0.32 },
  { left: '85%', size: 15, duration: '11s', delay: '-2.5s', opacity: 0.45 },
  { left: '93%', size: 12, duration: '13s', delay: '-5.5s', opacity: 0.38 },
] as const;

export function NewYearGarland() {
  return (
    <div
      aria-hidden="true"
      className="w-full h-9 bg-gradient-to-r from-[#0B251B] via-[#123828] to-[#0B251B] border-b border-amber-400/35 relative overflow-hidden select-none pointer-events-none"
    >
      <svg
        viewBox="0 0 1200 36"
        preserveAspectRatio="none"
        className="w-full h-full block"
      >
        {/* Evergreen pine garland swag wires */}
        <path
          d="M0,7 Q80,26 180,7 Q280,27 380,7 Q480,26 580,7 Q680,27 780,7 Q880,26 980,7 Q1080,27 1200,7"
          fill="none"
          stroke="#166534"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M0,7 Q80,26 180,7 Q280,27 380,7 Q480,26 580,7 Q680,27 780,7 Q880,26 980,7 Q1080,27 1200,7"
          fill="none"
          stroke="#064E3B"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />

        {/* Twinkling holiday bulbs */}
        {BULBS.map((b, i) => (
          <g key={i} style={{ color: b.color }}>
            <rect
              x={b.cx - 2.2}
              y={b.cy - 8}
              width="4.4"
              height="4"
              rx="1"
              fill="#D97706"
            />
            <ellipse
              cx={b.cx}
              cy={b.cy}
              rx="5.2"
              ry="7"
              fill={b.color}
              className={b.phase === 'a' ? 'ny-bulb-a' : 'ny-bulb-b'}
            />
            <circle cx={b.cx - 1.6} cy={b.cy - 2.2} r="1.4" fill="#FFFFFF" opacity="0.7" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function NewYearSnowOverlay() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-10 pointer-events-none overflow-hidden select-none"
    >
      {SNOWFLAKES.map((flake, idx) => (
        <span
          key={idx}
          className="ny-snowflake absolute -top-6 text-sky-400/80"
          style={{
            left: flake.left,
            fontSize: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: flake.duration,
            animationDelay: flake.delay,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
