import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PortfolioScene } from './scene/PortfolioScene';
import { CursorGlow } from './CursorGlow';
import { MiniMap } from './MiniMap';
import { LangToggle } from './LangToggle';
import { journeyProgress, scrollState } from './scrollState';
import { useT, LINKS } from './i18n';

type SectionProps = {
  index: string;
  title: string;
  align?: 'left' | 'right' | 'center';
  // mobile: the title gets a screen of its own, so the section's celestial object
  // has an unobstructed showcase behind it. The body then scrolls in below, on its
  // own backdrop, while the astre slides away.
  showcase?: boolean;
  children: ReactNode;
};

// Fades a body panel in as it enters the viewport. Falls back to "already
// revealed" when IntersectionObserver is missing: the text must never depend on
// the observer to be readable.
const useRevealed = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = ref.current;
    if (!node || revealed) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      // fires once the panel is properly on screen, not the instant it pokes in
      { rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed]);

  return { ref, revealed };
};

const Section = ({ index, title, align = 'left', showcase, children }: SectionProps) => {
  const placement =
    align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto' : 'mr-auto';
  // ml-auto does nothing on a phone: the column is already narrower than max-w-2xl,
  // so a right-aligned section has to right-align its own type below md
  const rightOnMobile = align === 'right';
  const { ref, revealed } = useRevealed();

  return (
    // svh: sized to the small viewport so the collapsing mobile URL bar never shifts the layout
    <section className="flex min-h-svh items-center px-6 py-24 md:min-h-screen md:px-12">
      {/* max-w-6xl keeps content near the center on ultrawide screens */}
      <div className="mx-auto w-full max-w-6xl">
        {/* pointer-events: none on mobile so taps reach the 3D objects behind the
            full-screen title — only the body panel re-enables them */}
        <div className={`pointer-events-none w-full max-w-2xl md:pointer-events-auto ${placement}`}>
          <div
            className={
              showcase ? 'flex h-svh flex-col justify-start pt-28 md:block md:h-auto md:pt-0' : ''
            }
          >
            <div className="relative">
              <span
                aria-hidden
                className={`ghost-number absolute -top-20 text-[9rem] font-bold select-none md:-top-28 md:-left-2 md:text-[13rem] ${
                  rightOnMobile ? '-right-2 md:right-auto' : '-left-2'
                }`}
              >
                {index}
              </span>
              <h2
                className={`relative mb-4 bg-gradient-to-r from-neon-violet via-white to-neon-cyan bg-clip-text text-5xl font-bold text-transparent drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] md:text-7xl ${
                  rightOnMobile ? 'text-right md:text-left' : ''
                }`}
              >
                {title}
              </h2>
              <div
                className={`mb-10 h-px w-44 bg-gradient-to-r from-neon-cyan to-transparent shadow-[0_0_12px_#22d3ee] ${align === 'center' ? 'mx-auto' : ''} ${
                  rightOnMobile ? 'ml-auto bg-gradient-to-l md:ml-0 md:bg-gradient-to-r' : ''
                }`}
              />
            </div>
          </div>
          <div
            ref={ref}
            className={`holo-text pointer-events-auto ${showcase ? 'section-panel' : ''} ${
              showcase && !revealed ? 'is-hidden' : ''
            }`}
          >
            {children}
          </div>
          {/* mobile: empty scroll after each astre's text, so the next one is a
              journey away rather than the very next screenful */}
          {showcase && <div aria-hidden className="h-[38svh] md:hidden" />}
        </div>
      </div>
    </section>
  );
};

// Solid per-letter colors approximating the violet→pink gradient,
// so each letter can be an inline-block (required for the hover animation).
const lerpColor = (from: string, to: string, t: number) => {
  const f = parseInt(from.slice(1), 16);
  const g = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const a = (f >> shift) & 0xff;
    const b = (g >> shift) & 0xff;
    return Math.round(a + (b - a) * t);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
};

const HeroName = () => {
  const lastName = 'Bonvin';
  return (
    <h1 className="pointer-events-auto text-[2.5rem] font-bold whitespace-nowrap sm:text-6xl md:text-8xl">
      {'Adrien'.split('').map((letter, i) => (
        <span key={i} className="hero-letter">
          {letter}
        </span>
      ))}{' '}
      {lastName.split('').map((letter, i) => (
        <span
          key={i}
          className="hero-letter"
          style={{ color: lerpColor('#a855f7', '#f472b6', i / (lastName.length - 1)) }}
        >
          {letter}
        </span>
      ))}
    </h1>
  );
};

const TagPills = ({ tags }: { tags: string[] }) => (
  <div className="mt-2 flex flex-wrap gap-2">
    {tags.map((tag) => (
      <span
        key={tag}
        className="rounded-full border border-neon-pink/40 bg-neon-pink/10 px-3 py-1 text-xs font-bold text-neon-pink"
      >
        {tag}
      </span>
    ))}
  </div>
);

const ExternalLink = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
    {children}
  </a>
);

export const App = () => {
  const t = useT();

  useEffect(() => {
    const onScroll = () => {
      scrollState.progress = journeyProgress();
    };
    // Height-only resizes (mobile URL bar) must not recompute progress: it jumps.
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      onScroll();
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <PortfolioScene />
      <CursorGlow />
      <MiniMap />
      <LangToggle />

      {/* pointer-events-none lets hovers/clicks reach the 3D canvas; cards re-enable them */}
      <main className="pointer-events-none relative z-10">
        {/* Hero */}
        <section className="flex min-h-svh flex-col items-center justify-center px-6 text-center md:min-h-screen">
          <p className="mb-4 text-sm tracking-[0.4em] text-neon-cyan uppercase">{t.hero.kicker}</p>
          <HeroName />
          <p className="mt-6 max-w-md text-lg text-white/70">{t.hero.tagline}</p>
          <div className="mt-16 animate-bounce text-white/50">{t.hero.scroll}</div>
        </section>

        <Section index="01" title={t.about.title} showcase>
          <p className="text-lg leading-relaxed text-white/85 md:text-xl">
            {t.about.before}
            <ExternalLink
              href={LINKS.youtube}
              className="text-neon-cyan underline decoration-neon-cyan/40 underline-offset-4 transition hover:decoration-neon-cyan"
            >
              {t.about.youtube}
            </ExternalLink>
            {t.about.after}
          </p>
        </Section>

        <Section index="02" title={t.experience.title} align="right" showcase>
          <div className="space-y-8 md:space-y-10">
            {t.experience.entries.map((entry) => (
              <div key={entry.title}>
                <h3 className="text-xl font-bold md:text-2xl">{entry.title}</h3>
                <p className="section-meta mt-1 text-sm tracking-widest text-white/50 uppercase">
                  {entry.period}
                </p>
                <TagPills tags={entry.tags} />
                <p className="mt-4 text-white/75 md:text-lg">{entry.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section index="03" title={t.projects.title} showcase>
          <div className="space-y-8 md:space-y-10">
            {t.projects.items.map((project) => (
              <div key={project.title}>
                <h3 className="text-xl font-bold md:text-2xl">{project.title}</h3>
                <TagPills tags={project.tags} />
                <p className="mt-4 text-white/75 md:text-lg">{project.text}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {project.links.map((link) => (
                    <ExternalLink
                      key={link.href}
                      href={link.href}
                      className="rounded-full border border-neon-cyan/50 px-4 py-1.5 text-sm font-bold text-neon-cyan transition hover:bg-neon-cyan/10 hover:shadow-[0_0_25px_-5px_#22d3ee]"
                    >
                      {link.label} ↗
                    </ExternalLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section index="04" title={t.contact.title} align="center">
          <p className="text-lg text-white/85 md:text-xl">{t.contact.text}</p>
          <p className="mt-6 animate-pulse text-sm font-bold tracking-[0.3em] text-neon-cyan/80 uppercase">
            {t.contact.hint}
          </p>
        </Section>
      </main>
    </>
  );
};
