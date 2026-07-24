import { useEffect, type ReactNode } from 'react';
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
  // mobile: the title becomes a full-screen opener scene starring the section's
  // celestial object (staged by the 3D scene), with a small tap invitation
  mobileHint?: string;
  children: ReactNode;
};

const Section = ({ index, title, align = 'left', mobileHint, children }: SectionProps) => {
  const placement =
    align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto' : 'mr-auto';

  return (
    <section className="flex min-h-screen items-center px-6 py-24 md:px-12">
      {/* max-w-6xl keeps content near the center on ultrawide screens */}
      <div className="mx-auto w-full max-w-6xl">
        {/* pointer-events: none on mobile so taps reach the 3D objects behind the
            full-screen title block — only the actual content re-enables them */}
        <div className={`pointer-events-none w-full max-w-2xl md:pointer-events-auto ${placement}`}>
          <div
            className={
              mobileHint ? 'flex h-svh flex-col justify-start pt-28 md:block md:h-auto md:pt-0' : ''
            }
          >
            <div className="relative">
              <span
                aria-hidden
                className="ghost-number absolute -top-20 -left-2 text-[9rem] font-bold select-none md:-top-28 md:text-[13rem]"
              >
                {index}
              </span>
              <h2 className="relative mb-4 bg-gradient-to-r from-neon-violet via-white to-neon-cyan bg-clip-text text-5xl font-bold text-transparent drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] md:text-7xl">
                {title}
              </h2>
              <div
                className={`mb-10 h-px w-44 bg-gradient-to-r from-neon-cyan to-transparent shadow-[0_0_12px_#22d3ee] ${align === 'center' ? 'mx-auto' : ''}`}
              />
              {mobileHint && (
                <p className="animate-pulse text-xs font-bold tracking-[0.3em] text-neon-cyan/70 uppercase md:hidden">
                  {mobileHint}
                </p>
              )}
            </div>
          </div>
          <div className="holo-text pointer-events-auto">{children}</div>
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
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
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
        <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="mb-4 text-sm tracking-[0.4em] text-neon-cyan uppercase">{t.hero.kicker}</p>
          <HeroName />
          <p className="mt-6 max-w-md text-lg text-white/70">{t.hero.tagline}</p>
          <div className="mt-16 animate-bounce text-white/50">{t.hero.scroll}</div>
        </section>

        <Section index="01" title={t.about.title} mobileHint={t.spacers.planet}>
          <p className="text-xl leading-relaxed text-white/85">
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

        <Section
          index="02"
          title={t.experience.title}
          align="right"
          mobileHint={t.spacers.blackHole}
        >
          <div className="space-y-10">
            {t.experience.entries.map((entry) => (
              <div key={entry.title}>
                <h3 className="text-2xl font-bold">{entry.title}</h3>
                <p className="mt-1 text-sm tracking-widest text-white/50 uppercase">{entry.period}</p>
                <TagPills tags={entry.tags} />
                <p className="mt-4 text-lg text-white/75">{entry.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section index="03" title={t.projects.title} mobileHint={t.spacers.supernova}>
          <div className="space-y-10">
            {t.projects.items.map((project) => (
              <div key={project.title}>
                <h3 className="text-2xl font-bold">{project.title}</h3>
                <TagPills tags={project.tags} />
                <p className="mt-4 text-lg text-white/75">{project.text}</p>
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
          <p className="text-xl text-white/85">{t.contact.text}</p>
          <p className="mt-6 animate-pulse text-sm font-bold tracking-[0.3em] text-neon-cyan/80 uppercase">
            {t.contact.hint}
          </p>
        </Section>
      </main>
    </>
  );
};
