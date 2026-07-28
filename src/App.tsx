import { useEffect, type ReactNode } from 'react';
import { PortfolioScene } from './scene/PortfolioScene';
import { CursorGlow } from './CursorGlow';
import { MiniMap } from './MiniMap';
import { AstreHint } from './AstreHint';
import { Ignite, Settle } from './Ignite';
import { LangToggle } from './LangToggle';
import { journeyProgress, scrollState } from './scrollState';
import { useT, LINKS } from './i18n';
import type { AstreKey } from './scene/astres';

type SectionProps = {
  index: string;
  title: string;
  align?: 'left' | 'right' | 'center';
  // The journey's destination. On mobile it gets a screen of its own after the approach,
  // with the copy centred in it — the page ends here, so this is the frame the reader
  // is left looking at, and it must not sit low like a section still being scrolled past.
  final?: boolean;
  // The astre this section's copy belongs to. Tagged on the title so the affordance chip
  // can measure how far that title has travelled up the frame before offering itself.
  astre?: AstreKey;
  // Shortens the approach. Only the first section wants this: the reader has just left the
  // hero and has no reason yet to trust that scrolling leads anywhere, so making them cross
  // a whole empty screen before the first title is the one place the pause costs more than
  // it buys. Every later approach has an astre flying by to fill it.
  approach?: 'full' | 'short';
  children: ReactNode;
};

const Section = ({
  index,
  title,
  align = 'left',
  final,
  astre,
  approach = 'full',
  children,
}: SectionProps) => {
  const placement =
    align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto' : 'mr-auto';

  return (
    // svh: sized to the small viewport so the collapsing mobile URL bar never shifts the layout
    <section
      className={`flex min-h-svh items-center px-6 md:min-h-screen md:px-12 md:py-24 ${
        // no bottom padding on the last one: it is what centres the closing screen
        final ? 'pt-24 pb-0' : 'py-24'
      }`}
    >
      {/* max-w-6xl keeps content near the center on ultrawide screens */}
      <div className="mx-auto w-full max-w-6xl">
        {/* pointer-events: none on mobile so taps reach the 3D objects behind the text
            — only the body's own links re-enable them (index.css) */}
        <div className={`pointer-events-none w-full max-w-2xl md:pointer-events-auto ${placement}`}>
          {/* mobile: a screen of empty scroll before the title. It is the approach to the
              section — and, since it sits where the previous section's astre finishes its
              flyby, it is what keeps the type out of the frame until that astre has gone
              past. Depths in scene/astres.ts are tuned against these offsets.

              Not on the last one: journeyProgress pins at 1 from the top of the final
              section, so every pixel after that point is scroll with the scene frozen on
              the galaxy. Giving the arrival an approach as well would mean a whole screen
              of that — the galaxy has to land as the page ends, not a screen earlier. */}
          {!final && (
            <div
              aria-hidden
              className={`md:hidden ${approach === 'short' ? 'h-[62svh]' : 'h-svh'}`}
            />
          )}
          <div
            className={final ? 'flex min-h-svh flex-col justify-center md:block md:min-h-0' : ''}
          >
            <div className="relative">
              <span
                aria-hidden
                className="ghost-number absolute -top-20 -left-2 text-[9rem] font-bold select-none md:-top-28 md:text-[13rem]"
              >
                {index}
              </span>
              <h2
                data-astre={astre}
                className="relative mb-4 bg-gradient-to-r from-neon-violet via-white to-neon-cyan bg-clip-text text-5xl font-bold text-transparent drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] md:text-7xl">
                {title}
              </h2>
              <div
                className={`mb-10 h-px w-44 bg-gradient-to-r from-neon-cyan to-transparent shadow-[0_0_12px_#22d3ee] ${align === 'center' ? 'mx-auto' : ''}`}
              />
            </div>
            <div className="holo-text">{children}</div>
          </div>
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
    // mobile: the two names stack. On one line they had to shrink to 2.5rem to fit a
    // narrow frame, which is a small headline for the first thing anyone sees — stacked
    // they get half again the size and read as a mark rather than as a caption.
    <h1 className="pointer-events-auto text-[3.5rem] leading-[0.92] font-bold tracking-[-0.03em] md:text-8xl md:leading-none md:tracking-normal md:whitespace-nowrap">
      <span className="block md:inline">
        {'Adrien'.split('').map((letter, i) => (
          <span key={i} className="hero-letter">
            {letter}
          </span>
        ))}
      </span>
      <span className="hidden md:inline"> </span>
      <span className="block md:inline">
        {lastName.split('').map((letter, i) => (
          <span
            key={i}
            className="hero-letter"
            style={{ color: lerpColor('#a855f7', '#f472b6', i / (lastName.length - 1)) }}
          >
            {letter}
          </span>
        ))}
      </span>
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
      <AstreHint />
      <LangToggle />

      {/* pointer-events-none lets hovers/clicks reach the 3D canvas; cards re-enable them */}
      <main className="pointer-events-none relative z-10">
        {/* Hero */}
        {/* relative only on mobile: it anchors the veil and the scroll cue, both of
            which are md:hidden / md:static — desktop stays exactly as it was */}
        <section className="relative flex min-h-svh flex-col items-center justify-center px-6 text-center md:static md:min-h-screen">
          {/* mobile: a well of shadow under the type. The astres are the scenery, not
              the headline, and on a phone frame the ringed planet sits right behind the
              name — the scene's fog pulls them back too (PortfolioScene), this holds
              the ground immediately around the words. */}
          <div aria-hidden className="hero-veil md:hidden" />
          <p className="mb-4 text-[0.6875rem] tracking-[0.35em] text-neon-cyan uppercase md:text-sm md:tracking-[0.4em]">
            {t.hero.kicker}
          </p>
          <HeroName />
          <p className="mt-5 max-w-md text-base text-white/70 md:mt-6 md:text-lg">
            {t.hero.tagline}
          </p>
          {/* mobile: parked at the bottom edge rather than a fixed gap under the tagline,
              so the hero reads as name-then-horizon instead of three blocks adrift */}
          <div className="absolute bottom-[14svh] animate-bounce text-xs tracking-widest text-white/50 md:static md:mt-16 md:text-base md:tracking-normal">
            {t.hero.scroll}
          </div>
        </section>

        <Section index="01" title={t.about.title} astre="planet" approach="short">
          <p className="text-lg leading-relaxed text-white/85 md:text-xl">
            <Ignite astre="planet">
              {t.about.before}
              <ExternalLink
                href={LINKS.youtube}
                className="text-neon-cyan underline decoration-neon-cyan/40 underline-offset-4 transition hover:decoration-neon-cyan"
              >
                {t.about.youtube}
              </ExternalLink>
              {t.about.after}
            </Ignite>
          </p>
        </Section>

        <Section index="02" title={t.experience.title} align="right" astre="blackHole">
          <div className="space-y-8 md:space-y-10">
            {t.experience.entries.map((entry) => (
              <div key={entry.title}>
                <h3 className="text-xl font-bold md:text-2xl">
                  <Ignite astre="blackHole">{entry.title}</Ignite>
                </h3>
                <p className="mt-1 text-sm tracking-widest text-white/50 uppercase">
                  <Ignite astre="blackHole">{entry.period}</Ignite>
                </p>
                <Settle astre="blackHole">
                  <TagPills tags={entry.tags} />
                </Settle>
                <p className="mt-4 text-white/75 md:text-lg">
                  <Ignite astre="blackHole">{entry.text}</Ignite>
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section index="03" title={t.projects.title} astre="pulsar">
          <div className="space-y-8 md:space-y-10">
            {t.projects.items.map((project) => (
              <div key={project.title}>
                <h3 className="text-xl font-bold md:text-2xl">
                  <Ignite astre="pulsar">{project.title}</Ignite>
                </h3>
                <Settle astre="pulsar">
                  <TagPills tags={project.tags} />
                </Settle>
                <p className="mt-4 text-white/75 md:text-lg">
                  <Ignite astre="pulsar">{project.text}</Ignite>
                </p>
                <Settle astre="pulsar">
                <div className="mt-4 flex flex-wrap gap-3">
                  {/* mobile: a 44px-tall target, so the pill is a thumb-sized thing
                      and not a 24px sliver floating over a 3D canvas */}
                  {project.links.map((link) => (
                    <ExternalLink
                      key={link.href}
                      href={link.href}
                      className="rounded-full border border-neon-cyan/50 px-5 py-2.5 text-sm font-bold text-neon-cyan transition hover:bg-neon-cyan/10 hover:shadow-[0_0_25px_-5px_#22d3ee] md:px-4 md:py-1.5"
                    >
                      {link.label} ↗
                    </ExternalLink>
                  ))}
                </div>
                </Settle>
              </div>
            ))}
          </div>
        </Section>

        <Section index="04" title={t.contact.title} align="center" final>
          <p className="text-lg text-white/85 md:text-xl">
            {t.contact.text}
          </p>
          {/* tighter tracking on mobile: at 0.3em this runs edge to edge on a phone
              and wraps mid-phrase */}
          <p className="mt-6 animate-pulse text-xs font-bold tracking-[0.18em] text-neon-cyan/80 uppercase md:text-sm md:tracking-[0.3em]">
            {t.contact.hint}
          </p>
        </Section>
      </main>
    </>
  );
};
