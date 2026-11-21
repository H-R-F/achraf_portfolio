import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform, type MotionValue } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Code,
  ExternalLink,
  GitBranch,
  Scale,
  Shield,
  Terminal,
  Users,
  X,
} from 'lucide-react';
import TiltCard, { Reveal3D } from './TiltCard';

// ---------------------------------------------------------------------------
// 01. Dual Foundation (About + Education Path)
// ---------------------------------------------------------------------------
function IlluminateWord({
  word,
  index,
  total,
  progress,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const start = index / total;
  const end = Math.min(1, start + 1.5 / total);
  const opacity = useTransform(progress, [start, end], [0.24, 1]);

  return (
    <motion.span style={{ opacity }} className="inline-block mr-[0.26em]">
      {word}
    </motion.span>
  );
}

function ScrollIlluminateText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.88', 'end 0.48'],
  });
  const words = text.split(/\s+/);

  return (
    <p ref={containerRef} className={className}>
      {words.map((word, idx) => (
        <IlluminateWord
          key={`${word}-${idx}`}
          word={word}
          index={idx}
          total={words.length}
          progress={scrollYProgress}
        />
      ))}
    </p>
  );
}

export function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const pathSteps = [
    {
      stage: '01',
      title: 'Licence en Droit',
      org: 'Université Hassan II · Casablanca',
      period: 'Legal Foundation',
      detail: 'Civil law, regulatory frameworks, obligations, and rights protection.',
    },
    {
      stage: '02',
      title: 'Web Development Certification',
      org: 'LionsGeek · Casablanca',
      period: 'Oct 2023',
      detail: 'Intensive full-stack training bridging theory and production engineering.',
    },
    {
      stage: '03',
      title: 'Web Developer',
      org: '2M TV · Casablanca',
      period: 'Industry Practice',
      detail: 'Built and shipped digital web products inside a national media organization.',
    },
    {
      stage: '04',
      title: 'Software Engineering',
      org: '1337 · 42 Network, UM6P',
      period: 'Current',
      detail: 'Systems programming, algorithms, and peer-to-peer problem solving.',
    },
  ];

  return (
    <div ref={ref} className="space-y-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="space-y-6 text-base text-stone dark:text-stone-light max-w-[68ch] leading-relaxed"
          >
            <ScrollIlluminateText
              text="I began with a Licence en Droit — studying how societies codify rules, allocate responsibility, and protect individual rights. I moved into software engineering because governing technology responsibly requires understanding how systems actually run underneath."
              className="text-xl sm:text-2xl text-ink dark:text-cream leading-snug font-medium"
            />
            <p>
              Today I am training at{' '}
              <span className="font-medium text-ink dark:text-cream">
                1337 (42 Network, UM6P)
              </span>
              , deepening my foundations in systems programming and architecture through project-based peer learning. Previously, I worked as a web developer at{' '}
              <span className="font-medium text-ink dark:text-cream">2M TV</span> after completing intensive training at{' '}
              <span className="font-medium text-ink dark:text-cream">LionsGeek</span>.
            </p>
            <p>
              My focus is the bridge between two disciplines that rarely speak the same language: writing resilient code while reasoning clearly about data protection, cybersecurity governance, regulatory compliance, and AI accountability.
            </p>

            {/* Editorial Pull Quote — hairline top/bottom instead of thick left border */}
            <blockquote className="my-8 py-6 border-y border-line dark:border-line-dark">
              <p className="font-serif italic text-xl sm:text-2xl text-ink dark:text-cream leading-snug">
                “Understanding technology is powerful. Understanding the rules around technology makes that understanding durable.”
              </p>
            </blockquote>
          </motion.div>
        </div>

        {/* Career Trajectory Dossier */}
        <Reveal3D direction="right" className="lg:col-span-5">
          <TiltCard className="bg-white/92 dark:bg-[#12141A]/92 border border-line dark:border-line-dark rounded-lg p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-line dark:border-line-dark">
              <h3 className="text-sm font-semibold text-ink dark:text-cream tracking-tight">
                Chronology
              </h3>
              <span className="font-mono text-xs tabular-nums text-stone dark:text-stone-light">
                Law to Systems
              </span>
            </div>

            <div className="divide-y divide-line dark:divide-line-dark">
              {pathSteps.map((step) => (
                <div key={step.stage} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  <span className="font-mono text-xs tabular-nums text-accent dark:text-accent-light pt-0.5 shrink-0">
                    {step.stage}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <h4 className="text-sm font-semibold text-ink dark:text-cream">
                        {step.title}
                      </h4>
                      <span className="font-mono text-xs tabular-nums text-stone dark:text-stone-light">
                        {step.period}
                      </span>
                    </div>
                    <p className="text-xs text-warm dark:text-warm-light mt-0.5">{step.org}</p>
                    <p className="text-xs text-stone dark:text-stone-light mt-1.5 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TiltCard>
        </Reveal3D>
      </div>

      {/* Education Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Reveal3D direction="left">
          <TiltCard className="bg-white/92 dark:bg-[#12141A]/92 border border-line dark:border-line-dark rounded-lg p-6 sm:p-8 h-full">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md border border-line dark:border-line-dark flex items-center justify-center text-accent dark:text-accent-light shrink-0">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream">
                    1337 — 42 Network
                  </h3>
                  <p className="text-xs text-stone dark:text-stone-light">
                    UM6P · Current
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-stone dark:text-stone-light leading-relaxed">
              Intensive software engineering with zero traditional lectures. Mastery comes through low-level problem solving, peer code reviews, debugging under constraints, and building foundational systems from scratch.
            </p>
            <p className="mt-5 pt-4 border-t border-line dark:border-line-dark font-mono text-xs text-stone dark:text-stone-light">
              Peer Learning · Systems Thinking · C / C++ · Algorithms
            </p>
          </TiltCard>
        </Reveal3D>

        <Reveal3D direction="right">
          <TiltCard className="bg-white/92 dark:bg-[#12141A]/92 border border-line dark:border-line-dark rounded-lg p-6 sm:p-8 h-full">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md border border-line dark:border-line-dark flex items-center justify-center text-warm dark:text-warm-light shrink-0">
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream">
                    Licence en Droit
                  </h3>
                  <p className="text-xs text-stone dark:text-stone-light">
                    Université Hassan II · Casablanca
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-stone dark:text-stone-light leading-relaxed">
              Formal legal training in civil law, regulatory architecture, and statutory interpretation. Shapes how I evaluate compliance obligations, privacy boundaries, and risk before writing production code.
            </p>
            <p className="mt-5 pt-4 border-t border-line dark:border-line-dark font-mono text-xs text-stone dark:text-stone-light">
              Civil Law · Regulatory Analysis · Legal Research · Risk Reasoning
            </p>
          </TiltCard>
        </Reveal3D>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 02. Experience & 1337 Methodology
// ---------------------------------------------------------------------------
export function Experience() {
  const experiences = [
    {
      index: '01',
      company: '2M TV',
      role: 'Web Developer',
      location: 'Casablanca, Morocco',
      period: 'Industry Experience',
      description:
        'Contributed to digital web projects inside one of Morocco’s leading national television networks, translating editorial and operational requirements into reliable web interfaces.',
      meta: 'Web Development · Media Production · Collaborative Delivery',
    },
    {
      index: '02',
      company: 'LionsGeek',
      role: 'Web Development Training & Certification',
      location: 'Casablanca, Morocco',
      period: 'October 2023',
      description:
        'Completed an intensive full-stack web engineering curriculum spanning modern frontend architecture, backend APIs, and applied project delivery that led directly to my role at 2M TV.',
      meta: 'Full-Stack Web · Modern Tooling · Certified Oct 2023',
    },
  ];

  const principles = [
    {
      icon: <TargetIcon />,
      title: 'Learning by Building',
      description: 'Real engineering intuition comes from shipping systems and testing edge cases.',
    },
    {
      icon: <Users size={16} />,
      title: 'Peer Code Review',
      description: 'Defending architectural choices to peers sharpens clarity and accountability.',
    },
    {
      icon: <Terminal size={16} />,
      title: 'Debugging as Inquiry',
      description: 'Tracing failures to root causes builds disciplined mental models of systems.',
    },
    {
      icon: <BookOpen size={16} />,
      title: 'Self-Directed Rigor',
      description: 'Identifying gaps independently across both legal texts and technical specs.',
    },
    {
      icon: <GitBranch size={16} />,
      title: 'Systems Thinking',
      description: 'Seeing how data, infrastructure, and human rules interact across boundaries.',
    },
    {
      icon: <Shield size={16} />,
      title: 'Sustained Persistence',
      description: 'Complex problems demand patient iteration, verification, and precision.',
    },
  ];

  return (
    <div className="space-y-16">
      {/* Architectural Numbered Experience Rows */}
      <div className="divide-y divide-line dark:divide-line-dark border-y border-line dark:border-line-dark">
        {experiences.map((exp) => (
          <Reveal3D key={exp.index} direction="up">
            <div className="group py-8 sm:py-11 flex flex-col md:flex-row items-start gap-5 sm:gap-8 md:gap-12">
              <div
                className="shrink-0 font-display font-black tabular-nums leading-none text-ink dark:text-cream select-none"
                style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.6rem)' }}
              >
                {exp.index}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="relative inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-ink dark:text-cream">
                      {exp.company}
                    </h3>
                    <span className="text-sm font-medium text-accent dark:text-accent-light">
                      {exp.role}
                    </span>
                    <span className="absolute left-0 -bottom-1 h-px w-0 bg-accent dark:bg-accent-light transition-all duration-500 group-hover:w-full" />
                  </div>
                  <div className="font-mono text-xs tabular-nums text-stone dark:text-stone-light">
                    {exp.period} · {exp.location}
                  </div>
                </div>
                <p className="text-sm sm:text-base text-stone dark:text-stone-light mt-4 max-w-2xl leading-relaxed">
                  {exp.description}
                </p>
                <p className="mt-4 font-mono text-xs text-stone-light dark:text-stone-light">
                  {exp.meta}
                </p>
              </div>
            </div>
          </Reveal3D>
        ))}
      </div>

      {/* 1337 Methodology */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-serif font-semibold text-ink dark:text-cream">
              The 1337 Methodology
            </h3>
            <p className="text-sm text-stone dark:text-stone-light mt-1">
              How I learn, debug, and collaborate under the 42 peer-learning model.
            </p>
          </div>
          <p className="font-serif italic text-sm text-stone dark:text-stone-light">
            “The 42 pedagogy doesn’t teach you to code. It teaches you to learn.”
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {principles.map((p) => (
            <div
              key={p.title}
              className="p-5 bg-white/85 dark:bg-[#12141A]/85 border border-line dark:border-line-dark rounded-lg"
            >
              <div className="flex items-center gap-2.5 text-ink dark:text-cream font-medium text-sm">
                <span className="text-accent dark:text-accent-light shrink-0">{p.icon}</span>
                <span>{p.title}</span>
              </div>
              <p className="text-xs text-stone dark:text-stone-light mt-2 leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TargetIcon() {
  return <Code size={16} />;
}

// ---------------------------------------------------------------------------
// 03. Selected Works (Filterable Catalog + Interactive Case Study Modal)
// ---------------------------------------------------------------------------
type ProjectCategory = 'all' | 'systems' | 'fullstack' | 'algorithms';

interface ProjectItem {
  number: string;
  name: string;
  category: Exclude<ProjectCategory, 'all'>;
  categoryLabel: string;
  description: string;
  problem: string;
  learning: string;
  governanceLens: string;
  techLine: string;
  github: string;
}

const PROJECTS: ProjectItem[] = [
  {
    number: '01',
    name: 'Chaos Engineering Playground',
    category: 'systems',
    categoryLabel: 'Systems & Resilience',
    description:
      'Experimental environment for testing distributed system resilience through controlled fault injection.',
    problem:
      'Understanding how services degrade under unexpected latency, packet loss, and node failures before incidents occur in production.',
    learning:
      'Explored failure-mode isolation, graceful degradation, and how observability reveals weak links in distributed architectures.',
    governanceLens:
      'Maps directly to operational resilience mandates and cybersecurity continuity planning.',
    techLine: 'Go · Systems · Fault Injection · Resilience',
    github: 'https://github.com/sabir7achraf/Chaos-Engineering-Playground',
  },
  {
    number: '02',
    name: 'Traveling Salesman Problem',
    category: 'algorithms',
    categoryLabel: 'Algorithms & Optimization',
    description:
      'Algorithmic implementations exploring combinatorial optimization, graph theory, and heuristic tradeoffs.',
    problem:
      'Finding near-optimal routes across weighted graphs where exact brute-force search becomes computationally intractable.',
    learning:
      'Analyzed NP-hard complexity bounds and balanced solution optimality against deterministic runtime budgets.',
    governanceLens:
      'Reinforces transparent, verifiable algorithmic tradeoffs over opaque heuristic black boxes.',
    techLine: 'Java · Algorithms · Graph Theory · Heuristics',
    github: 'https://github.com/sabir7achraf/Traveling-Salesman-Problem',
  },
  {
    number: '03',
    name: 'LASAN',
    category: 'fullstack',
    categoryLabel: 'TypeScript Application',
    description:
      'TypeScript web application exploring modular state architecture and strongly typed UI engineering.',
    problem:
      'Maintaining reliability and developer clarity across interactive frontend workflows as application scope grows.',
    learning:
      'Applied strict TypeScript contracts and modular component boundaries to eliminate whole classes of runtime errors.',
    governanceLens:
      'Type safety and explicit data schemas mirror clear contractual boundaries in software.',
    techLine: 'TypeScript · Web Architecture · UI Systems',
    github: 'https://github.com/sabir7achraf/LASAN',
  },
  {
    number: '04',
    name: 'MYO — Moroccan Youth Organization',
    category: 'fullstack',
    categoryLabel: 'Full-Stack Platform',
    description:
      'End-to-end organizational web platform pairing a Spring Boot REST backend with an Angular frontend.',
    problem:
      'Delivering a structured digital platform for organizational workflows, member records, and administrative operations.',
    learning:
      'Connected relational persistence, backend API contracts, and client-side views into a cohesive full-stack architecture.',
    governanceLens:
      'Requires clean separation of user roles, data access boundaries, and auditability.',
    techLine: 'Spring Boot · Angular · Full Stack · REST APIs',
    github: 'https://github.com/sabir7achraf/MYO',
  },
  {
    number: '05',
    name: 'Infrastructure as Code — Terraform',
    category: 'systems',
    categoryLabel: 'Cloud Infrastructure',
    description:
      'Declarative cloud resource provisioning and reproducible environment configuration using Terraform.',
    problem:
      'Eliminating configuration drift and undocumented manual infrastructure changes that undermine security and repeatability.',
    learning:
      'Practiced declarative state management, modular resource definitions, and reviewable infrastructure diffs.',
    governanceLens:
      'Infrastructure as Code makes security controls auditable, version-controlled, and compliant by design.',
    techLine: 'Terraform · HCL · Cloud Provisioning · IaC',
    github: 'https://github.com/sabir7achraf/Terraform',
  },
  {
    number: '06',
    name: 'Speech Recognition System',
    category: 'algorithms',
    categoryLabel: 'Audio & Web APIs',
    description:
      'Browser-based speech recognition application bridging real-time audio capture and machine intelligence.',
    problem:
      'Transforming continuous human speech into structured digital input with accessible, responsive client feedback.',
    learning:
      'Explored browser Web Audio/Speech APIs, asynchronous event streams, and real-time voice processing.',
    governanceLens:
      'Highlights consent, biometric voice data minimization, and transparency in AI interfaces.',
    techLine: 'JavaScript · Web APIs · Audio Processing · Accessibility',
    github: 'https://github.com/sabir7achraf/Speech-Recognition',
  },
];

const FILTER_TABS: { id: ProjectCategory; label: string }[] = [
  { id: 'all', label: 'All Works' },
  { id: 'systems', label: 'Systems & Infra' },
  { id: 'fullstack', label: 'Full-Stack' },
  { id: 'algorithms', label: 'Algorithms & Audio' },
];

export function Projects() {
  const [filter, setFilter] = useState<ProjectCategory>('all');
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  const visibleProjects =
    filter === 'all' ? PROJECTS : PROJECTS.filter((p) => p.category === filter);

  useEffect(() => {
    if (!selectedProject) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProject(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProject]);

  return (
    <div className="space-y-8">
      {/* Functional Segmented Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter projects by discipline"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-cream-dark/80 dark:bg-[#12141A] border border-line dark:border-line-dark rounded-lg"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(tab.id);
                  window.dispatchEvent(
                    new CustomEvent('achraf:react', { detail: { kind: 'projects' } }),
                  );
                  window.dispatchEvent(new Event('achraf:refresh-scroll'));
                }}
                className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#1E222D] text-ink dark:text-cream shadow-xs'
                    : 'text-stone dark:text-stone-light hover:text-ink dark:hover:text-cream'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <span className="font-mono text-xs tabular-nums text-stone dark:text-stone-light">
          Showing {visibleProjects.length} of {PROJECTS.length} works
        </span>
      </div>

      {/* Architectural Project Showcase Cards */}
      <div className="space-y-6">
        {visibleProjects.map((project) => (
          <Reveal3D key={project.number} direction="up">
            <TiltCard className="group bg-white/95 dark:bg-[#12141A]/95 border border-line dark:border-line-dark rounded-2xl p-6 sm:p-8 hover:border-accent/45 dark:hover:border-accent-light/45 transition-colors duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 space-y-2.5">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="font-display font-black tabular-nums leading-none text-ink/90 dark:text-cream"
                      style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
                    >
                      {project.number}
                    </span>
                    <span className="font-mono text-xs text-stone dark:text-stone-light">
                      {project.categoryLabel}
                    </span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-ink dark:text-cream group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-stone dark:text-stone-light leading-relaxed">
                    {project.description}
                  </p>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-ink dark:text-cream">
                        Problem Statement
                      </h4>
                      <p className="text-sm text-stone dark:text-stone-light mt-1 leading-relaxed">
                        {project.problem}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-ink dark:text-cream">
                        Governance & Trust Lens
                      </h4>
                      <p className="text-sm text-stone dark:text-stone-light mt-1 leading-relaxed">
                        {project.governanceLens}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line dark:border-line-dark flex flex-wrap items-center justify-between gap-4">
                    <span className="font-mono text-xs text-stone dark:text-stone-light">
                      {project.techLine}
                    </span>
                    <div className="flex items-center gap-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedProject(project)}
                        className="px-3.5 py-2 text-xs font-medium text-ink dark:text-cream border border-line dark:border-line-dark rounded-md hover:border-accent dark:hover:border-accent-light transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Architecture Notes
                      </button>
                      <a
                        href={project.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent dark:text-accent-light hover:underline whitespace-nowrap shrink-0"
                      >
                        Source on GitHub <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </Reveal3D>
        ))}
      </div>

      {/* Case Study Dossier Modal */}
      {selectedProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dossier-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/55"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-[#12141A] border border-line dark:border-line-dark rounded-lg p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-line dark:border-line-dark">
              <div>
                <p className="font-mono text-xs tabular-nums text-stone dark:text-stone-light">
                  Work {selectedProject.number} · {selectedProject.categoryLabel}
                </p>
                <h3
                  id="dossier-title"
                  className="text-2xl font-serif font-semibold text-ink dark:text-cream mt-1"
                >
                  {selectedProject.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                aria-label="Close dossier"
                className="p-2 text-stone dark:text-stone-light hover:text-ink dark:hover:text-cream rounded-md border border-line dark:border-line-dark cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-ink dark:text-cream">Overview</h4>
                <p className="text-sm text-stone dark:text-stone-light mt-1.5 leading-relaxed">
                  {selectedProject.description}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink dark:text-cream">
                  Engineering Problem
                </h4>
                <p className="text-sm text-stone dark:text-stone-light mt-1.5 leading-relaxed">
                  {selectedProject.problem}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink dark:text-cream">
                  Key Technical Learning
                </h4>
                <p className="text-sm text-stone dark:text-stone-light mt-1.5 leading-relaxed">
                  {selectedProject.learning}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink dark:text-cream">
                  Legal, Risk & Governance Angle
                </h4>
                <p className="text-sm text-stone dark:text-stone-light mt-1.5 leading-relaxed">
                  {selectedProject.governanceLens}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-line dark:border-line-dark flex flex-wrap items-center justify-between gap-4">
              <span className="font-mono text-xs text-stone dark:text-stone-light">
                {selectedProject.techLine}
              </span>
              <a
                href={selectedProject.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                Open GitHub Repository <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 04. Capabilities, Intersection Matrix & Career Direction
// ---------------------------------------------------------------------------
type LensMode = 'legal' | 'technical' | 'outcome';

export function SkillsAndIntersection() {
  const [lens, setLens] = useState<LensMode>('outcome');

  const skillDomains = [
    {
      title: 'Software Engineering',
      items: 'C / C++ · Java · TypeScript · JavaScript · Python · Go · Spring Boot · Angular · Next.js',
    },
    {
      title: 'Systems & Infrastructure',
      items: 'Linux · Shell Scripting · Terraform · Networking · System Programming · Git',
    },
    {
      title: 'Engineering Practices',
      items: 'Algorithm Design · Debugging · Architecture · Peer Review · Technical Documentation',
    },
    {
      title: 'Trust & Technology',
      items: 'Data Protection · Privacy Frameworks · Cybersecurity · Compliance · AI Governance',
    },
    {
      title: 'Legal & Analytical',
      items: 'Regulatory Analysis · Legal Research · Risk Assessment · Policy Interpretation',
    },
  ];

  const pillars = [
    {
      title: 'Law & Regulation',
      legal: 'Interpreting statutory obligations, liability boundaries, and compliance mandates.',
      technical: 'Translating legal clauses into concrete system constraints and data retention rules.',
      outcome: 'Software designed around regulatory reality before deployment.',
    },
    {
      title: 'Systems Engineering',
      legal: 'Understanding operational accountability when automated workflows make decisions.',
      technical: 'Reasoning at the memory, network, and infrastructure level rather than surface APIs.',
      outcome: 'Resilient architectures built with verifiable operational behavior.',
    },
    {
      title: 'Privacy & Data Protection',
      legal: 'Applying consent, purpose limitation, and data minimization principles.',
      technical: 'Auditing exactly how personal data moves across schemas, caches, and logs.',
      outcome: 'Privacy-preserving data pipelines grounded in technical truth.',
    },
    {
      title: 'Cybersecurity GRC',
      legal: 'Aligning organizational governance, risk tolerance, and compliance reporting.',
      technical: 'Evaluating threat models, access controls, and declarative infrastructure safeguards.',
      outcome: 'Bridging audit frameworks with real engineering controls.',
    },
    {
      title: 'AI Governance',
      legal: 'Examining transparency, accountability, and societal impact of intelligent systems.',
      technical: 'Inspecting model inputs, audio/data pipelines, and deterministic fallbacks.',
      outcome: 'Responsible automation supported by clear oversight.',
    },
  ];

  const directions = [
    { title: 'Software Engineering', status: 'Active', note: 'Core systems & web engineering at 1337' },
    { title: 'Cybersecurity GRC', status: 'Building toward', note: 'Governance, risk, and technical compliance' },
    { title: 'Privacy & Data Protection', status: 'Exploring', note: 'Data lifecycle mapping & safeguards' },
    { title: 'AI Governance', status: 'Developing', note: 'Regulation, risk, and accountability in AI' },
    { title: 'Technology Compliance', status: 'Exploring', note: 'Translating legal obligations into engineering' },
    { title: 'Legal Technology', status: 'Interested in', note: 'Tools bridging legal workflows & code' },
  ];

  return (
    <div className="space-y-20">
      {/* Capabilities Ledger */}
      <div className="divide-y divide-line dark:divide-line-dark border-y border-line dark:border-line-dark">
        {skillDomains.map((domain) => (
          <div
            key={domain.title}
            className="py-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-8 items-baseline"
          >
            <h3 className="md:col-span-4 text-sm font-semibold text-ink dark:text-cream">
              {domain.title}
            </h3>
            <p className="md:col-span-8 font-mono text-xs text-stone dark:text-stone-light leading-relaxed">
              {domain.items}
            </p>
          </div>
        ))}
      </div>

      {/* Interactive Law × Technology Synthesis Matrix */}
      <div id="intersection" className="scroll-mt-24 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <span className="section-index">04B · The Intersection</span>
            <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-ink dark:text-cream tracking-tight">
              Why This Combination Matters
            </h3>
            <p className="mt-2 text-sm text-stone dark:text-stone-light max-w-xl">
              Toggle the analytical lens below to inspect how legal reasoning and systems engineering reinforce one another across each domain.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Inspect intersection lens"
            className="inline-flex items-center gap-1 p-1 bg-cream-dark/80 dark:bg-[#12141A] border border-line dark:border-line-dark rounded-lg self-start lg:self-auto"
          >
            {(
              [
                { id: 'legal', label: 'Legal Lens' },
                { id: 'technical', label: 'Systems Lens' },
                { id: 'outcome', label: 'Trust Outcome' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={lens === tab.id}
                onClick={() => {
                  setLens(tab.id);
                  window.dispatchEvent(
                    new CustomEvent('achraf:react', { detail: { kind: 'lens' } }),
                  );
                }}
                className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  lens === tab.id
                    ? 'bg-white dark:bg-[#1E222D] text-ink dark:text-cream shadow-xs'
                    : 'text-stone dark:text-stone-light hover:text-ink dark:hover:text-cream'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="p-6 bg-white/92 dark:bg-[#12141A]/92 border border-line dark:border-line-dark rounded-lg flex flex-col justify-between"
            >
              <div>
                <h4 className="text-base font-serif font-semibold text-ink dark:text-cream">
                  {pillar.title}
                </h4>
                <p className="text-sm text-stone dark:text-stone-light mt-3 leading-relaxed">
                  {pillar[lens]}
                </p>
              </div>
              <p className="mt-5 pt-3 border-t border-line dark:border-line-dark font-mono text-[11px] text-accent dark:text-accent-light">
                {lens === 'legal'
                  ? 'Regulatory Perspective'
                  : lens === 'technical'
                  ? 'Engineering Mechanism'
                  : 'Synthesized Value'}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm text-stone dark:text-stone-light max-w-3xl leading-relaxed">
          <span className="font-medium text-ink dark:text-cream">
            Building deliberately toward this intersection.
          </span>{' '}
          My legal degree provides a structured framework for analyzing obligations and risk; my engineering training gives me the discipline to inspect and build the underlying systems.
        </p>
      </div>

      {/* Career Direction Compass */}
      <div id="direction" className="scroll-mt-24 space-y-6">
        <div>
          <span className="section-index">04C · Career Trajectory</span>
          <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-ink dark:text-cream tracking-tight">
            Where I’m Heading
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {directions.map((dir) => (
            <div
              key={dir.title}
              className="p-5 bg-white/85 dark:bg-[#12141A]/85 border border-line dark:border-line-dark rounded-lg"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink dark:text-cream">{dir.title}</h4>
                <span className="font-mono text-[11px] text-warm dark:text-warm-light shrink-0">
                  {dir.status}
                </span>
              </div>
              <p className="text-xs text-stone dark:text-stone-light mt-2 leading-relaxed">
                {dir.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 05. Contact
// ---------------------------------------------------------------------------
export function Contact() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-white/12 bg-[#0B0D13]/92 p-7 sm:p-10 md:p-12"
      >
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone-light">
          05 · Connect
        </span>
        <div className="mt-4 editorial-rule w-20 mx-auto lg:mx-0" />
        <h2
          className="mt-5 font-display font-black uppercase leading-[0.94] tracking-tight text-cream text-balance"
          style={{ fontSize: 'clamp(2.15rem, 4.4vw, 3.6rem)' }}
        >
          Let’s build systems worthy of{' '}
          <span className="text-accent-light">trust.</span>
        </h2>
        <p className="mt-5 text-base text-stone-light max-w-lg mx-auto lg:mx-0 leading-relaxed">
          Open to software engineering roles and conversations at the intersection of technology, privacy, cybersecurity GRC, and AI governance.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-4">
          <a
            href="https://www.linkedin.com/in/achrafbensabir/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            Connect on LinkedIn <ArrowRight size={16} />
          </a>
          <a
            href="https://github.com/sabir7achraf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/15 bg-[#12141A] text-cream text-sm font-medium rounded-md hover:border-accent-light transition-colors whitespace-nowrap shrink-0"
          >
            Explore GitHub
          </a>
        </div>

        <p className="mt-8 pt-5 border-t border-white/10 font-mono text-xs text-stone-light">
          Casablanca, Morocco · 1337 / 42 Network · Open to opportunities
        </p>
      </motion.div>
    </div>
  );
}
