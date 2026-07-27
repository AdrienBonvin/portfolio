import {
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { PortfolioScene } from './scene/PortfolioScene';
import { CursorGlow } from './CursorGlow';
import { MiniMap } from './MiniMap';
import { AstreHint } from './AstreHint';
import { LangToggle } from './LangToggle';
import { journeyProgress, scrollState } from './scrollState';
import { useT, LINKS } from './i18n';

type SectionProps = {
  index: string;
  title: string;
  align?: 'left' | 'right' | 'center';
  // mobile: the title and its copy read as one block at the top of the section, and
  // the empty scroll that follows is where the section's astre gets the frame to
  // itself. The showcase is the silence after the text, not a screen of its own.
  showcase?: boolean;
  // The astre standing behind this section: its color tints the scrim's light leak,
  // and `leak` says which side of the frame that light comes from. Hard-coded rather
  // than projected from the scene each frame — the astres sit at fixed world
  // positions (PortfolioScene), so the side never changes.
  accent?: keyof typeof ACCENTS;
  leak?: keyof typeof LEAK_X;
  children: ReactNode;
};

// rgb triples, so the CSS can pick its own alpha per layer
const ACCENTS = {
  violet: '168 85 247',
  cyan: '34 211 238',
  pink: '244 114 182',
};

const LEAK_X = { left: '12%', center: '50%', right: '88%' };

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

// Wraps every word of a subtree in its own span, numbered in reading order, so the
// CSS can stagger them. Recursive: the body copy mixes bare strings with elements
// (links, headings, pills), and a splitter that only handled top-level strings would
// drop the words on either side of a link out of the sequence.
const splitWords = (node: ReactNode, counter: { n: number }): ReactNode => {
  if (typeof node === 'string') {
    // keeping the whitespace chunks as plain text nodes is what lets the line still
    // break normally between two inline-block words
    return node.split(/(\s+)/).map((chunk, i) =>
      chunk.trim() === '' ? (
        chunk
      ) : (
        <span key={i} className="reveal-word" style={{ '--i': counter.n++ } as CSSProperties}>
          {chunk}
        </span>
      ),
    );
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => <Fragment key={i}>{splitWords(child, counter)}</Fragment>);
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (element.props.children == null) return node;
    return cloneElement(element, undefined, splitWords(element.props.children, counter));
  }
  return node;
};

// One reveal unit: its words condense out of the void when it reaches the viewport.
// Use one per block that should animate on its own — each experience entry gets its
// own, so the stagger restarts with it instead of running off the end of the section.
const Reveal = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  const { ref, revealed } = useRevealed();
  return (
    <div ref={ref} className={`reveal ${revealed ? 'is-in' : ''} ${className}`}>
      {splitWords(children, { n: 0 })}
    </div>
  );
};

const Section = ({
  index,
  title,
  align = 'left',
  showcase,
  accent = 'violet',
  leak = 'center',
  children,
}: SectionProps) => {
  const placement =
    align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto' : 'mr-auto';

  return (
    // svh: sized to the small viewport so the collapsing mobile URL bar never shifts the
    // layout. Mobile stacks from a fixed offset off the top rather than centering: every
    // section then opens at the same height, which reads as a rhythm instead of the text
    // floating at a different place each time.
    <section
      className="flex min-h-svh flex-col px-5 pt-[13svh] pb-[6svh] md:min-h-screen md:flex-row md:items-center md:px-12 md:py-24"
      style={{ '--accent': ACCENTS[accent], '--leak-x': LEAK_X[leak] } as CSSProperties}
    >
      {/* max-w-6xl keeps content near the center on ultrawide screens */}
      <div className="mx-auto w-full max-w-6xl">
        {/* pointer-events: none on mobile so taps reach the 3D objects behind the text
            — only the body panel's links re-enable them */}
        <div className={`pointer-events-none w-full max-w-2xl md:pointer-events-auto ${placement}`}>
          <div className="relative">
            <span
              aria-hidden
              className="ghost-number absolute -top-28 -left-2 hidden text-[13rem] font-bold select-none md:block"
            >
              {index}
            </span>
            {/* mobile: the giant ghost number needed a screen of its own to breathe.
                A numbered eyebrow in the astre's own colour says the same in one line,
                and gives each section a colour identity on the way past. */}
            <span
              aria-hidden
              className={`section-index text-[0.6875rem] font-bold tracking-[0.45em] md:hidden ${
                align === 'center' ? 'justify-center' : ''
              }`}
            >
              {index}
            </span>
            <h2 className="section-title relative mb-5 text-[2.6rem] leading-[1.05] font-bold tracking-[-0.02em] text-white md:mb-4 md:bg-gradient-to-r md:from-neon-violet md:via-white md:to-neon-cyan md:bg-clip-text md:text-7xl md:leading-none md:tracking-normal md:text-transparent md:drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
              {title}
            </h2>
            {/* desktop-only: on mobile the eyebrow already carries the accent rule, and
                two of them stacked was half the empty space between title and copy */}
            <div
              className={`mb-10 hidden h-px w-44 bg-gradient-to-r from-neon-cyan to-transparent shadow-[0_0_12px_#22d3ee] md:block ${align === 'center' ? 'mx-auto' : ''}`}
            />
          </div>
          {/* mobile: the body stays transparent to taps so the astres behind it keep
              their whole surface — only links opt back in (index.css) */}
          <div className={`holo-text md:pointer-events-auto ${showcase ? 'section-panel' : ''}`}>
            {children}
          </div>
          {/* mobile: the showcase. Empty scroll, no type in the way, the astre coming up
              on the frame — this is where the flyby happens, and it is also what keeps
              the next section a journey away rather than the next screenful. */}
          {showcase && <div aria-hidden className="h-[78svh] md:hidden" />}
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

        {/* accent/leak follow the astre each section is staged against: the ringed
            planet sits right of the mobile track, the black hole left, the pulsar
            right again, and the galaxy dead ahead */}
        <Section index="01" title={t.about.title} showcase accent="violet" leak="right">
          <Reveal>
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
          </Reveal>
        </Section>

        <Section
          index="02"
          title={t.experience.title}
          align="right"
          showcase
          accent="pink"
          leak="left"
        >
          <div className="space-y-8 md:space-y-10">
            {t.experience.entries.map((entry) => (
              // one Reveal per entry: each one condenses as it arrives, rather than
              // the whole résumé firing off the first entry's intersection
              <Reveal key={entry.title}>
                <h3 className="text-xl font-bold md:text-2xl">{entry.title}</h3>
                <p className="mt-1 text-sm tracking-widest text-white/50 uppercase">{entry.period}</p>
                <TagPills tags={entry.tags} />
                <p className="mt-4 text-white/75 md:text-lg">{entry.text}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section index="03" title={t.projects.title} showcase accent="cyan" leak="right">
          <div className="space-y-8 md:space-y-10">
            {t.projects.items.map((project) => (
              <Reveal key={project.title}>
                <h3 className="text-xl font-bold md:text-2xl">{project.title}</h3>
                <TagPills tags={project.tags} />
                <p className="mt-4 text-white/75 md:text-lg">{project.text}</p>
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
              </Reveal>
            ))}
          </div>
        </Section>

        <Section index="04" title={t.contact.title} align="center" accent="violet">
          <Reveal>
            <p className="text-lg text-white/85 md:text-xl">{t.contact.text}</p>
            {/* tighter tracking on mobile: at 0.3em this runs edge to edge on a phone
                and wraps mid-phrase */}
            <p className="mt-6 animate-pulse text-xs font-bold tracking-[0.18em] text-neon-cyan/80 uppercase md:text-sm md:tracking-[0.3em]">
              {t.contact.hint}
            </p>
          </Reveal>
        </Section>
      </main>
    </>
  );
};
