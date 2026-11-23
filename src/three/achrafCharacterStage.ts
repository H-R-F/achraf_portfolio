import * as THREE from 'three';
import tposeUrl from '../assets/images/achraf_real_tpose_v2_1795220815883.jpg';
import heroUrl from '../assets/images/achraf_real_hero_1795220793681.jpg';
import analystUrl from '../assets/images/achraf_real_analyst_1795220793137.jpg';
import presentingUrl from '../assets/images/achraf_real_presenting_1795220794290.jpg';
import welcomeUrl from '../assets/images/achraf_real_welcome_v2_1795220815685.jpg';

export type CharacterPoseKey = 'tpose' | 'hero' | 'analyst' | 'presenting' | 'welcome';
export type StageSectionKey = 'hero' | 'about' | 'experience' | 'projects' | 'skills' | 'contact';

export const SECTION_POSES: Record<
  StageSectionKey,
  { key: CharacterPoseKey; flipX: boolean }
> = {
  hero: { key: 'hero', flipX: false },
  about: { key: 'hero', flipX: false },        // 2nd section: adopts Hero move facing right onto About
  experience: { key: 'presenting', flipX: true }, // 3rd section: right lane gesturing left onto Experience
  projects: { key: 'presenting', flipX: false },  // 4th section: left lane gesturing right onto Projects
  skills: { key: 'analyst', flipX: true },     // 5th section: right lane looking left onto Matrix
  contact: { key: 'welcome', flipX: false },   // 6th section: right lane warm wave greeting
};

export interface SectionLightPalette {
  key: string;
  fill: string;
  rim: string;
  kicker: string;
  beam: string;
  beamSecondary: string;
  ring: string;
}

export const SECTION_LIGHT_PALETTES: Record<StageSectionKey, SectionLightPalette> = {
  hero: {
    key: '#FFF1DE',
    fill: '#82A0FF',
    rim: '#E0B280',
    kicker: '#6D8EFF',
    beam: '#E8C294',
    beamSecondary: '#5B7CFA',
    ring: '#C4956A',
  },
  about: {
    // Classic warm tungsten portrait key + brass rim with cool lapis shadow fill
    key: '#FFF2E0',
    fill: '#7FA1FF',
    rim: '#E4B582',
    kicker: '#6B8EFF',
    beam: '#EDC89A',
    beamSecondary: '#4C6EF5',
    ring: '#CFA070',
  },
  experience: {
    // Broadcast stage clarity: crisp studio daylight key + electric cobalt rim vs copper kicker
    key: '#F4F7FF',
    fill: '#89A6FF',
    rim: '#6B8CFF',
    kicker: '#DDA16C',
    beam: '#7C9CFF',
    beamSecondary: '#D4A574',
    ring: '#6485F5',
  },
  projects: {
    // Architectural gallery contrast: luminous gold spotlight + deep sapphire rim
    key: '#FFEBD2',
    fill: '#7E9EFF',
    rim: '#5C7CFA',
    kicker: '#E8B884',
    beam: '#F2CFA0',
    beamSecondary: '#5C7CFA',
    ring: '#D4A574',
  },
  skills: {
    // Law (warm brass) × Systems (vivid cobalt) dual-split regulatory lighting
    key: '#EEF4FF',
    fill: '#84A3FF',
    rim: '#4C6EF5',
    kicker: '#DFAA74',
    beam: '#6384FA',
    beamSecondary: '#D4A574',
    ring: '#5B7CFA',
  },
  contact: {
    // Warm golden hospitality glow beside Contact frame
    key: '#FFF4E6',
    fill: '#94B0FF',
    rim: '#EAB882',
    kicker: '#82A0FF',
    beam: '#F2CE9C',
    beamSecondary: '#748FFC',
    ring: '#D4A574',
  },
};

export interface CharacterStageState {
  rootX: number;
  rootY: number;
  rootZ: number;
  rootRotY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  tiltZ: number;
  rimBoost: number;
  /** Key light horizontal direction (-1 = from left, +1 = from right) */
  lightSide: number;
  /** Studio spotlight intensity multiplier (0.7..1.4) */
  lightIntensity: number;
  /** Overall 3D stage opacity (0 in Hero video view -> 1 across scrolling sections) */
  stageOpacity: number;
  /** Damped scroll-velocity impulse (-1..1) for live scroll physics */
  scrollMotion: number;
}

export function createDefaultStageState(): CharacterStageState {
  return {
    rootX: 1.55,
    rootY: -1.18,
    rootZ: 0.25,
    rootRotY: -0.22,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    tiltZ: 0,
    rimBoost: 0.2,
    lightSide: 0.68,
    lightIntensity: 1.08,
    stageOpacity: 0,
    scrollMotion: 0,
  };
}

export interface AchrafStageHandle {
  group: THREE.Group;
  state: CharacterStageState;
  activeLightColors: {
    key: THREE.Color;
    rim: THREE.Color;
    fill: THREE.Color;
    beam: THREE.Color;
  };
  loadAllPoses: (onProgress?: (percent: number) => void) => Promise<void>;
  update: (elapsed: number, delta: number, pointerX: number, pointerY: number) => void;
  setSectionPose: (section: StageSectionKey, turnDirection?: number, instant?: boolean) => void;
  playIntroFromTPose: () => void;
  setTheme: (isDark: boolean) => void;
}

const POSE_URLS: Record<CharacterPoseKey, string> = {
  tpose: tposeUrl,
  hero: heroUrl,
  analyst: analystUrl,
  presenting: presentingUrl,
  welcome: welcomeUrl,
};

function loadHtmlImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const onAbort = () => {
      img.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    img.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Failed to load character image: ${src}`));
    };
    img.src = src;
  });
}

/**
 * Extracts a clean transparent character cutout from a flat neutral-grey studio
 * render using 4-border BFS flood fill + enclosed-loop neutral pocket cleanup,
 * edge feathering, and baseline alignment onto a 1024x1024 studio texture.
 */
function buildAlignedCharacterTexture(
  img: HTMLImageElement,
  maxAnisotropy: number,
  targetTexSize: number,
): THREE.CanvasTexture {
  // Preserve 100% native pixels from generated master for clean alpha matting
  const w = Math.max(1, img.naturalWidth || img.width);
  const h = Math.max(1, img.naturalHeight || img.height);

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return new THREE.CanvasTexture(workCanvas);
  }
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;

  // Sample average studio backdrop color from the 4 corners
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  const sampleBox = 10;
  const corners = [
    [0, 0],
    [w - sampleBox, 0],
    [0, h - sampleBox],
    [w - sampleBox, h - sampleBox],
  ];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < sampleBox; dy++) {
      for (let dx = 0; dx < sampleBox; dx++) {
        const idx = ((cy + dy) * w + (cx + dx)) * 4;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }
  }
  const bgR = sumR / Math.max(1, count);
  const bgG = sumG / Math.max(1, count);
  const bgB = sumB / Math.max(1, count);

  const visited = new Uint8Array(total);
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isNeutralBgPixel = (pIdx: number, maxDist: number, maxChroma: number) => {
    const o = pIdx * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const distSq = dr * dr + dg * dg + db * db;
    if (distSq > maxDist * maxDist) return false;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return maxC - minC <= maxChroma;
  };

  const enqueue = (pIdx: number) => {
    if (!visited[pIdx]) {
      visited[pIdx] = 1;
      queue[tail++] = pIdx;
    }
  };

  // Seed outer perimeter pixels
  for (let x = 0; x < w; x++) {
    if (isNeutralBgPixel(x, 46, 36)) enqueue(x);
    const bot = (h - 1) * w + x;
    if (isNeutralBgPixel(bot, 46, 36)) enqueue(bot);
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    if (isNeutralBgPixel(left, 46, 36)) enqueue(left);
    const right = y * w + (w - 1);
    if (isNeutralBgPixel(right, 46, 36)) enqueue(right);
  }

  // Border-connected BFS
  while (head < tail) {
    const p = queue[head++];
    isBg[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0 && !visited[p - 1] && isNeutralBgPixel(p - 1, 38, 32)) enqueue(p - 1);
    if (x < w - 1 && !visited[p + 1] && isNeutralBgPixel(p + 1, 38, 32)) enqueue(p + 1);
    if (y > 0 && !visited[p - w] && isNeutralBgPixel(p - w, 38, 32)) enqueue(p - w);
    if (y < h - 1 && !visited[p + w] && isNeutralBgPixel(p + w, 38, 32)) enqueue(p + w);
  }

  // Clear enclosed neutral-grey studio pockets (e.g. shadowed triangle inside bent elbow in Hero pose)
  const bgLum = (bgR + bgG + bgB) / 3;
  const bgTintBR = bgB - bgR;
  const isEnclosedNeutralPocket = (pIdx: number) => {
    const o = pIdx * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC > 24) return false;
    const lum = (r + g + b) / 3;
    // Exclude bright white cotton shirt & dark navy suit shadow
    if (lum < bgLum - 48 || lum > bgLum + 22) return false;
    return Math.abs((b - r) - bgTintBR) <= 14;
  };

  const pocketVisited = new Uint8Array(total);
  const compIndices = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    if (isBg[i] || pocketVisited[i]) continue;
    if (!isEnclosedNeutralPocket(i)) continue;

    let pHead = 0;
    let pTail = 0;
    pocketVisited[i] = 1;
    compIndices[pTail++] = i;

    while (pHead < pTail) {
      const p = compIndices[pHead++];
      const x = p % w;
      const y = (p - x) / w;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const n of neighbors) {
        if (
          n >= 0 &&
          !isBg[n] &&
          !pocketVisited[n] &&
          isEnclosedNeutralPocket(n)
        ) {
          pocketVisited[n] = 1;
          compIndices[pTail++] = n;
        }
      }
    }

    if (pTail >= 60) {
      for (let k = 0; k < pTail; k++) {
        isBg[compIndices[k]] = 1;
      }
    }
  }

  // Compute 1px and 2px border proximity masks for feathered halo-free matte decontamination
  const isRing1 = new Uint8Array(total);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (isBg[p]) continue;
      if (
        (x > 0 && isBg[p - 1]) ||
        (x < w - 1 && isBg[p + 1]) ||
        (y > 0 && isBg[p - w]) ||
        (y < h - 1 && isBg[p + w])
      ) {
        isRing1[p] = 1;
      }
    }
  }

  // Apply crisp anti-aliased edge alpha + exact background color unmixing (eliminates grey studio halo on dark mode)
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const o = p * 4;
      if (isBg[p]) {
        data[o + 3] = 0;
        continue;
      }

      const nearRing1 =
        !isRing1[p] &&
        ((x > 0 && isRing1[p - 1]) ||
          (x < w - 1 && isRing1[p + 1]) ||
          (y > 0 && isRing1[p - w]) ||
          (y < h - 1 && isRing1[p + w]));

      if (isRing1[p] || nearRing1) {
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const warmBias = chroma > 24 ? 0.14 : 0;

        const rawAlpha = isRing1[p]
          ? (dist - 12) / 38 + warmBias
          : (dist - 4) / 30 + 0.25 + warmBias;
        const edgeAlpha = Math.min(1, Math.max(0.02, rawAlpha));
        data[o + 3] = Math.round(edgeAlpha * 255);

        // True foreground color unmixing: C_fg = (C_obs - (1 - a) * C_bg) / a
        if (edgeAlpha < 0.98) {
          const denom = Math.max(edgeAlpha, 0.24);
          const bgContrib = 1 - edgeAlpha;
          data[o] = Math.min(255, Math.max(0, Math.round((r - bgContrib * bgR) / denom)));
          data[o + 1] = Math.min(255, Math.max(0, Math.round((g - bgContrib * bgG) / denom)));
          data[o + 2] = Math.min(255, Math.max(0, Math.round((b - bgContrib * bgB) / denom)));
        }
      } else {
        data[o + 3] = 255;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Measure upper-body horizontal centroid so waving/presenting arms never offset center
  const bodyH = Math.max(1, maxY - minY);
  const scanTop = Math.floor(minY + bodyH * 0.08);
  const scanBot = Math.floor(minY + bodyH * 0.58);
  let sumX = 0;
  let fgCount = 0;
  for (let y = scanTop; y <= scanBot; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!isBg[y * w + x]) {
        sumX += x;
        fgCount++;
      }
    }
  }
  const torsoCenterX = fgCount > 0 ? sumX / fgCount : (minX + maxX) * 0.5;

  // Render onto 4K/2K aligned studio texture with stepped high-quality upscaling & feet locked at bottom baseline
  const outSize = targetTexSize;
  const targetHeight = outSize * 0.85;
  const scale = targetHeight / bodyH;
  const drawW = w * scale;
  const drawH = h * scale;
  const dx = outSize * 0.5 - torsoCenterX * scale;
  const dy = outSize * 0.935 - maxY * scale;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outSize;
  outCanvas.height = outSize;
  const outCtx = outCanvas.getContext('2d');
  if (outCtx) {
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    if (scale > 1.8) {
      // Two-step high-resolution upscale preserves clean hairline & collar contours
      const midW = Math.round(w * 2);
      const midH = Math.round(h * 2);
      const midCanvas = document.createElement('canvas');
      midCanvas.width = midW;
      midCanvas.height = midH;
      const midCtx = midCanvas.getContext('2d');
      if (midCtx) {
        midCtx.imageSmoothingEnabled = true;
        midCtx.imageSmoothingQuality = 'high';
        midCtx.drawImage(workCanvas, 0, 0, midW, midH);
        outCtx.drawImage(midCanvas, dx, dy, drawW, drawH);
      } else {
        outCtx.drawImage(workCanvas, dx, dy, drawW, drawH);
      }
    } else {
      outCtx.drawImage(workCanvas, dx, dy, drawW, drawH);
    }
  }

  const texture = new THREE.CanvasTexture(outCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const CHARACTER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uBreath;
  uniform float uTurnLean;
  uniform vec2 uPointer;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Anchor shoes cleanly at floor baseline while upper torso breathes and turns in 2.5D
    float footPin = smoothstep(0.10, 0.28, uv.y);
    float upperMask = smoothstep(0.28, 0.74, uv.y);
    float headMask = smoothstep(0.56, 0.90, uv.y);

    pos.y += upperMask * uBreath * 0.011;
    pos.x *= 1.0 + sin(uv.y * 3.14159) * uBreath * 0.004;
    pos.x += headMask * uPointer.x * 0.024;
    pos.z += (uv.x - 0.5) * uPointer.x * headMask * 0.11;
    pos.z += footPin * (uv.x - 0.5) * uTurnLean * 0.24;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CHARACTER_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uFlip;
  uniform float uRimBoost;
  uniform float uLightSide;
  uniform float uLightIntensity;
  uniform float uIsDark;
  uniform float uTexelSize;
  uniform vec3 uKeyColor;
  uniform vec3 uFillColor;
  uniform vec3 uRimColor;
  uniform vec3 uKickerColor;
  uniform vec2 uPointer;
  varying vec2 vUv;

  vec4 samplePose(vec2 uv) {
    vec2 su = vec2(uFlip > 0.5 ? 1.0 - uv.x : uv.x, uv.y);
    return texture2D(uMap, su);
  }

  float lum(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec4 tex = samplePose(vUv);
    if (tex.a < 0.02 || uOpacity <= 0.005) discard;

    // Screen-space anti-aliased silhouette edge
    float edgeFw = max(fwidth(tex.a), 0.018);
    float smoothAlpha = smoothstep(0.06, 0.06 + edgeFw * 1.35, tex.a);

    // 4K Micro-Clarity unsharp filter preserving smooth skin & crisping eyes, hair, beard & blazer weave
    vec2 detailStep = vec2(uTexelSize * 1.45);
    vec3 cL = samplePose(vUv - vec2(detailStep.x, 0.0)).rgb;
    vec3 cR = samplePose(vUv + vec2(detailStep.x, 0.0)).rgb;
    vec3 cB = samplePose(vUv - vec2(0.0, detailStep.y)).rgb;
    vec3 cT = samplePose(vUv + vec2(0.0, detailStep.y)).rgb;
    vec3 localMean = (cL + cR + cB + cT) * 0.25;
    vec3 highFreq = tex.rgb - localMean;
    float edgeDetailMask = smoothstep(0.012, 0.075, length(highFreq)) * smoothstep(0.45, 0.95, tex.a);
    vec3 crispBase = clamp(tex.rgb + highFreq * (0.46 * edgeDetailMask), 0.0, 1.0);

    // Smooth surface normal from silhouette gradient + gentle fabric micro-relief
    vec2 px = vec2(0.0022);
    float aL = samplePose(vUv - vec2(px.x, 0.0)).a;
    float aR = samplePose(vUv + vec2(px.x, 0.0)).a;
    float aB = samplePose(vUv - vec2(0.0, px.y)).a;
    float aT = samplePose(vUv + vec2(0.0, px.y)).a;
    vec2 silGrad = vec2(aL - aR, aB - aT);

    vec2 normStep = vec2(uTexelSize * 3.0);
    float lL = lum(samplePose(vUv - vec2(normStep.x, 0.0)).rgb);
    float lR = lum(samplePose(vUv + vec2(normStep.x, 0.0)).rgb);
    float lB = lum(samplePose(vUv - vec2(0.0, normStep.y)).rgb);
    float lT = lum(samplePose(vUv + vec2(0.0, normStep.y)).rgb);
    vec2 microGrad = vec2(lL - lR, lB - lT) * 0.38;

    float bodyCurveX = (vUv.x - 0.5) * 0.85;
    vec3 normal = normalize(vec3(
      bodyCurveX + silGrad.x * 1.65 + microGrad.x,
      (vUv.y - 0.55) * 0.22 + silGrad.y * 1.3 + microGrad.y,
      0.92
    ));

    // Three-point + dual-split creative studio rig
    vec3 keyDir = normalize(vec3(uLightSide + uPointer.x * 0.3, 0.56 + uPointer.y * 0.2, 0.74));
    vec3 fillDir = normalize(vec3(-uLightSide * 0.85, 0.18, 0.65));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    float ndlKey = max(dot(normal, keyDir), 0.0);
    float ndlFill = max(dot(normal, fillDir), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.7);

    vec3 halfVec = normalize(keyDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 28.0) * 0.12;

    float edgeStrength = clamp(length(silGrad) * 1.48, 0.0, 1.0);
    vec2 rimDir2D = normalize(vec2(-uLightSide + uPointer.x * 0.32, 0.62));
    vec2 kickerDir2D = normalize(vec2(uLightSide + uPointer.x * 0.22, 0.48));
    float rimAlign = clamp(dot(normalize(-silGrad + vec2(0.0001)), rimDir2D), 0.0, 1.0);
    float kickerAlign = clamp(dot(normalize(-silGrad + vec2(0.0001)), kickerDir2D), 0.0, 1.0);

    // Overhead studio falloff favors upper torso/face + warm floor bounce lifts dark shoes & hems
    float overheadFalloff = mix(0.84, 1.06, smoothstep(0.14, 0.86, vUv.y));
    float floorBounce = (1.0 - smoothstep(0.02, 0.34, vUv.y)) * 0.14;

    float baseLuma = lum(crispBase);
    float highlightProtect = 1.0 - smoothstep(0.58, 0.92, baseLuma) * 0.55;

    float baseAmb = mix(0.86, 0.82, uIsDark) * overheadFalloff;
    vec3 lighting = vec3(baseAmb);
    lighting += uKeyColor * (ndlKey * 0.25 * uLightIntensity * highlightProtect);
    lighting += uFillColor * (ndlFill * 0.16 * highlightProtect);
    lighting += mix(uKeyColor, uRimColor, 0.5) * floorBounce;

    vec3 color = crispBase * lighting;
    color += uKeyColor * (spec * uLightIntensity * highlightProtect);
    color += uRimColor * ((edgeStrength * rimAlign * 0.34 + fresnel * 0.08) * (1.0 + uRimBoost * 0.88));
    color += uKickerColor * ((edgeStrength * kickerAlign * 0.22 + fresnel * 0.04) * (0.85 + uRimBoost * 0.5));

    gl_FragColor = vec4(color, smoothAlpha * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const STUDIO_BEAM_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STUDIO_BEAM_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBeamColor;
  uniform vec3 uBeamSecondary;
  uniform float uIntensity;
  uniform float uLightSide;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uIsDark;
  varying vec2 vUv;

  void main() {
    // Diagonal dual-tone volumetric spotlight cone + atmospheric edge scatter tracking pointer
    float beamAim = uLightSide * 0.22 + uPointer.x * 0.08;
    float topNarrow = mix(0.22, 0.62, 1.0 - vUv.y);
    float centerShift = 0.5 + (vUv.y - 0.5) * beamAim;
    float distX = abs(vUv.x - centerShift) / topNarrow;

    float coreCone = exp(-distX * distX * 3.8);
    float outerAura = exp(-distX * distX * 1.15);

    // Subtle atmospheric light shaft shimmer
    float rayBand = 0.92 + 0.08 * sin(vUv.x * 18.0 + uTime * 0.45 - vUv.y * 4.0);
    float vertFade = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.36, vUv.y);

    vec3 beamRgb = mix(uBeamSecondary, uBeamColor, clamp(coreCone * 1.35, 0.0, 1.0));
    float alpha = (coreCone * 0.22 + outerAura * 0.09) * vertFade * rayBand * uIntensity * mix(0.35, 1.0, uIsDark);

    gl_FragColor = vec4(beamRgb, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createCharacterPlaneMaterial(
  initialIsDark: boolean,
  initialTexelSize: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uOpacity: { value: 0 },
      uFlip: { value: 0 },
      uTime: { value: 0 },
      uBreath: { value: 0 },
      uTurnLean: { value: 0 },
      uRimBoost: { value: 0.16 },
      uLightSide: { value: -0.65 },
      uLightIntensity: { value: 1.0 },
      uIsDark: { value: initialIsDark ? 1 : 0 },
      uTexelSize: { value: initialTexelSize },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uKeyColor: { value: new THREE.Color(SECTION_LIGHT_PALETTES.about.key) },
      uFillColor: { value: new THREE.Color(SECTION_LIGHT_PALETTES.about.fill) },
      uRimColor: { value: new THREE.Color(SECTION_LIGHT_PALETTES.about.rim) },
      uKickerColor: { value: new THREE.Color(SECTION_LIGHT_PALETTES.about.kicker) },
    },
    vertexShader: CHARACTER_VERTEX_SHADER,
    fragmentShader: CHARACTER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    extensions: {
      derivatives: true,
    },
  });
}

export function createAchrafCharacterStage(
  renderer: THREE.WebGLRenderer,
  initialIsDark: boolean,
  abortSignal?: AbortSignal,
): AchrafStageHandle {
  const group = new THREE.Group();
  group.name = 'AchrafRealCharacterStage';

  const state = createDefaultStageState();
  const textures: Partial<Record<CharacterPoseKey, THREE.CanvasTexture>> = {};
  let currentIsDark = initialIsDark;

  // Direct PoseA -> PoseB smooth transition + Hero entry turn state
  let fromPose = { ...SECTION_POSES.hero };
  let toPose = { ...SECTION_POSES.hero };
  let poseBlend = 1;
  const poseTransitionSeconds = 0.56;
  let transitionTurnDir = 1;

  let entryTurnTimer = 10;
  const entryTurnDuration = 0.85;
  let loadedReady = false;
  let dampedScrollMotion = 0;

  // Active smoothly interpolated section light mood colors
  let targetPalette = SECTION_LIGHT_PALETTES.about;
  const liveKeyColor = new THREE.Color(targetPalette.key);
  const liveFillColor = new THREE.Color(targetPalette.fill);
  const liveRimColor = new THREE.Color(targetPalette.rim);
  const liveKickerColor = new THREE.Color(targetPalette.kicker);
  const liveBeamColor = new THREE.Color(targetPalette.beam);
  const liveBeamSecondary = new THREE.Color(targetPalette.beamSecondary);
  const liveRingColor = new THREE.Color(targetPalette.ring);

  const tmpTargetKey = new THREE.Color();
  const tmpTargetFill = new THREE.Color();
  const tmpTargetRim = new THREE.Color();
  const tmpTargetKicker = new THREE.Color();
  const tmpTargetBeam = new THREE.Color();
  const tmpTargetBeamSec = new THREE.Color();
  const tmpTargetRing = new THREE.Color();

  // Grounding: illuminated studio floor light pool + radial contact shadow + architectural ring
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = 256;
  poolCanvas.height = 256;
  const pCtx = poolCanvas.getContext('2d');
  if (pCtx) {
    const grad = pCtx.createRadialGradient(128, 128, 10, 128, 128, 124);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(0.45, 'rgba(220, 220, 235, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 256, 256);
  }
  const poolTex = new THREE.CanvasTexture(poolCanvas);
  const floorPoolMat = new THREE.MeshBasicMaterial({
    map: poolTex,
    color: liveBeamColor,
    transparent: true,
    depthWrite: false,
    opacity: initialIsDark ? 0.36 : 0.22,
  });
  const floorPool = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    floorPoolMat,
  );
  floorPool.rotation.x = -Math.PI / 2;
  floorPool.position.y = 0.002;
  group.add(floorPool);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: initialIsDark ? 0.72 : 0.4,
  });
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 0.78),
    contactShadowMat,
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.005;
  group.add(contactShadow);

  const floorRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(initialIsDark ? '#C4956A' : '#1E3A8A'),
    transparent: true,
    opacity: 0.34,
  });
  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.538, 64),
    floorRingMat,
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.008;
  group.add(floorRing);

  // Inner studio floor sheen
  const floorDiscMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(initialIsDark ? '#C4956A' : '#1E3A8A'),
    transparent: true,
    opacity: initialIsDark ? 0.08 : 0.045,
    depthWrite: false,
  });
  const floorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 48),
    floorDiscMat,
  );
  floorDisc.rotation.x = -Math.PI / 2;
  floorDisc.position.y = 0.006;
  group.add(floorDisc);

  // Volumetric overhead dual-tone studio spotlight cone behind Achraf
  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uBeamColor: { value: liveBeamColor.clone() },
      uBeamSecondary: { value: liveBeamSecondary.clone() },
      uIntensity: { value: 1.0 },
      uLightSide: { value: 0.68 },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uIsDark: { value: initialIsDark ? 1 : 0 },
    },
    vertexShader: STUDIO_BEAM_VERTEX_SHADER,
    fragmentShader: STUDIO_BEAM_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const studioBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 3.8),
    beamMat,
  );
  studioBeam.position.set(0, 1.78, -0.22);
  studioBeam.renderOrder = 1;
  group.add(studioBeam);

  // Dual cross-fading WebGL character layers anchored cleanly so shoes touch y = 0
  // Texture feet baseline is at 6.5% from bottom of a 2.86m plane (0.186m)
  const planeSize = 2.86;
  const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);

  const stagePivot = new THREE.Group();
  stagePivot.position.set(0, planeSize * 0.5 - planeSize * 0.065, 0);
  group.add(stagePivot);

  const maxTexSize = renderer.capabilities.maxTextureSize || 2048;
  const targetTexSize = maxTexSize >= 4096 ? 4096 : 2048;
  const texelSize = 1 / targetTexSize;

  const matA = createCharacterPlaneMaterial(initialIsDark, texelSize);
  const meshA = new THREE.Mesh(planeGeo, matA);
  meshA.renderOrder = 2;
  stagePivot.add(meshA);

  const matB = createCharacterPlaneMaterial(initialIsDark, texelSize);
  const meshB = new THREE.Mesh(planeGeo, matB);
  meshB.position.z = 0.008;
  meshB.renderOrder = 3;
  stagePivot.add(meshB);

  const loadAllPoses = async (onProgress?: (percent: number) => void) => {
    const entries = Object.entries(POSE_URLS) as [CharacterPoseKey, string][];
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    let done = 0;

    await Promise.all(
      entries.map(async ([key, url]) => {
        const img = await loadHtmlImage(url, abortSignal);
        if (abortSignal?.aborted) return;
        textures[key] = buildAlignedCharacterTexture(img, maxAnisotropy, targetTexSize);
        done++;
        onProgress?.(Math.round((done / entries.length) * 100));
      }),
    );

    if (!abortSignal?.aborted) {
      loadedReady = true;
    }
  };

  const setSectionPose = (
    section: StageSectionKey,
    turnDirection = 1,
    instant = false,
  ) => {
    targetPalette = SECTION_LIGHT_PALETTES[section];
    if (instant) {
      liveKeyColor.set(targetPalette.key);
      liveFillColor.set(targetPalette.fill);
      liveRimColor.set(targetPalette.rim);
      liveKickerColor.set(targetPalette.kicker);
      liveBeamColor.set(targetPalette.beam);
      liveBeamSecondary.set(targetPalette.beamSecondary);
      liveRingColor.set(targetPalette.ring);
    }

    const next = SECTION_POSES[section];
    if (instant) {
      fromPose = { ...next };
      toPose = { ...next };
      poseBlend = 1;
      transitionTurnDir = turnDirection;
      return;
    }

    if (toPose.key === next.key && toPose.flipX === next.flipX) {
      return;
    }

    // Snapshot dominant active pose as starting frame so rapid section jumps never flash unrelated poses
    fromPose = poseBlend >= 0.5 ? { ...toPose } : { ...fromPose };
    toPose = { ...next };
    poseBlend = 0;
    transitionTurnDir = turnDirection >= 0 ? 1 : -1;
  };

  const playIntroFromTPose = () => {
    fromPose = { ...SECTION_POSES.about };
    toPose = { ...SECTION_POSES.about };
    poseBlend = 1;
    entryTurnTimer = 0;
  };

  const setTheme = (isDark: boolean) => {
    currentIsDark = isDark;
    const vis = THREE.MathUtils.clamp(state.stageOpacity, 0, 1);
    contactShadowMat.opacity = (isDark ? 0.78 : 0.4) * vis;
    floorPoolMat.opacity = (isDark ? 0.36 : 0.22) * vis;
    floorRingMat.opacity = 0.28 * vis;
    floorDiscMat.opacity = (isDark ? 0.06 : 0.045) * vis;
    matA.uniforms.uIsDark.value = isDark ? 1 : 0;
    matB.uniforms.uIsDark.value = isDark ? 1 : 0;
    beamMat.uniforms.uIsDark.value = isDark ? 1 : 0;
  };

  const update = (
    elapsed: number,
    delta: number,
    pointerX: number,
    pointerY: number,
  ) => {
    if (!loadedReady) return;

    const vis = THREE.MathUtils.clamp(state.stageOpacity, 0, 1);
    group.visible = vis > 0.004;
    if (!group.visible) return;

    entryTurnTimer += delta;
    if (poseBlend < 1) {
      poseBlend = Math.min(1, poseBlend + delta / poseTransitionSeconds);
    }

    // Smoothly decay & damp scroll momentum for alive motion
    dampedScrollMotion = THREE.MathUtils.damp(
      dampedScrollMotion,
      state.scrollMotion,
      7.5,
      delta,
    );
    state.scrollMotion = THREE.MathUtils.damp(state.scrollMotion, 0, 6.0, delta);

    const breath = Math.sin(elapsed * 2.0);
    const sway = Math.sin(elapsed * 0.9) * 0.022;

    // Smooth S-curve crossfade directly from fromPose -> toPose
    const frac = poseBlend * poseBlend * (3 - 2 * poseBlend);
    const samePose =
      fromPose.key === toPose.key && fromPose.flipX === toPose.flipX;

    const texA = textures[fromPose.key] ?? null;
    const texB = textures[toPose.key] ?? null;

    if (samePose) {
      matA.uniforms.uMap.value = texB;
      matA.uniforms.uFlip.value = toPose.flipX ? 1 : 0;
      matA.uniforms.uOpacity.value = vis;
      matB.uniforms.uMap.value = null;
      matB.uniforms.uOpacity.value = 0;
    } else {
      matA.uniforms.uMap.value = texA;
      matA.uniforms.uFlip.value = fromPose.flipX ? 1 : 0;
      matA.uniforms.uOpacity.value = (1 - frac) * vis;
      matB.uniforms.uMap.value = texB;
      matB.uniforms.uFlip.value = toPose.flipX ? 1 : 0;
      matB.uniforms.uOpacity.value = frac * vis;
    }

    // Hero turn-in kick when descending into #about + directional 3D arc during section transitions
    let entryTurn = 0;
    let entryScaleMul = 1;
    if (entryTurnTimer < entryTurnDuration) {
      const et = entryTurnTimer / entryTurnDuration;
      const easeOut = 1 - Math.pow(1 - et, 3);
      entryTurn = (1 - easeOut) * -0.44;
      entryScaleMul = 0.95 + 0.05 * easeOut;
    }

    const transitionTurn = samePose
      ? 0
      : Math.sin(frac * Math.PI) * 0.24 * transitionTurnDir;
    const transitionDepthArc = samePose ? 0 : Math.sin(frac * Math.PI) * 0.14;

    group.position.set(
      state.rootX + state.offsetX,
      state.rootY + state.offsetY - dampedScrollMotion * 0.028,
      state.rootZ + transitionDepthArc,
    );
    group.scale.setScalar(state.scale * entryScaleMul);
    group.rotation.y =
      state.rootRotY + sway + entryTurn + transitionTurn + pointerX * 0.16;
    group.rotation.x = pointerY * 0.045 + dampedScrollMotion * 0.025;
    group.rotation.z = state.tiltZ - dampedScrollMotion * 0.022;

    // Smoothly interpolate creative lighting mood per section
    const colorLerp = Math.min(1, delta * 3.8);
    liveKeyColor.lerp(tmpTargetKey.set(targetPalette.key), colorLerp);
    liveFillColor.lerp(tmpTargetFill.set(targetPalette.fill), colorLerp);
    liveRimColor.lerp(tmpTargetRim.set(targetPalette.rim), colorLerp);
    liveKickerColor.lerp(tmpTargetKicker.set(targetPalette.kicker), colorLerp);
    liveBeamColor.lerp(tmpTargetBeam.set(targetPalette.beam), colorLerp);
    liveBeamSecondary.lerp(tmpTargetBeamSec.set(targetPalette.beamSecondary), colorLerp);
    liveRingColor.lerp(tmpTargetRing.set(targetPalette.ring), colorLerp);

    // Synchronize dynamic lighting, 2.5D skeletal turn lean & shader uniforms
    const activeTurnLean = entryTurn + transitionTurn - dampedScrollMotion * 0.22;

    matA.uniforms.uTime.value = elapsed;
    matA.uniforms.uBreath.value = breath;
    matA.uniforms.uTurnLean.value = activeTurnLean;
    matA.uniforms.uRimBoost.value = state.rimBoost;
    matA.uniforms.uLightSide.value = state.lightSide;
    matA.uniforms.uLightIntensity.value = state.lightIntensity;
    (matA.uniforms.uKeyColor.value as THREE.Color).copy(liveKeyColor);
    (matA.uniforms.uFillColor.value as THREE.Color).copy(liveFillColor);
    (matA.uniforms.uRimColor.value as THREE.Color).copy(liveRimColor);
    (matA.uniforms.uKickerColor.value as THREE.Color).copy(liveKickerColor);
    (matA.uniforms.uPointer.value as THREE.Vector2).set(pointerX, pointerY);

    matB.uniforms.uTime.value = elapsed;
    matB.uniforms.uBreath.value = breath;
    matB.uniforms.uTurnLean.value = activeTurnLean;
    matB.uniforms.uRimBoost.value = state.rimBoost;
    matB.uniforms.uLightSide.value = state.lightSide;
    matB.uniforms.uLightIntensity.value = state.lightIntensity;
    (matB.uniforms.uKeyColor.value as THREE.Color).copy(liveKeyColor);
    (matB.uniforms.uFillColor.value as THREE.Color).copy(liveFillColor);
    (matB.uniforms.uRimColor.value as THREE.Color).copy(liveRimColor);
    (matB.uniforms.uKickerColor.value as THREE.Color).copy(liveKickerColor);
    (matB.uniforms.uPointer.value as THREE.Vector2).set(pointerX, pointerY);

    (beamMat.uniforms.uBeamColor.value as THREE.Color).copy(liveBeamColor);
    (beamMat.uniforms.uBeamSecondary.value as THREE.Color).copy(liveBeamSecondary);
    beamMat.uniforms.uTime.value = elapsed;
    beamMat.uniforms.uIntensity.value =
      state.lightIntensity * (0.92 + breath * 0.08) * vis;
    beamMat.uniforms.uLightSide.value = state.lightSide;
    (beamMat.uniforms.uPointer.value as THREE.Vector2).set(pointerX, pointerY);

    floorPoolMat.color.copy(liveBeamColor);
    floorRingMat.color.copy(liveRingColor);
    floorDiscMat.color.copy(liveRingColor);

    contactShadowMat.opacity = (currentIsDark ? 0.78 : 0.4) * vis;
    floorPoolMat.opacity = (currentIsDark ? 0.34 : 0.22) * vis;
    floorRingMat.opacity = 0.3 * vis;
    floorDiscMat.opacity = (currentIsDark ? 0.065 : 0.045) * vis;

    floorRing.rotation.z = elapsed * 0.18 + dampedScrollMotion * 0.12;
    floorPool.position.x = -state.lightSide * 0.08 + pointerX * 0.04;
    floorPool.scale.setScalar(0.95 + state.lightIntensity * 0.08 + breath * 0.02);
  };

  return {
    group,
    state,
    activeLightColors: {
      key: liveKeyColor,
      rim: liveRimColor,
      fill: liveFillColor,
      beam: liveBeamColor,
    },
    loadAllPoses,
    update,
    setSectionPose,
    playIntroFromTPose,
    setTheme,
  };
}
