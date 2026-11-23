import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  ArrowUpRight,
  Github,
  Linkedin,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  About,
  Experience,
  Projects,
  SkillsAndIntersection,
  Contact,
} from './components/Sections';
import { Reveal3D } from './components/TiltCard';
import ScrollScene3D from './components/ScrollScene3D';
import PortraitLogo from './components/PortraitLogo';
import studioBackdropUrl from './assets/images/studio_hero_backdrop_1795221256260.jpg';

const HERO_CLIPS = [
  {
    src: '/assets/aistudio/Untitled_Scene_11-21_01_27_55_ee9e5aea_ebcae4f5.mp4',
    startZoomCompensation: 1,
    endZoomCompensation: 1,
  },
  {
    src: '/assets/aistudio/Untitled_Scene_11-21_03_40_32-clip-2_5d9794b7_dc90240b.mp4',
    // Clip 2 begins pulled back (1.0x) and pushes inward (~1.38x) like Clip 1;
    // compensating 1.38 -> 1.0 keeps Clip 1's zoomed-in camera framing locked seamlessly.
    startZoomCompensation: 1.38,
    endZoomCompensation: 1,
  },
] as const;

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
  { label: 'Intersection', href: '#intersection' },
  { label: 'Contact', href: '#contact' },
];

// Top Bar Contract: Zone 1 (logo mark + wordmark) — Zone 2 (5 concise links) — Zone 3 (1 primary action)
function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? Math.min(100, (y / docHeight) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-200 ${
        scrolled
          ? 'bg-[#0A0B0E]/95 border-b border-line-dark'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1460px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Animated Portrait Sketch Logo + Wordmark */}
        <a
          href="#hero"
          className="inline-flex items-center gap-3 font-display text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0 text-cream"
        >
          <PortraitLogo isDark={true} size={42} />
          <span>Achraf Ben Sabir</span>
        </a>

        {/* Zone 2: Concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs font-medium uppercase tracking-[0.18em] transition-colors whitespace-nowrap shrink-0 text-stone-light hover:text-cream"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#contact"
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-md hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            Get in Touch <ArrowUpRight size={14} />
          </a>

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="md:hidden p-2 cursor-pointer transition-colors text-cream"
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Hairline reading progress indicator */}
      <div className="h-[1px] w-full bg-transparent">
        <div
          className="h-full bg-warm-light transition-[width] duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0A0B0E] border-b border-line-dark overflow-hidden"
          >
            <div className="px-6 py-4 space-y-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block py-2.5 text-sm font-medium text-stone-light hover:text-cream"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1.5 mt-2 px-4 py-2.5 text-xs font-medium bg-accent text-white rounded-md"
              >
                Get in Touch <ArrowUpRight size={14} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero() {
  const ref = useRef(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const zoomLayerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeClipRef = useRef(0);
  const isMutedRef = useRef(true);
  const isSwitchingRef = useRef(false);

  const isInView = useInView(ref, { once: true });
  const [activeClip, setActiveClip] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showSoundHint, setShowSoundHint] = useState(true);

  const switchToClip = (nextIndex: number) => {
    if (isSwitchingRef.current) return;
    isSwitchingRef.current = true;

    const prevIndex = activeClipRef.current;
    const prevVid = videoRefs.current[prevIndex];
    const nextVid = videoRefs.current[nextIndex];
    const nextLayer = zoomLayerRefs.current[nextIndex];
    const nextClip = HERO_CLIPS[nextIndex];

    if (nextLayer) {
      nextLayer.style.transform = `scale(${nextClip.startZoomCompensation})`;
    }

    if (nextVid) {
      nextVid.currentTime = 0;
      nextVid.muted = isMutedRef.current;
      void nextVid.play();
    }

    activeClipRef.current = nextIndex;
    setActiveClip(nextIndex);

    window.setTimeout(() => {
      if (prevVid && prevIndex !== activeClipRef.current) {
        prevVid.pause();
        prevVid.currentTime = 0;
      }
      isSwitchingRef.current = false;
    }, 260);
  };

  useEffect(() => {
    isMutedRef.current = isMuted;
    videoRefs.current.forEach((vid) => {
      if (vid) vid.muted = isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.85 && !isMutedRef.current) {
        isMutedRef.current = true;
        videoRefs.current.forEach((vid) => {
          if (vid) vid.muted = true;
        });
        setIsMuted(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Continuous RAF loop: keeps Clip 2 locked at Clip 1's zoomed-in framing & triggers gapless handoff
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const idx = activeClipRef.current;
      const vid = videoRefs.current[idx];
      const clip = HERO_CLIPS[idx];
      const layer = zoomLayerRefs.current[idx];

      if (vid && Number.isFinite(vid.duration) && vid.duration > 0) {
        const remaining = vid.duration - vid.currentTime;

        if (clip.startZoomCompensation !== clip.endZoomCompensation && layer) {
          const progress = Math.min(1, Math.max(0, vid.currentTime / vid.duration));
          // Cancel Clip 2's raw camera push-in (1.00 -> 1.38) so effective scale stays locked
          const rawZoomFactor = 1 + (clip.startZoomCompensation - 1) * progress;
          const compensatedScale = clip.startZoomCompensation / rawZoomFactor;
          layer.style.transform = `scale(${compensatedScale.toFixed(4)})`;
        }

        if (!isSwitchingRef.current && remaining <= 0.14 && !vid.paused) {
          const nextIndex = (idx + 1) % HERO_CLIPS.length;
          switchToClip(nextIndex);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const toggleSound = () => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      vid.muted = nextMuted;
      if (i === activeClipRef.current && !nextMuted && vid.paused) {
        void vid.play();
      }
    });
    setIsMuted(nextMuted);
    setShowSoundHint(false);
  };

  const credentials = [
    { label: 'Legal Foundation', value: 'Licence en Droit · Hassan II' },
    { label: 'Engineering School', value: '1337 · 42 Network, UM6P' },
    { label: 'Media Production', value: 'Web Developer · 2M TV' },
    { label: 'Focus Domains', value: 'Privacy · Security GRC · AI Gov' },
  ];

  return (
    <section
      id="hero"
      data-scroll-stage="hero"
      ref={ref}
      className="min-h-screen flex flex-col justify-between relative overflow-hidden bg-[#090B0E] px-6 lg:px-10 pt-28 pb-10"
    >
      {/* Full-Bleed Studio Video Hero Sequence (framed right-of-center so headline clears cleanly on the left) */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <div className="w-full h-full lg:translate-x-[13%] xl:translate-x-[15%] scale-[1.03]">
          {HERO_CLIPS.map((clip, idx) => {
            const isActive = activeClip === idx;
            return (
              <div
                key={clip.src}
                ref={(el) => {
                  zoomLayerRefs.current[idx] = el;
                }}
                style={{
                  transformOrigin: '50% 33%',
                  transform: `scale(${clip.startZoomCompensation})`,
                }}
                className={`absolute inset-0 w-full h-full transition-opacity ${
                  idx === 0 && activeClip === 0 ? 'duration-500' : 'duration-200'
                } ${isActive ? 'opacity-100 z-[1]' : 'opacity-0 z-0'}`}
              >
                <video
                  ref={(el) => {
                    videoRefs.current[idx] = el;
                  }}
                  src={clip.src}
                  poster={idx === 0 ? studioBackdropUrl : undefined}
                  autoPlay={idx === 0}
                  muted
                  playsInline
                  preload="auto"
                  onEnded={() => {
                    if (activeClipRef.current === idx) {
                      switchToClip((idx + 1) % HERO_CLIPS.length);
                    }
                  }}
                  className="w-full h-full object-cover object-center"
                />
              </div>
            );
          })}
        </div>
        {/* Left-to-right obsidian studio melt keeping headline 100% legible and seam invisible */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090B0E] via-[#090B0E]/68 to-transparent" />
        {/* Subtle studio rim light wash bridging video ambiance to the scroll lighting rig */}
        <div
          className="absolute inset-0 opacity-75"
          style={{
            background:
              'radial-gradient(62% 58% at 74% 38%, rgba(232, 194, 148, 0.11) 0%, rgba(91, 124, 250, 0.08) 42%, transparent 74%)',
          }}
        />
        {/* Vertical cinematic edge scrims */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#090B0E]/55 via-transparent to-[#090B0E]/90" />
      </div>

      <div className="max-w-[1380px] mx-auto w-full my-auto relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Editorial Column (bold display typography framed alongside the studio video) */}
          <div className="lg:col-span-6 xl:col-span-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45 }}
              className="font-mono text-xs uppercase tracking-[0.28em] text-stone-light"
            >
              Portfolio · 2026 · Casablanca, Morocco
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="mt-4 font-display font-black uppercase leading-[0.88] tracking-tight text-cream text-balance"
              style={{ fontSize: 'clamp(3.1rem, 7.2vw, 6.1rem)' }}
            >
              Achraf
              <br />
              Ben Sabir
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="mt-5 font-mono text-xs sm:text-sm uppercase tracking-[0.22em] text-accent-light"
            >
              Software Engineer · Legal Background · Systems &amp; AI Governance
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.22 }}
              className="mt-5 text-base sm:text-lg text-stone-light max-w-lg leading-relaxed"
            >
              Where jurisprudence meets systems engineering — building resilient software across data privacy, cybersecurity compliance, and accountable AI.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <a
                href="#projects"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                Explore Selected Works
              </a>
              <a
                href="#about"
                className="inline-flex items-center gap-2 px-5 py-3 border border-white/20 bg-[#12141A]/75 text-cream text-sm font-medium rounded-md hover:border-accent-light transition-colors whitespace-nowrap shrink-0"
              >
                Read Background
              </a>
              <div className="flex items-center gap-4 pl-1">
                <a
                  href="https://github.com/H-R-F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-stone-light hover:text-cream transition-colors whitespace-nowrap shrink-0"
                >
                  <Github size={16} /> GitHub
                </a>
                <a
                  href="https://www.linkedin.com/in/achrafbensabir/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-stone-light hover:text-cream transition-colors whitespace-nowrap shrink-0"
                >
                  <Linkedin size={16} /> LinkedIn
                </a>
              </div>
            </motion.div>
          </div>

          {/* Right 6 columns frame the talking studio video with the Sound control anchored at bottom-right */}
          <div className="lg:col-span-6 lg:self-end flex items-end justify-start lg:justify-end pt-2 lg:pt-0">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={isMuted ? 'Enable video audio' : 'Mute video audio'}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] border border-white/20 bg-[#0D1017]/80 backdrop-blur-md text-cream rounded-md hover:border-accent-light hover:bg-[#141824] transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg"
            >
              {isMuted ? (
                <VolumeX size={15} className="text-stone-light" />
              ) : (
                <Volume2 size={15} className="text-accent-light" />
              )}
              <span>
                {isMuted && showSoundHint
                  ? 'Enable Sound'
                  : isMuted
                  ? 'Sound Muted'
                  : 'Audio On'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Full-Width 4-Column Credential Strip + Animated Scroll Line */}
      <div className="max-w-[1380px] mx-auto w-full relative z-20 pt-10">
        <div className="border-t border-white/15 pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-center">
          {credentials.map((cred) => (
            <div key={cred.label}>
              <div className="text-xs text-stone-light">{cred.label}</div>
              <div className="text-sm font-medium text-cream mt-0.5">{cred.value}</div>
            </div>
          ))}

          <div className="flex items-center justify-start sm:justify-end">
            <a
              href="#about"
              aria-label="Scroll to About section"
              className="group inline-flex flex-col items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-light hover:text-cream transition-colors whitespace-nowrap shrink-0"
            >
              <span>Scroll</span>
              <span className="relative h-6 w-px overflow-hidden bg-white/25">
                <span className="absolute inset-x-0 top-0 h-1/2 w-full bg-cream animate-scroll-line" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({
  id,
  children,
  className = '',
  flank = 'right',
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  flank?: 'left' | 'right';
}) {
  const laneSpacer = (
    <div
      data-character-lane={id}
      className="hidden lg:block lg:w-[300px] xl:w-[360px] 2xl:w-[410px] shrink-0"
      aria-hidden="true"
    />
  );

  return (
    <section id={id} className={`py-20 sm:py-28 px-6 lg:px-10 scroll-mt-16 ${className}`}>
      <div className="max-w-[1460px] w-full mx-auto flex flex-col lg:flex-row gap-8 xl:gap-12 items-stretch">
        {flank === 'left' && laneSpacer}
        <div className="flex-1 min-w-0">{children}</div>
        {flank === 'right' && laneSpacer}
      </div>
    </section>
  );
}

function SectionHeader({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Reveal3D direction="up">
      <div className="mb-12 sm:mb-14">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone-light">{index}</span>
        <h2
          className="mt-2.5 font-display font-black uppercase leading-[0.95] tracking-tight text-cream text-balance"
          style={{ fontSize: 'clamp(2.1rem, 4.4vw, 3.6rem)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3.5 text-base text-stone-light max-w-xl leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="mt-6 editorial-rule w-24" />
      </div>
    </Reveal3D>
  );
}

export default function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div
      data-scroll-root
      className="bg-[#0A0B0E] text-cream min-h-screen relative"
    >
      {/* Fixed full-viewport Three.js + GSAP ScrollTrigger character canvas */}
      <ScrollScene3D isDark={true} />

      <div className="relative z-10">
        <Header />
        <Hero />

        <Section id="about" flank="left" className="bg-[#0A0B0E]">
          <SectionHeader
            index="01 · About Me"
            title="Two Disciplines, One Direction"
            subtitle="Legal analysis paired with low-level and full-stack software engineering."
          />
          <About />
        </Section>

        <div className="bg-[#0A0B0E]">
          <Section
            id="experience"
            flank="right"
            className="rounded-t-[36px] md:rounded-t-[52px] bg-[#13161E] border-t border-white/12"
          >
            <SectionHeader
              index="02 · Experience & Practice"
              title="Engineering Rigor"
              subtitle="Production media delivery at 2M TV, intensive web training at LionsGeek, and peer-driven systems mastery at 1337."
            />
            <Experience />
          </Section>
        </div>

        <Section id="projects" flank="left" className="bg-[#0A0B0E]">
          <SectionHeader
            index="03 · Selected Works"
            title="Engineering Portfolio"
            subtitle="Filter by engineering discipline or inspect architectural and governance notes for each project."
          />
          <Projects />
        </Section>

        <Section
          id="skills"
          flank="right"
          className="bg-[#11131B] border-t border-white/10"
        >
          <SectionHeader
            index="04 · Capabilities & Synthesis"
            title="Technical & Regulatory Matrix"
            subtitle="Skills organized across engineering depth, trust frameworks, and legal reasoning."
          />
          <SkillsAndIntersection />
        </Section>

        {/* Matching backdrop behind rounded top edge eliminates corner seams between Skills and Contact */}
        <div className="bg-[#11131B]">
          <Section
            id="contact"
            flank="right"
            className="rounded-t-[36px] md:rounded-t-[52px] bg-[#13161E] border-t border-white/12 min-h-[62vh] flex items-center"
          >
            <Contact />
          </Section>
        </div>

        <footer className="bg-[#0B0D13] border-t border-white/10 py-8 px-6 lg:px-10">
          <div className="max-w-[1460px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-mono text-xs text-stone-light">
              © 2025 Achraf Ben Sabir · Casablanca, Morocco
            </span>
            <div className="flex items-center gap-6 text-xs text-stone-light">
              <a
                href="https://www.linkedin.com/in/achrafbensabir/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cream transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/H-R-F"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cream transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
