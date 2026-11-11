// Reef Muncher: animated ocean artwork for the auth screens (pure SVG, no images).

function Fish({ x, y, color, cls, scale = 1 }) {
  return (
    <g className={`art-fish ${cls}`} style={{ transformBox: "fill-box" }}>
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <ellipse cx="0" cy="0" rx="34" ry="20" fill={color} stroke="#08334a" strokeWidth="3" />
        <polygon points="-30,0 -58,-18 -58,18" fill={color} stroke="#08334a" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="18" cy="-5" r="6" fill="#fff" stroke="#08334a" strokeWidth="2" />
        <circle cx="20" cy="-5" r="2.5" fill="#08334a" />
        <path d="M24 8 Q 30 12 34 8" fill="none" stroke="#08334a" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </g>
  );
}

export default function OceanArt() {
  const bubbles = [
    [80, 760, 10], [200, 800, 6], [330, 740, 14], [450, 820, 8],
    [560, 780, 12], [650, 750, 7], [140, 830, 9], [500, 700, 5],
  ];

  return (
    <div className="auth-art" aria-hidden="true">
      <svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C8F6FF" />
            <stop offset="0.25" stopColor="#3FD0DC" />
            <stop offset="0.55" stopColor="#11A5BC" />
            <stop offset="0.8" stopColor="#0A6C80" />
            <stop offset="1" stopColor="#053B4D" />
          </linearGradient>
          <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD45E" />
            <stop offset="1" stopColor="#F6A93B" />
          </linearGradient>
        </defs>

        <rect width="800" height="800" fill="url(#water)" />

        {/* light rays */}
        <polygon points="120,0 220,0 420,800 200,800" fill="#fff" opacity="0.08" />
        <polygon points="420,0 500,0 700,800 520,800" fill="#fff" opacity="0.06" />

        {/* wave crests */}
        <path className="art-wave" d="M-60 60 Q 40 20 140 60 T 340 60 T 540 60 T 740 60 T 940 60 V0 H-60Z" fill="#3FD0DC" />
        <path className="art-wave w2" d="M-60 40 Q 40 5 140 40 T 340 40 T 540 40 T 740 40 T 940 40 V0 H-60Z" fill="#fff" opacity="0.7" />

        {/* boat silhouette, top right */}
        <g transform="translate(610 22)" fill="#08334a" opacity="0.85">
          <path d="M0 20 H70 L58 38 H12 Z" />
          <rect x="34" y="0" width="3" height="20" />
          <polygon points="37,2 60,16 37,16" />
        </g>

        {/* fish */}
        <Fish x={120} y={300} color="#FF6B5A" cls="f1" />
        <Fish x={60} y={470} color="#FFD23F" cls="f2" scale={0.8} />
        <Fish x={160} y={620} color="#7B5CFF" cls="f3" scale={1.2} />

        {/* sand floor, seaweed, rocks */}
        <path d="M0 740 Q 200 700 400 735 T 800 725 V800 H0Z" fill="url(#sand)" />
        <g stroke="#2FCB7A" strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M90 745 q -18 -40 0 -80 q 18 -40 0 -70" />
          <path d="M130 750 q 18 -30 0 -60 q -14 -30 0 -50" />
          <path d="M660 740 q -18 -40 0 -80 q 18 -40 0 -70" />
        </g>
        <ellipse cx="300" cy="752" rx="46" ry="22" fill="#6b7f8a" stroke="#08334a" strokeWidth="3" />
        <ellipse cx="520" cy="760" rx="34" ry="16" fill="#8396a0" stroke="#08334a" strokeWidth="3" />

        {/* bubbles */}
        {bubbles.map(([cx, cy, r], i) => (
          <circle key={i} className="art-bubble" cx={cx} cy={cy} r={r} />
        ))}
      </svg>

      <div className="auth-art-title">Reef Muncher</div>
      <div className="auth-art-sub">Count the fish. Eat the safe one.</div>
    </div>
  );
}