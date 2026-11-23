import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStudioScene, type StudioSceneController } from '../three/createStudioScene';
import {
  createDefaultStageState,
  type StageSectionKey,
} from '../three/achrafCharacterStage';

gsap.registerPlugin(ScrollTrigger);

interface ScrollScene3DProps {
  isDark?: boolean;
  replayNonce?: number;
}

const LANE_SIDE: Record<StageSectionKey, 'left' | 'right'> = {
  hero: 'right',
  about: 'left',
  experience: 'right',
  projects: 'left',
  skills: 'right',
  contact: 'right',
};

const SECTIONS: StageSectionKey[] = [
  'hero',
  'about',
  'experience',
  'projects',
  'skills',
  'contact',
];

export default function ScrollScene3D({
  isDark = true,
  replayNonce = 0,
}: ScrollScene3DProps) {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<StudioSceneController | null>(null);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    controllerRef.current?.setTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    if (replayNonce > 0) {
      controllerRef.current?.replaySketch();
    }
  }, [replayNonce]);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const sceneCtrl = createStudioScene(mountEl, {
      onProgress: (pct) => setProgress(pct),
      onReady: () => {
        setProgress(100);
        setIsReady(true);
      },
    });
    controllerRef.current = sceneCtrl;

    const { motionRig, camera, characterState } = sceneCtrl;
    const scrollRoot =
      (document.querySelector('[data-scroll-root]') as HTMLElement | null) ||
      document.documentElement;

    // Projects a dedicated DOM [data-character-lane="<section>"] column center
    // directly into exact Three.js world X coordinates and responsive scale.
    const getLanePlacement = (section: StageSectionKey, targetZ = 0.25) => {
      const vFovRad = (camera.fov * Math.PI) / 180;
      const dist = camera.position.z - targetZ;
      const halfH = dist * Math.tan(vFovRad / 2);
      const halfW = halfH * camera.aspect;

      const laneEl = document.querySelector(
        `[data-character-lane="${section}"]`,
      ) as HTMLElement | null;

      if (laneEl) {
        const rect = laneEl.getBoundingClientRect();
        if (rect.width > 0) {
          const centerPx = rect.left + rect.width * 0.5;
          const ndcX = (centerPx / window.innerWidth) * 2 - 1;
          const worldX = ndcX * halfW;
          const laneScale = Math.min(1.06, Math.max(0.84, rect.width / 345));
          return { worldX, laneScale };
        }
      }

      const isLeft = LANE_SIDE[section] === 'left';
      const fallbackX = Math.min(2.75, Math.max(1.55, halfW * 0.72));
      return {
        worldX: isLeft ? -fallbackX : fallbackX,
        laneScale: 1,
      };
    };

    let activeAmbientTween: gsap.core.Tween | null = null;
    let activeSection: StageSectionKey = 'hero';

    const stopAmbientReaction = () => {
      activeAmbientTween?.kill();
      activeAmbientTween = null;
    };

    const computeTurnDir = (from: StageSectionKey, to: StageSectionKey) => {
      if (LANE_SIDE[from] === LANE_SIDE[to]) {
        return SECTIONS.indexOf(to) >= SECTIONS.indexOf(from) ? 1 : -1;
      }
      return LANE_SIDE[to] === 'right' ? 1 : -1;
    };

    const enterSectionDesktop = (section: StageSectionKey) => {
      if (!characterState) return;
      const prevSection = activeSection;
      if (prevSection === section && section !== 'hero') return;
      activeSection = section;
      stopAmbientReaction();

      gsap.killTweensOf(characterState);
      gsap.killTweensOf(camera.position);

      const turnDir = computeTurnDir(prevSection, section);
      sceneCtrl.setSectionPose(section, turnDir, prevSection === 'hero' && section === 'about');

      switch (section) {
        case 'hero': {
          // Position standby inside #about's left lane slightly set back so #about entry emerges forward without crossing copy
          const { worldX } = getLanePlacement('about', 0.28);
          gsap.to(characterState, {
            rootX: worldX,
            rootY: -1.18,
            rootZ: -0.15,
            rootRotY: -0.25,
            scale: 0.96,
            stageOpacity: 0,
            offsetX: 0,
            offsetY: 0,
            tiltZ: 0,
            rimBoost: 0.22,
            lightSide: 0.68,
            lightIntensity: 1.05,
            duration: 0.42,
            ease: 'power2.out',
          });
          gsap.to(camera.position, {
            x: 0,
            y: 0.12,
            z: 5.5,
            duration: 0.85,
            ease: 'power3.out',
          });
          break;
        }

        case 'about': {
          const { worldX, laneScale } = getLanePlacement('about', 0.28);
          if (prevSection === 'hero') {
            // Reset cleanly in left lane before stepping forward with the Hero entrance move
            gsap.set(characterState, { rootX: worldX, rootZ: -0.15 });
            sceneCtrl.replaySketch();
          }

          const heroEntryTl = gsap.timeline();
          heroEntryTl
            .to(characterState, {
              rootX: worldX,
              rootY: -1.2,
              rootZ: 0.28,
              rootRotY: 0.22,
              scale: laneScale * 1.03,
              stageOpacity: 1,
              offsetX: 0,
              offsetY: 0.055,
              tiltZ: 0.018,
              rimBoost: 0.62,
              lightSide: 0.68,
              lightIntensity: 1.18,
              duration: 0.68,
              ease: 'power3.out',
            })
            .to(characterState, {
              scale: laneScale * 1.01,
              offsetY: 0,
              tiltZ: 0,
              rimBoost: 0.28,
              lightIntensity: 1.1,
              duration: 0.46,
              ease: 'power2.out',
              onComplete: () => {
                if (activeSection !== 'about') return;
                activeAmbientTween = gsap.to(characterState, {
                  tiltZ: -0.014,
                  offsetY: 0.024,
                  duration: 2.1,
                  yoyo: true,
                  repeat: -1,
                  ease: 'sine.inOut',
                });
              },
            });

          gsap.to(camera.position, {
            x: 0.04,
            y: 0.14,
            z: 5.42,
            duration: 0.85,
            ease: 'power3.out',
          });
          break;
        }

        case 'experience': {
          const { worldX, laneScale } = getLanePlacement('experience', 0.22);
          const strideTl = gsap.timeline();
          strideTl
            .to(characterState, {
              rootX: worldX,
              rootY: -1.23,
              rootZ: 0.24,
              rootRotY: -0.24,
              stageOpacity: 1,
              scale: laneScale * 1.03,
              offsetX: -0.05,
              offsetY: 0.07,
              tiltZ: -0.036,
              rimBoost: 0.56,
              lightSide: -0.74,
              lightIntensity: 1.2,
              duration: 0.58,
              ease: 'power2.out',
            })
            .to(characterState, {
              scale: laneScale,
              offsetX: 0,
              offsetY: 0,
              tiltZ: -0.01,
              rimBoost: 0.26,
              lightIntensity: 1.12,
              duration: 0.44,
              ease: 'power2.out',
              onComplete: () => {
                if (activeSection !== 'experience') return;
                activeAmbientTween = gsap.to(characterState, {
                  offsetY: 0.022,
                  tiltZ: 0.008,
                  duration: 2.2,
                  yoyo: true,
                  repeat: -1,
                  ease: 'sine.inOut',
                });
              },
            });

          gsap.to(camera.position, {
            x: -0.04,
            y: 0.1,
            z: 5.48,
            duration: 0.85,
            ease: 'power3.out',
          });
          break;
        }

        case 'projects': {
          const { worldX, laneScale } = getLanePlacement('projects', 0.3);
          const presentTl = gsap.timeline();
          presentTl
            .to(characterState, {
              rootX: worldX,
              rootY: -1.22,
              rootZ: 0.3,
              rootRotY: 0.22,
              stageOpacity: 1,
              scale: laneScale * 1.03,
              offsetX: 0.06,
              offsetY: 0.05,
              tiltZ: -0.028,
              rimBoost: 0.85,
              lightSide: 0.74,
              lightIntensity: 1.24,
              duration: 0.62,
              ease: 'power3.out',
            })
            .to(characterState, {
              scale: laneScale,
              offsetX: 0.01,
              offsetY: 0,
              tiltZ: -0.012,
              rimBoost: 0.3,
              lightIntensity: 1.14,
              duration: 0.48,
              ease: 'power2.out',
              onComplete: () => {
                if (activeSection !== 'projects') return;
                activeAmbientTween = gsap.to(characterState, {
                  offsetY: 0.022,
                  tiltZ: 0.01,
                  duration: 2.3,
                  yoyo: true,
                  repeat: -1,
                  ease: 'sine.inOut',
                });
              },
            });

          gsap.to(camera.position, {
            x: 0.04,
            y: 0.12,
            z: 5.38,
            duration: 0.85,
            ease: 'power3.out',
          });
          break;
        }

        case 'skills': {
          const { worldX, laneScale } = getLanePlacement('skills', 0.2);
          gsap.to(characterState, {
            rootX: worldX,
            rootY: -1.24,
            rootZ: 0.22,
            rootRotY: -0.22,
            scale: laneScale,
            stageOpacity: 1,
            offsetX: 0,
            offsetY: 0,
            tiltZ: -0.015,
            rimBoost: 0.42,
            lightSide: -0.62,
            lightIntensity: 1.12,
            duration: 0.76,
            ease: 'power3.out',
            onComplete: () => {
              if (activeSection !== 'skills') return;
              activeAmbientTween = gsap.to(characterState, {
                tiltZ: 0.012,
                offsetY: 0.02,
                duration: 2.3,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut',
              });
            },
          });

          gsap.to(camera.position, {
            x: 0,
            y: 0.14,
            z: 5.45,
            duration: 0.85,
            ease: 'power3.out',
          });
          break;
        }

        case 'contact': {
          const { worldX, laneScale } = getLanePlacement('contact', 0.24);
          const waveTl = gsap.timeline();
          waveTl
            .to(characterState, {
              rootX: worldX,
              rootY: -1.22,
              rootZ: 0.24,
              rootRotY: -0.16,
              scale: laneScale * 1.03,
              stageOpacity: 1,
              offsetX: 0,
              offsetY: 0.075,
              tiltZ: -0.028,
              rimBoost: 0.78,
              lightSide: -0.62,
              lightIntensity: 1.24,
              duration: 0.62,
              ease: 'back.out(1.4)',
            })
            .to(characterState, {
              scale: laneScale,
              offsetY: 0,
              tiltZ: 0.024,
              rimBoost: 0.34,
              lightIntensity: 1.14,
              duration: 0.44,
              ease: 'power2.out',
              onComplete: () => {
                if (activeSection !== 'contact') return;
                activeAmbientTween = gsap.to(characterState, {
                  tiltZ: -0.028,
                  offsetY: 0.028,
                  duration: 1.25,
                  yoyo: true,
                  repeat: -1,
                  ease: 'sine.inOut',
                });
              },
            });

          gsap.to(camera.position, {
            x: 0,
            y: 0.12,
            z: 5.52,
            duration: 0.85,
            ease: 'power3.out',
          });
          break;
        }
      }
    };

    const enterSectionMobile = (section: StageSectionKey) => {
      if (!characterState) return;
      const prevSection = activeSection;
      if (prevSection === section && section !== 'hero') return;
      activeSection = section;
      stopAmbientReaction();
      gsap.killTweensOf(characterState);

      const turnDir = computeTurnDir(prevSection, section);
      sceneCtrl.setSectionPose(section, turnDir, prevSection === 'hero' && section === 'about');

      if (section === 'about' && prevSection === 'hero') {
        sceneCtrl.replaySketch();
      }

      const mobileMap: Record<
        StageSectionKey,
        { rootX: number; rootRotY: number; tiltZ: number; lightSide: number }
      > = {
        hero: { rootX: -0.2, rootRotY: -0.08, tiltZ: 0, lightSide: 0.5 },
        about: { rootX: -0.2, rootRotY: 0.15, tiltZ: 0.015, lightSide: 0.6 },
        experience: { rootX: 0.22, rootRotY: -0.15, tiltZ: -0.02, lightSide: -0.6 },
        projects: { rootX: -0.2, rootRotY: 0.14, tiltZ: -0.018, lightSide: 0.6 },
        skills: { rootX: 0.2, rootRotY: -0.14, tiltZ: -0.01, lightSide: -0.58 },
        contact: { rootX: 0, rootRotY: 0, tiltZ: 0.02, lightSide: -0.55 },
      };

      const target = mobileMap[section];
      gsap.to(characterState, {
        ...target,
        rootY: -1.18,
        rootZ: -0.88,
        scale: 1,
        stageOpacity: section === 'hero' ? 0 : 1,
        offsetX: 0,
        offsetY: 0.04,
        duration: 0.68,
        ease: 'power3.out',
        onComplete: () => {
          gsap.to(characterState, {
            offsetY: 0,
            duration: 0.32,
            ease: 'power2.out',
          });
        },
      });
    };

    const detectActiveSection = (): StageSectionKey => {
      const mid = window.innerHeight * 0.54;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i]);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid) {
          return SECTIONS[i];
        }
      }
      return 'hero';
    };

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px)', () => {
        gsap.set(motionRig.position, { x: 0, y: 0, z: 0 });
        gsap.set(motionRig.rotation, { x: 0, y: 0, z: 0 });
        gsap.set(motionRig.scale, { x: 1, y: 1, z: 1 });
        gsap.set(camera.position, { x: 0, y: 0.12, z: 5.5 });

        if (characterState) {
          const { worldX } = getLanePlacement('about', 0.28);
          gsap.set(characterState, {
            ...createDefaultStageState(),
            rootX: worldX,
            rootZ: -0.15,
          });
        }

        // Continuous zero-gap ScrollTriggers (top 56% / bottom 56% handoff matches both scroll directions)
        SECTIONS.forEach((sec) => {
          const el = document.getElementById(sec);
          if (!el) return;
          ScrollTrigger.create({
            trigger: el,
            start: 'top 56%',
            end: 'bottom 56%',
            onEnter: () => enterSectionDesktop(sec),
            onEnterBack: () => enterSectionDesktop(sec),
          });
        });

        // Continuous scroll momentum + top/bottom boundary guarantees
        ScrollTrigger.create({
          trigger: scrollRoot,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            sceneCtrl.setScrollAnimationProgress(self.progress);
            if (characterState) {
              characterState.scrollMotion = Math.max(
                -1,
                Math.min(1, self.getVelocity() / 2200),
              );
            }
            if (self.progress <= 0.015 && activeSection !== 'hero') {
              enterSectionDesktop('hero');
            } else if (self.progress >= 0.94 && activeSection !== 'contact') {
              enterSectionDesktop('contact');
            }
          },
        });

        // Sync initial section immediately if user loads mid-page
        const initialSec = detectActiveSection();
        if (initialSec !== 'hero') {
          enterSectionDesktop(initialSec);
        }
      });

      mm.add('(max-width: 1023px)', () => {
        gsap.set(motionRig.position, { x: 0, y: 0, z: 0 });
        gsap.set(motionRig.scale, { x: 0.86, y: 0.86, z: 0.86 });
        gsap.set(camera.position, { x: 0, y: 0.14, z: 6.2 });

        if (characterState) {
          gsap.set(characterState, {
            ...createDefaultStageState(),
            rootX: -0.2,
            rootY: -1.18,
            rootZ: -0.88,
            rootRotY: -0.06,
          });
        }

        SECTIONS.forEach((sec) => {
          const el = document.getElementById(sec);
          if (!el) return;
          ScrollTrigger.create({
            trigger: el,
            start: 'top 56%',
            end: 'bottom 56%',
            onEnter: () => enterSectionMobile(sec),
            onEnterBack: () => enterSectionMobile(sec),
          });
        });

        ScrollTrigger.create({
          trigger: scrollRoot,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            if (characterState) {
              characterState.scrollMotion = Math.max(
                -1,
                Math.min(1, self.getVelocity() / 2200),
              );
            }
            if (self.progress <= 0.015 && activeSection !== 'hero') {
              enterSectionMobile('hero');
            } else if (self.progress >= 0.94 && activeSection !== 'contact') {
              enterSectionMobile('contact');
            }
          },
        });

        const initialSec = detectActiveSection();
        if (initialSec !== 'hero') {
          enterSectionMobile(initialSec);
        }
      });
    });

    const handleReactEvent = (ev: Event) => {
      if (!characterState) return;
      const custom = ev as CustomEvent<{ kind?: string }>;
      const kind = custom.detail?.kind ?? 'pulse';
      const dir = kind === 'lens' ? -1 : 1;

      gsap.fromTo(
        characterState,
        { offsetY: 0, rimBoost: 0.25 },
        {
          offsetY: 0.055,
          offsetX: dir * 0.04,
          rimBoost: 0.85,
          duration: 0.24,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          overwrite: 'auto',
        },
      );
    };

    const handleRefreshScroll = () => {
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        const currentSec = detectActiveSection();
        if (currentSec !== activeSection) {
          if (window.innerWidth >= 1024) {
            enterSectionDesktop(currentSec);
          } else {
            enterSectionMobile(currentSec);
          }
        }
      });
    };

    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      sceneCtrl.setPointerTarget(nx, ny);
    };

    const handleResize = () => {
      sceneCtrl.resize();
      if (window.innerWidth >= 1024 && characterState) {
        if (activeSection === 'hero') {
          const { worldX } = getLanePlacement('about', 0.28);
          gsap.set(characterState, { rootX: worldX, scale: 0.96 });
        } else {
          const { worldX, laneScale } = getLanePlacement(
            activeSection,
            characterState.rootZ,
          );
          gsap.set(characterState, { rootX: worldX, scale: laneScale });
        }
      }
      ScrollTrigger.refresh();
    };

    window.addEventListener('achraf:react', handleReactEvent);
    window.addEventListener('achraf:refresh-scroll', handleRefreshScroll);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize);

    const refreshRaf = requestAnimationFrame(() => ScrollTrigger.refresh());
    document.fonts?.ready.then(() => {
      ScrollTrigger.refresh();
    });

    return () => {
      stopAmbientReaction();
      cancelAnimationFrame(refreshRaf);
      window.removeEventListener('achraf:react', handleReactEvent);
      window.removeEventListener('achraf:refresh-scroll', handleRefreshScroll);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      ctx.revert();
      sceneCtrl.dispose();
      controllerRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        ref={canvasMountRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 lg:z-[15] pointer-events-none opacity-35 lg:opacity-100 transition-opacity duration-300"
      />

      <div
        aria-live="polite"
        className={`fixed bottom-5 right-5 z-20 pointer-events-none transition-all duration-500 ${
          isReady ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="px-3.5 py-2 rounded-md border border-line-dark bg-[#12141A]/95 shadow-sm">
          <div className="flex items-center justify-between gap-4 font-mono text-[11px] tracking-wider text-stone-light">
            <span>Loading 3D Character</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="mt-1.5 h-0.5 w-32 bg-line-dark overflow-hidden">
            <div
              className="h-full bg-warm-light transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
