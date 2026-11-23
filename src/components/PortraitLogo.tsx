import { useEffect, useState } from 'react';

interface PortraitLogoProps {
  isDark?: boolean;
  size?: number;
  replayNonce?: number;
}

const PORTRAIT_URL = '/assets/aistudio/image_04b3caef.png';

/**
 * Crisp full-color circular face emblem in the navigation bar.
 * Tightly frames Achraf's portrait with an obsidian edge vignette and an
 * animated architectural perimeter trace on mount and hover without obscuring facial detail.
 */
export default function PortraitLogo({
  size = 42,
  replayNonce = 0,
}: PortraitLogoProps) {
  const [traceKey, setTraceKey] = useState(0);

  useEffect(() => {
    if (replayNonce > 0) {
      setTraceKey((k) => k + 1);
    }
  }, [replayNonce]);

  const strokeWidth = 1.75;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      onMouseEnter={() => setTraceKey((k) => k + 1)}
      className="group relative inline-flex items-center justify-center rounded-full bg-[#12141A] border border-white/20 overflow-hidden shrink-0 shadow-[0_0_20px_-6px_rgba(196,149,106,0.45)]"
      style={{ width: size, height: size }}
    >
      <img
        src={PORTRAIT_URL}
        alt="Achraf Ben Sabir"
        loading="eager"
        decoding="async"
        className="w-full h-full object-cover object-top scale-[1.24] origin-[50%_22%] brightness-[1.03] contrast-[1.06] saturate-[1.05] transition-transform duration-300 group-hover:scale-[1.3]"
      />

      {/* Subtle dark studio edge vignette melting frame edges into the obsidian header */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,transparent_54%,rgba(10,11,14,0.58)_100%)]"
      />

      {/* Architectural warm-amber perimeter ring trace */}
      <svg
        key={traceKey}
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#portraitRingGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            animation: 'portraitRingTrace 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        />
        <defs>
          <linearGradient id="portraitRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4A574" />
            <stop offset="100%" stopColor="#4C6EF5" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
