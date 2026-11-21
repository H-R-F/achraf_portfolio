import * as THREE from 'three';
import tposeUrl from '../assets/images/achraf_real_tpose_v2_1795220815883.jpg';
import heroUrl from '../assets/images/achraf_real_hero_1795220793681.jpg';
import analystUrl from '../assets/images/achraf_real_analyst_1795220793137.jpg';
import presentingUrl from '../assets/images/achraf_real_presenting_1795220794290.jpg';
import welcomeUrl from '../assets/images/achraf_real_welcome_v2_1795220815685.jpg';

export type CharacterPoseKey = 'tpose' | 'hero' | 'analyst' | 'presenting' | 'welcome';

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
  /** Continuous timeline slot: 0..4 (about=hero -> experience -> projects -> skills -> contact) */
  poseSlot: number;
  /** Overall 3D stage opacity (0 in Hero video view -> 1 across scrolling sections) */
  stageOpacity: number;
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
    rimBoost: 0.16,
    lightSide: -0.65,
    lightIntensity: 1.0,
    poseSlot: 0,
    stageOpacity: 0,
  };
}

export interface AchrafStageHandle {
  group: THREE.Group;
  state: CharacterStageState;
  loadAllPoses: (onProgress?: (percent: number) => void) => Promise<void>;
  update: (elapsed: number, delta: number, pointerX: number, pointerY: number) => void;
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

const SCROLL_SEQUENCE: { key: CharacterPoseKey; flipX: boolean }[] = [
  { key: 'hero', flipX: false },       // 0: Hero standby & About / 2nd section (takes Hero move: upright stance on left lane)
  { key: 'presenting', flipX: true },  // 1: Experience / 3rd section (right lane, gestures left toward content)
  { key: 'presenting', flipX: false }, // 2: Projects / 4th section (left lane, gestures right toward content)
  { key: 'analyst', flipX: true },     // 3: Skills / 5th section (right lane, flipped left to analyze regulatory matrix)
  { key: 'welcome', flipX: false },    // 4: Contact / 6th section (right lane, warm greeting wave)
];

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
    if (isNeutralBgPixel(x, 42, 38)) enqueue(x);
    const bot = (h - 1) * w + x;
    if (isNeutralBgPixel(bot, 42, 38)) enqueue(bot);
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    if (isNeutralBgPixel(left, 42, 38)) enqueue(left);
    const right = y * w + (w - 1);
    if (isNeutralBgPixel(right, 42, 38)) enqueue(right);
  }

  // Border-connected BFS
  while (head < tail) {
    const p = queue[head++];
    isBg[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0 && !visited[p - 1] && isNeutralBgPixel(p - 1, 38, 36)) enqueue(p - 1);
    if (x < w - 1 && !visited[p + 1] && isNeutralBgPixel(p + 1, 38, 36)) enqueue(p + 1);
    if (y > 0 && !visited[p - w] && isNeutralBgPixel(p - w, 38, 36)) enqueue(p - w);
    if (y < h - 1 && !visited[p + w] && isNeutralBgPixel(p + w, 38, 36)) enqueue(p + w);
  }

  // Also clear enclosed neutral-grey pockets matching backdrop slate hue (e.g. elbow gap)
  const bgTintBR = bgB - bgR;
  const pocketVisited = new Uint8Array(total);
  const compIndices = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    if (isBg[i] || pocketVisited[i]) continue;
    if (!isNeutralBgPixel(i, 18, 28)) continue;
    const o0 = i * 4;
    if (Math.abs((data[o0 + 2] - data[o0]) - bgTintBR) > 12) continue;

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
          isNeutralBgPixel(n, 22, 30) &&
          Math.abs((data[n * 4 + 2] - data[n * 4]) - bgTintBR) <= 14
        ) {
          pocketVisited[n] = 1;
          compIndices[pTail++] = n;
        }
      }
    }

    if (pTail >= 85) {
      for (let k = 0; k < pTail; k++) {
        isBg[compIndices[k]] = 1;
      }
    }
  }

  // Apply crisp anti-aliased edge alpha + halo-free decontamination
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

      let bgNeighbors = 0;
      if (x > 0 && isBg[p - 1]) bgNeighbors++;
      if (x < w - 1 && isBg[p + 1]) bgNeighbors++;
      if (y > 0 && isBg[p - w]) bgNeighbors++;
      if (y < h - 1 && isBg[p + w]) bgNeighbors++;

      if (bgNeighbors > 0) {
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        const edgeAlpha = Math.min(1, Math.max(0.12, (dist - 16) / 34));
        data[o + 3] = Math.round(edgeAlpha * 255);
        // Gentle edge spill suppression toward luminance-matched subject tone (no orange/blue overshoot)
        if (edgeAlpha < 0.96) {
          const pull = Math.min(0.45, (1 - edgeAlpha) * 0.55);
          const avg = (r + g + b) / 3;
          data[o] = Math.min(255, Math.max(0, Math.round(r - (bgR - avg) * pull * 0.35)));
          data[o + 1] = Math.min(255, Math.max(0, Math.round(g - (bgG - avg) * pull * 0.35)));
          data[o + 2] = Math.min(255, Math.max(0, Math.round(b - (bgB - avg) * pull * 0.35)));
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
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Subtle living chest breathing & shoulder settle
    float upperMask = smoothstep(0.28, 0.72, uv.y);
    pos.y += upperMask * uBreath * 0.012;
    pos.x *= 1.0 + sin(uv.y * 3.14159) * uBreath * 0.004;
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
    float edgeFw = max(fwidth(tex.a), 0.02);
    float smoothAlpha = smoothstep(0.08, 0.08 + edgeFw * 1.4, tex.a);

    // 4K Micro-Clarity unsharp filter preserving smooth skin & crisping eyes, hair, beard & blazer weave
    vec2 detailStep = vec2(uTexelSize * 1.5);
    vec3 cL = samplePose(vUv - vec2(detailStep.x, 0.0)).rgb;
    vec3 cR = samplePose(vUv + vec2(detailStep.x, 0.0)).rgb;
    vec3 cB = samplePose(vUv - vec2(0.0, detailStep.y)).rgb;
    vec3 cT = samplePose(vUv + vec2(0.0, detailStep.y)).rgb;
    vec3 localMean = (cL + cR + cB + cT) * 0.25;
    vec3 highFreq = tex.rgb - localMean;
    float edgeDetailMask = smoothstep(0.012, 0.075, length(highFreq)) * smoothstep(0.45, 0.95, tex.a);
    vec3 crispBase = clamp(tex.rgb + highFreq * (0.48 * edgeDetailMask), 0.0, 1.0);

    // Smooth surface normal from silhouette gradient + gentle fabric micro-relief (no noisy bumps on skin)
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
    vec2 microGrad = vec2(lL - lR, lB - lT) * 0.42;

    float bodyCurveX = (vUv.x - 0.5) * 0.85;
    vec3 normal = normalize(vec3(
      bodyCurveX + silGrad.x * 1.65 + microGrad.x,
      (vUv.y - 0.55) * 0.22 + silGrad.y * 1.3 + microGrad.y,
      0.92
    ));

    // Studio three-point light rig directions
    vec3 keyDir = normalize(vec3(uLightSide + uPointer.x * 0.28, 0.52 + uPointer.y * 0.2, 0.72));
    vec3 fillDir = normalize(vec3(-uLightSide * 0.85, 0.18, 0.65));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    float ndlKey = max(dot(normal, keyDir), 0.0);
    float ndlFill = max(dot(normal, fillDir), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);

    vec3 halfVec = normalize(keyDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 26.0) * 0.14;

    float edgeStrength = clamp(length(silGrad) * 1.45, 0.0, 1.0);
    vec2 rimDir2D = normalize(vec2(-uLightSide + uPointer.x * 0.35, 0.65));
    float rimAlign = clamp(dot(normalize(-silGrad + vec2(0.0001)), rimDir2D), 0.0, 1.0);

    float baseAmb = mix(0.89, 0.84, uIsDark);
    vec3 lighting = vec3(baseAmb);
    lighting += uKeyColor * (ndlKey * 0.24 * uLightIntensity);
    lighting += uFillColor * (ndlFill * 0.18);

    vec3 color = crispBase * lighting;
    color += uKeyColor * spec * uLightIntensity;
    color += uRimColor * ((edgeStrength * rimAlign * 0.30 + fresnel * 0.10) * (1.0 + uRimBoost * 0.85));

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
  uniform float uIntensity;
  uniform float uLightSide;
  uniform float uIsDark;
  varying vec2 vUv;

  void main() {
    // Diagonal overhead studio spotlight cone sweeping down onto the character
    float topNarrow = mix(0.28, 0.56, 1.0 - vUv.y);
    float centerShift = 0.5 + (vUv.y - 0.5) * uLightSide * 0.18;
    float distX = abs(vUv.x - centerShift) / topNarrow;
    float cone = exp(-distX * distX * 2.6);

    float vertFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.42, vUv.y);
    float alpha = cone * vertFade * uIntensity * mix(0.08, 0.2, uIsDark);

    gl_FragColor = vec4(uBeamColor, alpha);
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
      uRimBoost: { value: 0.16 },
      uLightSide: { value: -0.65 },
      uLightIntensity: { value: 1.0 },
      uIsDark: { value: initialIsDark ? 1 : 0 },
      uTexelSize: { value: initialTexelSize },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uKeyColor: { value: new THREE.Color('#FFF1DE') },
      uFillColor: { value: new THREE.Color('#9BB4FF') },
      uRimColor: {
        value: new THREE.Color(initialIsDark ? '#D4A574' : '#3B5BDB'),
      },
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

  // Intro T-Pose -> Hero Stance reveal timer (triggered when entering 2nd section)
  let introTimer = 10;
  const introHoldSeconds = 0.36;
  const introMorphSeconds = 0.92;
  let loadedReady = false;

  // Grounding: illuminated studio floor light pool + radial contact shadow + architectural ring
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = 256;
  poolCanvas.height = 256;
  const pCtx = poolCanvas.getContext('2d');
  if (pCtx) {
    const grad = pCtx.createRadialGradient(128, 128, 10, 128, 128, 124);
    grad.addColorStop(0, 'rgba(255, 240, 218, 0.42)');
    grad.addColorStop(0.45, 'rgba(196, 149, 106, 0.16)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 256, 256);
  }
  const poolTex = new THREE.CanvasTexture(poolCanvas);
  const floorPoolMat = new THREE.MeshBasicMaterial({
    map: poolTex,
    transparent: true,
    depthWrite: false,
    opacity: initialIsDark ? 0.55 : 0.22,
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
    new THREE.PlaneGeometry(1.45, 1.45),
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

  // Volumetric overhead studio spotlight cone behind Achraf
  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uBeamColor: { value: new THREE.Color(initialIsDark ? '#E6C29F' : '#4C6EF5') },
      uIntensity: { value: 1.0 },
      uLightSide: { value: -0.65 },
      uIsDark: { value: initialIsDark ? 1 : 0 },
    },
    vertexShader: STUDIO_BEAM_VERTEX_SHADER,
    fragmentShader: STUDIO_BEAM_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const studioBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 3.6),
    beamMat,
  );
  studioBeam.position.set(0, 1.75, -0.22);
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

  const playIntroFromTPose = () => {
    introTimer = 0;
  };

  const setTheme = (isDark: boolean) => {
    currentIsDark = isDark;
    const vis = THREE.MathUtils.clamp(state.stageOpacity, 0, 1);
    contactShadowMat.opacity = (isDark ? 0.72 : 0.4) * vis;
    floorPoolMat.opacity = (isDark ? 0.55 : 0.22) * vis;
    floorRingMat.color.set(isDark ? '#C4956A' : '#1E3A8A');
    floorRingMat.opacity = 0.34 * vis;
    floorDiscMat.color.set(isDark ? '#C4956A' : '#1E3A8A');
    floorDiscMat.opacity = (isDark ? 0.08 : 0.045) * vis;
    const rim = isDark ? '#D4A574' : '#3B5BDB';
    const key = isDark ? '#FFF1DE' : '#FFFDF8';
    const fill = isDark ? '#9BB4FF' : '#93B4FF';
    const beam = isDark ? '#E6C29F' : '#4C6EF5';
    (matA.uniforms.uRimColor.value as THREE.Color).set(rim);
    (matB.uniforms.uRimColor.value as THREE.Color).set(rim);
    (matA.uniforms.uKeyColor.value as THREE.Color).set(key);
    (matB.uniforms.uKeyColor.value as THREE.Color).set(key);
    (matA.uniforms.uFillColor.value as THREE.Color).set(fill);
    (matB.uniforms.uFillColor.value as THREE.Color).set(fill);
    matA.uniforms.uIsDark.value = isDark ? 1 : 0;
    matB.uniforms.uIsDark.value = isDark ? 1 : 0;
    (beamMat.uniforms.uBeamColor.value as THREE.Color).set(beam);
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

    introTimer += delta;
    const breath = Math.sin(elapsed * 2.0);
    const sway = Math.sin(elapsed * 0.9) * 0.022;

    // Resolve active scroll pose pair (floor -> ceil)
    const clampedSlot = THREE.MathUtils.clamp(
      state.poseSlot,
      0,
      SCROLL_SEQUENCE.length - 1,
    );
    const idxA = Math.floor(clampedSlot);
    const idxB = Math.min(SCROLL_SEQUENCE.length - 1, idxA + 1);
    const rawFrac = clampedSlot - idxA;
    // Smooth S-curve crossfade concentrated across middle of transition
    const frac = rawFrac * rawFrac * (3 - 2 * rawFrac);

    const stageA = SCROLL_SEQUENCE[idxA];
    const stageB = SCROLL_SEQUENCE[idxB];
    const scrollTexA = textures[stageA.key] ?? null;
    const scrollTexB = textures[stageB.key] ?? null;

    // Intro T-pose reveal blends into active scroll pose
    let tposeWeight = 0;
    if (introTimer < introHoldSeconds) {
      tposeWeight = 1;
    } else if (introTimer < introHoldSeconds + introMorphSeconds) {
      const t = (introTimer - introHoldSeconds) / introMorphSeconds;
      const ease = 1 - Math.pow(1 - t, 3);
      tposeWeight = 1 - ease;
    }

    if (tposeWeight > 0.005 && textures.tpose) {
      matA.uniforms.uMap.value = textures.tpose;
      matA.uniforms.uFlip.value = 0;
      matA.uniforms.uOpacity.value = tposeWeight * vis;
      matB.uniforms.uMap.value = scrollTexA;
      matB.uniforms.uFlip.value = stageA.flipX ? 1 : 0;
      matB.uniforms.uOpacity.value = (1 - tposeWeight) * vis;
    } else {
      matA.uniforms.uMap.value = scrollTexA;
      matA.uniforms.uFlip.value = stageA.flipX ? 1 : 0;
      matA.uniforms.uOpacity.value = (idxA === idxB ? 1 : 1 - frac) * vis;
      matB.uniforms.uMap.value = scrollTexB;
      matB.uniforms.uFlip.value = stageB.flipX ? 1 : 0;
      matB.uniforms.uOpacity.value = (idxA === idxB ? 0 : frac) * vis;
    }

    // Gentle turn motion during pose transitions & pointer parallax tilt
    const turnKick =
      tposeWeight > 0.005
        ? Math.sin(tposeWeight * Math.PI) * 0.34
        : Math.sin(frac * Math.PI) * 0.26;

    group.position.set(
      state.rootX + state.offsetX,
      state.rootY + state.offsetY,
      state.rootZ,
    );
    group.scale.setScalar(state.scale);
    group.rotation.y =
      state.rootRotY + sway + turnKick + pointerX * 0.16;
    group.rotation.x = pointerY * 0.045;
    group.rotation.z = state.tiltZ;

    // Synchronize dynamic lighting & shader uniforms
    matA.uniforms.uTime.value = elapsed;
    matA.uniforms.uBreath.value = breath;
    matA.uniforms.uRimBoost.value = state.rimBoost;
    matA.uniforms.uLightSide.value = state.lightSide;
    matA.uniforms.uLightIntensity.value = state.lightIntensity;
    (matA.uniforms.uPointer.value as THREE.Vector2).set(pointerX, pointerY);

    matB.uniforms.uTime.value = elapsed;
    matB.uniforms.uBreath.value = breath;
    matB.uniforms.uRimBoost.value = state.rimBoost;
    matB.uniforms.uLightSide.value = state.lightSide;
    matB.uniforms.uLightIntensity.value = state.lightIntensity;
    (matB.uniforms.uPointer.value as THREE.Vector2).set(pointerX, pointerY);

    beamMat.uniforms.uIntensity.value =
      state.lightIntensity * (0.92 + breath * 0.08) * vis;
    beamMat.uniforms.uLightSide.value = state.lightSide;

    contactShadowMat.opacity = (currentIsDark ? 0.72 : 0.4) * vis;
    floorPoolMat.opacity = (currentIsDark ? 0.55 : 0.22) * vis;
    floorRingMat.opacity = 0.34 * vis;
    floorDiscMat.opacity = (currentIsDark ? 0.08 : 0.045) * vis;

    floorRing.rotation.z = elapsed * 0.18;
    floorPool.scale.setScalar(0.95 + state.lightIntensity * 0.08 + breath * 0.02);
  };

  return {
    group,
    state,
    loadAllPoses,
    update,
    playIntroFromTPose,
    setTheme,
  };
}
