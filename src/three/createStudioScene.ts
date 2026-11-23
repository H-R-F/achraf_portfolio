import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { disposeObject3D } from './proceduralFallback';
import {
  createAchrafCharacterStage,
  type AchrafStageHandle,
  type CharacterStageState,
  type StageSectionKey,
} from './achrafCharacterStage';

export interface StudioSceneCallbacks {
  onProgress?: (percent: number) => void;
  onReady?: (source: 'glb' | 'character', hasAnimations: boolean) => void;
}

export interface StudioSceneController {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  motionRig: THREE.Group;
  modelPivot: THREE.Group;
  characterState: CharacterStageState | null;
  setPointerTarget: (nx: number, ny: number) => void;
  setScrollAnimationProgress: (progress: number) => void;
  setSectionPose: (section: StageSectionKey, turnDirection?: number, instant?: boolean) => void;
  setTheme: (isDark: boolean) => void;
  replaySketch: () => void;
  resize: () => void;
  dispose: () => void;
}

const DEFAULT_MODEL_URL = '/models/scene.glb';
const DRACO_DECODER_PATH = '/draco/';

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createBokehTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size * 0.5;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.68)');
    grad.addColorStop(0.62, 'rgba(255, 255, 255, 0.16)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAmbientParticles(count: number): {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  texture: THREE.CanvasTexture;
  update: (elapsed: number, delta: number, stageVis: number) => void;
} {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);

  const warmGold = new THREE.Color('#E8C294');
  const lapisBlue = new THREE.Color('#6B8CFF');
  const warmIvory = new THREE.Color('#FFF2E0');

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1.5;

    seeds[i * 2] = 0.04 + Math.random() * 0.09; // upward thermal drift speed
    seeds[i * 2 + 1] = Math.random() * Math.PI * 2; // sway phase

    const palettePick = i % 5;
    const c =
      palettePick === 0 || palettePick === 2
        ? warmGold
        : palettePick === 1 || palettePick === 3
          ? lapisBlue
          : warmIvory;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const texture = createBokehTexture();
  const material = new THREE.PointsMaterial({
    size: 0.085,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);

  const update = (elapsed: number, delta: number, stageVis: number) => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const drift = seeds[i * 2];
      const phase = seeds[i * 2 + 1];
      arr[i * 3 + 1] += delta * drift;
      arr[i * 3] += Math.sin(elapsed * 0.45 + phase) * delta * 0.025;
      if (arr[i * 3 + 1] > 6.2) {
        arr[i * 3 + 1] = -6.2;
      }
    }
    posAttr.needsUpdate = true;
    points.rotation.y += delta * 0.008;
    material.opacity = THREE.MathUtils.lerp(0.16, 0.38, stageVis);
  };

  return { points, material, texture, update };
}

function normalizeModelToOrigin(model: THREE.Object3D, targetSize = 2.6): void {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? targetSize / maxDim : 1;

  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  model.updateMatrixWorld(true);
}

export function createStudioScene(
  container: HTMLElement,
  callbacks: StudioSceneCallbacks = {},
): StudioSceneController {
  const isSoftwareGl = detectSoftwareWebGL();
  let disposed = false;
  let frameId = 0;
  const abortController = new AbortController();

  const scene = new THREE.Scene();
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0.15, 5.6);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    alpha: true,
    precision: 'highp',
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 3),
  );
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
  scene.environment = envRenderTarget.texture;
  roomEnv.dispose();
  pmremGenerator.dispose();

  // Studio three-point lighting (warm key + cool fill + warm/lapis rim)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xf4f6ff, 0xc4956a, 0.55);
  hemiLight.position.set(0, 8, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffedd8, 2.25);
  keyLight.position.set(-3.8, 5.2, 5.0);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    const d = 3.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9fb8ff, 0.9);
  fillLight.position.set(4.5, 2.5, 3.8);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xc4956a, 1.45);
  rimLight.position.set(1.8, 3.8, -5.0);
  scene.add(rimLight);

  // Character-tracking overhead studio spotlight & rim accent point light
  const studioSpotLight = new THREE.SpotLight(0xffe7c8, 12, 16, Math.PI / 5, 0.65, 1.5);
  studioSpotLight.position.set(1.2, 3.6, 2.8);
  studioSpotLight.target.position.set(1.55, 0, 0.25);
  scene.add(studioSpotLight);
  scene.add(studioSpotLight.target);

  const accentRimPoint = new THREE.PointLight(0xd4a574, 4.5, 8, 1.8);
  accentRimPoint.position.set(2.4, 1.4, -0.8);
  scene.add(accentRimPoint);

  const particles = createAmbientParticles(80);
  scene.add(particles.points);

  const motionRig = new THREE.Group();
  motionRig.name = 'ScrollMotionRig';
  scene.add(motionRig);

  const modelPivot = new THREE.Group();
  modelPivot.name = 'ModelPivot';
  motionRig.add(modelPivot);

  let activeModelRoot: THREE.Object3D | null = null;
  let characterStage: AchrafStageHandle | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let maxClipDuration = 0;
  let targetScrollAnimTime = 0;
  let currentScrollAnimTime = 0;

  const pointerTarget = { x: 0, y: 0 };
  const pointerCurrent = { x: 0, y: 0 };
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const setActiveModel = (root: THREE.Object3D) => {
    if (activeModelRoot) {
      modelPivot.remove(activeModelRoot);
      disposeObject3D(activeModelRoot);
    }
    activeModelRoot = root;
    modelPivot.add(root);
  };

  // Mount Achraf's real 3D character stage synchronously so GSAP can bind to characterState immediately
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  characterStage = createAchrafCharacterStage(
    renderer,
    isDark,
    abortController.signal,
  );
  setActiveModel(characterStage.group);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const initCharacterAssets = async () => {
    callbacks.onProgress?.(12);
    try {
      const probe = await fetch(DEFAULT_MODEL_URL, {
        method: 'HEAD',
        signal: abortController.signal,
      });

      const contentType = probe.headers.get('content-type') || '';
      if (!probe.ok || contentType.includes('text/html')) {
        await characterStage?.loadAllPoses((pct) => {
          callbacks.onProgress?.(Math.max(15, pct));
        });
        if (disposed) return;
        if (!isSoftwareGl) renderer.compile(scene, camera);
        callbacks.onProgress?.(100);
        callbacks.onReady?.('character', false);
        return;
      }

      gltfLoader.load(
        DEFAULT_MODEL_URL,
        (gltf) => {
          if (disposed) {
            disposeObject3D(gltf.scene);
            return;
          }

          const model = gltf.scene;
          normalizeModelToOrigin(model, 2.6);
          characterStage = null;
          setActiveModel(model);

          let hasAnimations = false;
          if (gltf.animations && gltf.animations.length > 0) {
            hasAnimations = true;
            mixer = new THREE.AnimationMixer(model);
            maxClipDuration = gltf.animations.reduce(
              (max, clip) => Math.max(max, clip.duration),
              0,
            );
            gltf.animations.forEach((clip) => {
              const action = mixer!.clipAction(clip);
              action.loop = THREE.LoopOnce;
              action.clampWhenFinished = true;
              action.play();
            });
            mixer.setTime(0);
          }

          if (!isSoftwareGl) renderer.compile(scene, camera);
          callbacks.onProgress?.(100);
          callbacks.onReady?.('glb', hasAnimations);
        },
        (xhr) => {
          if (disposed) return;
          if (xhr.lengthComputable && xhr.total > 0) {
            callbacks.onProgress?.(
              Math.min(99, Math.round((xhr.loaded / xhr.total) * 100)),
            );
          }
        },
        async () => {
          await characterStage?.loadAllPoses((pct) => {
            callbacks.onProgress?.(Math.max(15, pct));
          });
          if (disposed) return;
          if (!isSoftwareGl) renderer.compile(scene, camera);
          callbacks.onProgress?.(100);
          callbacks.onReady?.('character', false);
        },
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || disposed) return;
      await characterStage?.loadAllPoses().catch(() => undefined);
      if (disposed) return;
      if (!isSoftwareGl) renderer.compile(scene, camera);
      callbacks.onProgress?.(100);
      callbacks.onReady?.('character', false);
    }
  };

  void initCharacterAssets();

  const clock = new THREE.Clock();

  const afterDraw = (cb: () => void) => {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  };

  const tick = () => {
    if (disposed) return;
    const rawDelta = clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    const elapsed = clock.getElapsedTime();

    if (!prefersReducedMotion) {
      pointerCurrent.x = THREE.MathUtils.damp(pointerCurrent.x, pointerTarget.x, 5.5, delta);
      pointerCurrent.y = THREE.MathUtils.damp(pointerCurrent.y, pointerTarget.y, 5.5, delta);

      characterStage?.update(elapsed, delta, pointerCurrent.x, pointerCurrent.y);
      const stageVis = characterStage
        ? THREE.MathUtils.clamp(characterStage.state.stageOpacity, 0, 1)
        : 1;
      particles.update(elapsed, delta, stageVis);

      if (characterStage) {
        const cx = characterStage.group.position.x;
        const cy = characterStage.group.position.y + 1.2;
        const cz = characterStage.group.position.z;
        const lightSide = characterStage.state.lightSide;

        // Sync Three.js physical lights seamlessly with per-section creative lighting mood
        keyLight.color.copy(characterStage.activeLightColors.key);
        fillLight.color.copy(characterStage.activeLightColors.fill);
        rimLight.color.copy(characterStage.activeLightColors.rim);
        studioSpotLight.color.copy(characterStage.activeLightColors.key);
        accentRimPoint.color.copy(characterStage.activeLightColors.rim);

        keyLight.position.x = THREE.MathUtils.damp(
          keyLight.position.x,
          lightSide * 3.8 + pointerCurrent.x * 1.15,
          4.5,
          delta,
        );
        keyLight.position.y = THREE.MathUtils.damp(
          keyLight.position.y,
          5.0 + pointerCurrent.y * 0.85,
          4.5,
          delta,
        );

        studioSpotLight.position.x = THREE.MathUtils.damp(
          studioSpotLight.position.x,
          cx + lightSide * 1.45 + pointerCurrent.x * 0.38,
          4.5,
          delta,
        );
        studioSpotLight.position.y = THREE.MathUtils.damp(
          studioSpotLight.position.y,
          cy + 2.4 + pointerCurrent.y * 0.28,
          4.5,
          delta,
        );
        studioSpotLight.target.position.set(cx, cy, cz);
        studioSpotLight.target.updateMatrixWorld();
        studioSpotLight.intensity =
          11.2 * characterStage.state.lightIntensity * stageVis;

        accentRimPoint.position.x = THREE.MathUtils.damp(
          accentRimPoint.position.x,
          cx - lightSide * 1.15 - pointerCurrent.x * 0.22,
          4.5,
          delta,
        );
        accentRimPoint.position.y = cy + 0.55;
        accentRimPoint.position.z = cz - 0.9;
        accentRimPoint.intensity =
          (4.2 + characterStage.state.rimBoost * 4.8) * stageVis;
      }
    } else {
      characterStage?.update(2, 2, 0, 0);
    }

    if (mixer && maxClipDuration > 0) {
      currentScrollAnimTime = THREE.MathUtils.damp(
        currentScrollAnimTime,
        targetScrollAnimTime,
        7.0,
        delta,
      );
      mixer.setTime(currentScrollAnimTime);
    }

    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  };

  frameId = requestAnimationFrame(tick);

  const setPointerTarget = (nx: number, ny: number) => {
    pointerTarget.x = THREE.MathUtils.clamp(nx, -1, 1);
    pointerTarget.y = THREE.MathUtils.clamp(ny, -1, 1);
  };

  const setScrollAnimationProgress = (progress: number) => {
    if (maxClipDuration <= 0) return;
    const clamped = THREE.MathUtils.clamp(progress, 0, 0.999);
    targetScrollAnimTime = clamped * maxClipDuration;
  };

  const setTheme = (dark: boolean) => {
    characterStage?.setTheme(dark);
    rimLight.color.set(dark ? 0xc4956a : 0x3b5bdb);
    accentRimPoint.color.set(dark ? 0xd4a574 : 0x4c6ef5);
    studioSpotLight.color.set(dark ? 0xffe7c8 : 0xfff8ee);
  };

  const setSectionPose = (
    section: StageSectionKey,
    turnDirection = 1,
    instant = false,
  ) => {
    characterStage?.setSectionPose(section, turnDirection, instant);
  };

  const replaySketch = () => {
    characterStage?.playIntroFromTPose();
  };

  const resize = () => {
    if (disposed) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 3),
    );
    renderer.setSize(w, h);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);

    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }

    disposeObject3D(scene);
    particles.texture.dispose();
    envRenderTarget.dispose();
    dracoLoader.dispose();
    renderer.dispose();

    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    camera,
    renderer,
    motionRig,
    modelPivot,
    characterState: characterStage?.state ?? null,
    setPointerTarget,
    setScrollAnimationProgress,
    setSectionPose,
    setTheme,
    replaySketch,
    resize,
    dispose,
  };
}
