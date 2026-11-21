import * as THREE from 'three';

export interface PortraitSketchHandle {
  group: THREE.Group;
  update: (elapsed: number, delta: number, pointerX?: number, scrollProgress?: number) => void;
  replay: () => void;
  setTheme: (isDark: boolean) => void;
  onLoaded: Promise<void>;
}

const PORTRAIT_IMAGE_URL = '/assets/aistudio/image_04b3caef.png';

/**
 * Computes smooth 3D anatomical facial & torso relief Z-depth for Achraf's centered portrait.
 */
function portraitReliefZ(u: number, v: number, lum: number, mask: number): number {
  if (mask <= 0.01) return -0.18;

  // Main head ellipsoid
  const hx = (u - 0.5) / 0.185;
  const hy = (v - 0.37) / 0.245;
  const headDome = Math.exp(-(hx * hx + hy * hy));

  // Nose bridge & tip prominence
  const nx = (u - 0.5) / 0.042;
  const ny = (v - 0.415) / 0.075;
  const nosePeak = 0.095 * Math.exp(-(nx * nx + ny * ny));

  // Brow & cheekbone ridge
  const bx = (u - 0.5) / 0.13;
  const by = (v - 0.345) / 0.038;
  const browRidge = 0.035 * Math.exp(-(bx * bx + by * by));

  // Beard / chin volume
  const cx = (u - 0.5) / 0.11;
  const cy = (v - 0.55) / 0.075;
  const chinVolume = 0.045 * Math.exp(-(cx * cx + cy * cy));

  // Shoulders & lapels volume below v = 0.62
  const tx = (u - 0.5) / 0.34;
  const ty = (v - 0.82) / 0.22;
  const torsoDome = v > 0.56 ? 0.18 * Math.exp(-(tx * tx + ty * ty)) : 0;

  const baseRelief = headDome * 0.34 + nosePeak + browRidge + chinVolume + torsoDome;
  const microDetail = (lum - 0.5) * 0.018;
  return (baseRelief + microDetail) * mask - 0.06;
}

/**
 * Generates an alpha cutout mask separating Achraf (hair, skin, beard, collar, suit)
 * from the neutral studio gray backdrop using corner color distance + anatomical bounds.
 */
function buildPortraitMaskAndData(
  img: HTMLImageElement,
  size: number,
): {
  colorTexture: THREE.CanvasTexture;
  maskTexture: THREE.DataTexture;
  lumGrid: Float32Array;
  maskGrid: Float32Array;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const { data } = imgData;

  // Sample studio backdrop average color from top-left & top-right corners
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let samples = 0;
  for (let y = 2; y < 18; y++) {
    for (let x = 2; x < 18; x++) {
      for (const sx of [x, size - 1 - x]) {
        const i = (y * size + sx) * 4;
        bgR += data[i] / 255;
        bgG += data[i + 1] / 255;
        bgB += data[i + 2] / 255;
        samples++;
      }
    }
  }
  bgR /= samples;
  bgG /= samples;
  bgB /= samples;

  const lumGrid = new Float32Array(size * size);
  const rawMask = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const u = x / (size - 1);
      const v = y / (size - 1);

      const r = data[idx * 4] / 255;
      const g = data[idx * 4 + 1] / 255;
      const b = data[idx * 4 + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumGrid[idx] = lum;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

      // Color distance from studio backdrop
      const bgDist = Math.hypot(r - bgR, g - bgG, b - bgB);

      // Head + neck + shoulders containment silhouette
      const hx = (u - 0.5) / 0.235;
      const hy = (v - 0.37) / 0.285;
      const headEllip = Math.hypot(hx, hy);
      const insideHead = THREE.MathUtils.smoothstep(1.16 - headEllip, 0, 0.22);

      // Shoulders widen smoothly below v = 0.60
      const shoulderHalfW = THREE.MathUtils.lerp(
        0.16,
        0.52,
        THREE.MathUtils.clamp((v - 0.56) / 0.42, 0, 1),
      );
      const sx = Math.abs(u - 0.5) / shoulderHalfW;
      const insideShoulders =
        v > 0.55
          ? THREE.MathUtils.smoothstep(1.06 - sx, 0, 0.18) *
            THREE.MathUtils.smoothstep(v, 0.54, 0.65)
          : 0;

      const boundsMask = Math.max(insideHead, insideShoulders);

      // Foreground classification: skin warmth, dark hair/beard/suit, or bright collar near center
      const isWhiteCollar =
        v > 0.58 && Math.abs(u - 0.5) < 0.21 && lum > 0.83 && bgDist > 0.08;
      const isDarkFeature = lum < 0.48 && bgDist > 0.18;
      const isSkinOrSuit = bgDist > 0.115 || sat > 0.095;

      let fg = 0;
      if (isWhiteCollar || isDarkFeature || isSkinOrSuit) {
        fg = THREE.MathUtils.smoothstep(bgDist, 0.075, 0.18);
        if (isWhiteCollar) fg = Math.max(fg, 0.95);
        if (headEllip < 0.72) fg = 1.0; // Lock interior face core solidly
      }

      // Softly fade bottom edge of bust into the canvas
      const bottomFade = THREE.MathUtils.smoothstep(1.0 - v, 0.0, 0.16);
      const sideFade = THREE.MathUtils.smoothstep(0.5 - Math.abs(u - 0.5), 0.0, 0.08);

      rawMask[idx] = fg * boundsMask * bottomFade * sideFade;
    }
  }

  // Two-pass 3x3 smoothing on mask for silky hair/shoulder feathering
  const maskGrid = new Float32Array(size * size);
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += rawMask[(y + dy) * size + (x + dx)];
        }
      }
      maskGrid[y * size + x] = sum / 9;
    }
  }

  // Pack smoothed mask into RGBA DataTexture
  const maskBytes = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const val = Math.round(THREE.MathUtils.clamp(maskGrid[i], 0, 1) * 255);
    maskBytes[i * 4] = val;
    maskBytes[i * 4 + 1] = val;
    maskBytes[i * 4 + 2] = val;
    maskBytes[i * 4 + 3] = 255;
  }

  const maskTexture = new THREE.DataTexture(maskBytes, size, size, THREE.RGBAFormat);
  maskTexture.flipY = true;
  maskTexture.needsUpdate = true;

  // Full-resolution CanvasTexture for crisp portrait rendering
  const hiCanvas = document.createElement('canvas');
  hiCanvas.width = img.naturalWidth || 512;
  hiCanvas.height = img.naturalHeight || 512;
  const hiCtx = hiCanvas.getContext('2d')!;
  hiCtx.drawImage(img, 0, 0, hiCanvas.width, hiCanvas.height);
  const colorTexture = new THREE.CanvasTexture(hiCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.needsUpdate = true;

  return { colorTexture, maskTexture, lumGrid, maskGrid };
}

/**
 * Builds a dramatic 3D character-showcase portrait bust from Achraf's real photo
 * inspired by AAA split-lit character reveals:
 * - Sculpted 3D depth relief mesh with warm-left / cool-right studio rim lighting
 * - Animated vertical split-wipe hairline comparing full lit 3D render vs. technical wireframe/clay blueprint
 * - Layered parallax background portrait echo for depth
 */
export function createPortraitSketch(initialIsDark: boolean): PortraitSketchHandle {
  const group = new THREE.Group();
  group.name = 'CinematicPortraitShowcase';

  let revealElapsed = 0;
  const revealDuration = 2.4;
  let isDarkTheme = initialIsDark;

  const uReveal = { value: 0.0 };
  const uSplitX = { value: 0.56 };
  const uTime = { value: 0.0 };
  const uThemeMix = { value: initialIsDark ? 1.0 : 0.0 };

  let targetSplit = 0.56;

  const onLoaded = new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = PORTRAIT_IMAGE_URL;

    img.onload = () => {
      const gridSize = 144;
      const { colorTexture, maskTexture, lumGrid, maskGrid } = buildPortraitMaskAndData(
        img,
        gridSize,
      );

      const worldScale = 2.85;
      const bustGeo = new THREE.PlaneGeometry(worldScale, worldScale, 112, 112);
      const posAttr = bustGeo.attributes.position as THREE.BufferAttribute;

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const u = vx / worldScale + 0.5;
        const v = 0.5 - vy / worldScale;
        const px = THREE.MathUtils.clamp(Math.round(u * (gridSize - 1)), 0, gridSize - 1);
        const py = THREE.MathUtils.clamp(Math.round(v * (gridSize - 1)), 0, gridSize - 1);
        const idx = py * gridSize + px;
        posAttr.setZ(i, portraitReliefZ(u, v, lumGrid[idx], maskGrid[idx]));
      }
      bustGeo.computeVertexNormals();

      // Main Foreground Sculpted Portrait Bust (Split Lit 3D Render <-> Blueprint Wireframe Scan)
      const bustMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: colorTexture },
          uMask: { value: maskTexture },
          uReveal: uReveal,
          uSplitX: uSplitX,
          uTime: uTime,
          uThemeMix: uThemeMix,
        },
        transparent: true,
        depthWrite: true,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalView;
          varying vec3 vViewPos;
          varying vec3 vLocalPos;

          void main() {
            vUv = uv;
            vLocalPos = position;
            vNormalView = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewPos = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform sampler2D uMask;
          uniform float uReveal;
          uniform float uSplitX;
          uniform float uTime;
          uniform float uThemeMix;

          varying vec2 vUv;
          varying vec3 vNormalView;
          varying vec3 vViewPos;
          varying vec3 vLocalPos;

          void main() {
            float mask = texture2D(uMask, vUv).r;
            if (mask < 0.03) discard;

            vec3 albedo = texture2D(uMap, vUv).rgb;
            vec3 N = normalize(vNormalView);
            vec3 V = normalize(vViewPos);

            // Dramatic warm left key light + cool right rim light (matching reference)
            vec3 keyDir = normalize(vec3(-0.75, 0.32, 0.68));
            vec3 rimDir = normalize(vec3(0.88, 0.16, 0.25));
            vec3 fillDir = normalize(vec3(0.0, 0.6, 0.8));

            float keyDiff = max(dot(N, keyDir), 0.0);
            float fillDiff = max(dot(N, fillDir), 0.0);
            float rimFresnel = pow(1.0 - max(dot(N, V), 0.0), 2.4) * max(dot(N, rimDir) * 0.5 + 0.5, 0.0);

            vec3 warmKey = vec3(1.06, 0.86, 0.72) * (keyDiff * 0.72 + 0.42);
            vec3 coolRim = vec3(0.48, 0.72, 1.0) * (rimFresnel * 0.78);
            vec3 softFill = vec3(0.85, 0.88, 0.94) * (fillDiff * 0.28);

            // Full cinematic 3D lit portrait side
            vec3 litColor = albedo * (warmKey + softFill) + coolRim * 0.55;
            // Subtle contrast punch
            litColor = mix(litColor, litColor * litColor * (3.0 - 2.0 * litColor), 0.16);

            // Blueprint / Technical Wireframe Scan side (Law x Engineering dual identity)
            float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
            float clayShade = lum * (keyDiff * 0.55 + fillDiff * 0.35 + 0.35);
            vec3 lightClay = mix(vec3(0.14, 0.20, 0.40), vec3(0.93, 0.91, 0.86), clayShade);
            vec3 darkClay = mix(vec3(0.07, 0.09, 0.15), vec3(0.55, 0.62, 0.82), clayShade);
            vec3 clayBase = mix(lightClay, darkClay, uThemeMix);

            // Procedural precision wireframe contour grid over the blueprint half
            float gx = abs(fract(vUv.x * 42.0) - 0.5);
            float gy = abs(fract(vUv.y * 42.0) - 0.5);
            float gridLine = max(1.0 - smoothstep(0.0, 0.045, gx), 1.0 - smoothstep(0.0, 0.045, gy));
            vec3 wireTint = mix(vec3(0.24, 0.38, 0.78), vec3(0.77, 0.58, 0.42), 0.35);
            vec3 blueprintColor = mix(clayBase, wireTint, gridLine * 0.42) + coolRim * 0.45;

            // Vertical split wipe between lit 3D portrait (left) and blueprint wireframe (right)
            float splitEdge = smoothstep(uSplitX - 0.002, uSplitX + 0.002, vUv.x);
            vec3 finalColor = mix(litColor, blueprintColor, splitEdge);

            // Razor-sharp luminous vertical divider hairline (matching screenshot)
            float lineDist = abs(vUv.x - uSplitX);
            float dividerLine = 1.0 - smoothstep(0.0, 0.0022, lineDist);
            finalColor = mix(finalColor, vec3(0.95, 0.92, 0.86), dividerLine * 0.9);

            // Soft reveal wipe on load (grows from center vertically + settles mask)
            float revealMask = smoothstep(0.0, 1.0, uReveal);
            float scanReveal = smoothstep(
              1.0 - revealMask * 1.15 - 0.12,
              1.0 - revealMask * 1.15 + 0.12,
              1.0 - abs(vUv.y - 0.48) * 1.4
            );

            float alpha = mask * mix(scanReveal, 1.0, smoothstep(0.75, 1.0, revealMask));
            if (alpha < 0.02) discard;

            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
      });

      const foregroundBust = new THREE.Mesh(bustGeo, bustMaterial);
      foregroundBust.position.set(0, 0, 0.05);
      group.add(foregroundBust);

      // Background Parallax Ghost Echo Silhouette (matching the large darkened right-side echo in screenshot)
      const echoMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: colorTexture },
          uMask: { value: maskTexture },
          uReveal: uReveal,
          uThemeMix: uThemeMix,
        },
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform sampler2D uMask;
          uniform float uReveal;
          uniform float uThemeMix;
          varying vec2 vUv;

          void main() {
            float mask = texture2D(uMask, vUv).r;
            if (mask < 0.03) discard;

            vec3 albedo = texture2D(uMap, vUv).rgb;
            float lum = dot(albedo, vec3(0.299, 0.587, 0.114));

            // Atmospheric deep-shadow echo in dark mode; soft silver wash in light mode
            vec3 darkEcho = albedo * 0.28 + vec3(0.03, 0.04, 0.06);
            vec3 lightEcho = mix(vec3(0.78, 0.80, 0.85), vec3(0.94, 0.93, 0.90), lum);
            vec3 col = mix(lightEcho, darkEcho, uThemeMix);

            float alpha = mask * uReveal * mix(0.22, 0.42, uThemeMix);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      });

      const echoPlane = new THREE.Mesh(bustGeo, echoMaterial);
      echoPlane.scale.setScalar(1.48);
      echoPlane.position.set(0.92, 0.22, -1.35);
      group.add(echoPlane);

      // Extended subtle full-height vertical hairline guide matching the split line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -1.85, 0.12),
        new THREE.Vector3(0, 1.85, 0.12),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#D8D3C8'),
        transparent: true,
        opacity: 0.28,
      });
      const hairline = new THREE.Line(lineGeo, lineMat);
      hairline.name = 'SplitHairline';
      group.add(hairline);

      resolve();
    };

    img.onerror = () => resolve();
  });

  const replay = () => {
    revealElapsed = 0;
    uReveal.value = 0;
  };

  const setTheme = (isDark: boolean) => {
    isDarkTheme = isDark;
  };

  const update = (
    elapsed: number,
    delta: number,
    pointerX = 0,
    scrollProgress = 0,
  ) => {
    uTime.value = elapsed;

    if (revealElapsed < revealDuration) {
      revealElapsed = Math.min(revealDuration, revealElapsed + delta);
      const t = revealElapsed / revealDuration;
      uReveal.value = 1 - Math.pow(1 - t, 2.5);
    } else {
      uReveal.value = 1.0;
    }

    // Split hairline glides smoothly with initial reveal, scroll progress, and subtle cursor X
    const scrollOscillation = Math.sin(scrollProgress * Math.PI * 2.0) * 0.16;
    targetSplit = THREE.MathUtils.clamp(
      0.55 + scrollOscillation + pointerX * 0.09,
      0.24,
      0.82,
    );
    uSplitX.value = THREE.MathUtils.damp(uSplitX.value, targetSplit, 5.0, delta);

    const hairlineObj = group.getObjectByName('SplitHairline');
    if (hairlineObj) {
      hairlineObj.position.x = (uSplitX.value - 0.5) * 2.85;
    }

    const targetMix = isDarkTheme ? 1.0 : 0.0;
    uThemeMix.value = THREE.MathUtils.damp(uThemeMix.value, targetMix, 6.0, delta);
  };

  return { group, update, replay, setTheme, onLoaded };
}
