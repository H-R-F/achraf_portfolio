import { useEffect, useRef } from 'react';

interface PortraitLogoProps {
  isDark?: boolean;
  size?: number;
  replayNonce?: number;
}

interface SketchStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  order: number;
  strength: number;
}

const PORTRAIT_URL = '/assets/aistudio/image_04b3caef.png';

/**
 * Compact 2D-canvas animated portrait-sketch logo derived from the user's photo.
 * Uses fine sparse contour strokes over a bright high-key portrait wash so facial
 * features stay crisp and never muddy or overly dark at small header sizes.
 */
export default function PortraitLogo({
  isDark = false,
  size = 40,
  replayNonce = 0,
}: PortraitLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDarkRef = useRef(isDark);
  const replayTriggerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    if (replayNonce > 0) {
      replayTriggerRef.current?.();
    }
  }, [replayNonce]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    let disposed = false;
    let rafId = 0;
    let strokes: SketchStroke[] = [];
    let underWashCanvas: HTMLCanvasElement | null = null;
    let startTime = performance.now();
    const durationMs = 1900;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = PORTRAIT_URL;

    const renderFrame = (now: number) => {
      if (disposed) return;

      const elapsed = now - startTime;
      const rawT = prefersReducedMotion ? 1 : Math.min(1, elapsed / durationMs);
      const progress = 1 - Math.pow(1 - rawT, 2.2);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const dark = isDarkRef.current;

      // Soft, luminous portrait wash fades in gently as lines draw
      if (underWashCanvas && progress > 0.2) {
        const washAlpha = Math.min(1, (progress - 0.2) / 0.8) * (dark ? 0.5 : 0.42);
        ctx.save();
        ctx.globalAlpha = washAlpha;
        ctx.drawImage(underWashCanvas, 0, 0, size, size);
        ctx.restore();
      }

      // Fine, crisp pen-line ink colors (airy, never muddy)
      const inkRgb = dark ? '242, 239, 232' : '30, 58, 138';
      const secondaryRgb = dark ? '130, 158, 255' : '72, 82, 108';
      const nibRgb = dark ? '224, 178, 130' : '180, 122, 66';

      ctx.lineCap = 'round';

      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        if (progress < s.order - 0.05) continue;

        const reveal = Math.min(1, Math.max(0, (progress - (s.order - 0.05)) / 0.07));
        const nib =
          progress < 0.96 ? Math.max(0, 1 - Math.abs(progress - s.order) / 0.055) : 0;

        const alpha = reveal * s.strength * (dark ? 0.86 : 0.72);
        if (alpha <= 0.02) continue;

        ctx.lineWidth = s.strength > 0.7 ? 0.8 : 0.55;
        if (nib > 0.25) {
          ctx.strokeStyle = `rgba(${nibRgb}, ${Math.min(0.95, alpha + 0.2)})`;
        } else if (s.strength > 0.72) {
          ctx.strokeStyle = `rgba(${inkRgb}, ${alpha})`;
        } else {
          ctx.strokeStyle = `rgba(${secondaryRgb}, ${alpha * 0.82})`;
        }

        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(
          s.x1 + (s.x2 - s.x1) * reveal,
          s.y1 + (s.y2 - s.y1) * reveal,
        );
        ctx.stroke();
      }

      if (rawT < 1 || isDarkRef.current !== dark) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    replayTriggerRef.current = () => {
      startTime = performance.now();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(renderFrame);
    };

    img.onload = () => {
      if (disposed) return;

      // Build a bright, clean monochrome portrait wash offscreen
      const washSize = Math.round(size * dpr);
      const wash = document.createElement('canvas');
      wash.width = washSize;
      wash.height = washSize;
      const wCtx = wash.getContext('2d');

      const sx = img.width * 0.16;
      const sy = img.height * 0.04;
      const sw = img.width * 0.68;
      const sh = img.height * 0.74;

      if (wCtx) {
        wCtx.filter = 'grayscale(100%) brightness(1.18) contrast(1.06)';
        wCtx.drawImage(img, sx, sy, sw, sh, 0, 0, washSize, washSize);
        wCtx.filter = 'none';
        underWashCanvas = wash;
      }

      // Extract sparse, clean facial contours (avoid dense overlapping fill strokes)
      const grid = 76;
      const off = document.createElement('canvas');
      off.width = grid;
      off.height = grid;
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, grid, grid);

      const { data } = offCtx.getImageData(0, 0, grid, grid);
      const lum = new Float32Array(grid * grid);
      const sat = new Float32Array(grid * grid);

      for (let i = 0; i < grid * grid; i++) {
        const r = data[i * 4] / 255;
        const g = data[i * 4 + 1] / 255;
        const b = data[i * 4 + 2] / 255;
        lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        sat[i] = mx > 0 ? (mx - mn) / mx : 0;
      }

      const nextStrokes: SketchStroke[] = [];
      const pad = 2;
      const drawArea = size - pad * 2;

      for (let y = 2; y < grid - 2; y += 2) {
        for (let x = 2; x < grid - 2; x += 2) {
          const idx = y * grid + x;
          const u = x / (grid - 1);
          const v = y / (grid - 1);

          const dx = (u - 0.5) / 0.38;
          const dy = (v - 0.48) / 0.45;
          if (Math.hypot(dx, dy) > 1.06) continue;

          const tl = lum[(y - 1) * grid + (x - 1)];
          const tc = lum[(y - 1) * grid + x];
          const tr = lum[(y - 1) * grid + (x + 1)];
          const ml = lum[y * grid + (x - 1)];
          const mr = lum[y * grid + (x + 1)];
          const bl = lum[(y + 1) * grid + (x - 1)];
          const bc = lum[(y + 1) * grid + x];
          const br = lum[(y + 1) * grid + (x + 1)];

          const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
          const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
          const edge = Math.min(1, Math.hypot(gx, gy) * 1.45);
          const l = lum[idx];

          // Skip smooth studio backdrop
          if (sat[idx] < 0.075 && l > 0.55 && edge < 0.22) continue;

          // Only draw crisp contour edges (no heavy dark interior fill)
          if (edge > 0.22) {
            const cx = pad + u * drawArea;
            const cy = pad + v * drawArea;
            const distFromEyes = Math.hypot(u - 0.5, v - 0.42);
            const order = Math.min(0.95, Math.max(0.02, distFromEyes * 1.55));
            const norm = Math.hypot(gx, gy) || 1;
            const tx = -gy / norm;
            const ty = gx / norm;
            const len = (0.85 + edge * 1.1) * (size / 40);

            nextStrokes.push({
              x1: cx - tx * len,
              y1: cy - ty * len,
              x2: cx + tx * len,
              y2: cy + ty * len,
              order,
              strength: Math.min(1, 0.35 + edge * 0.72),
            });
          }
        }
      }

      strokes = nextStrokes;
      startTime = performance.now();
      rafId = requestAnimationFrame(renderFrame);
    };

    const themeObserver = new MutationObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(renderFrame);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      replayTriggerRef.current = null;
    };
  }, [size]);

  return (
    <span
      onMouseEnter={() => replayTriggerRef.current?.()}
      className="relative inline-flex items-center justify-center rounded-full border border-line dark:border-line-dark bg-white dark:bg-[#1B1E28] overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="block"
      />
    </span>
  );
}
