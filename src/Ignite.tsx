import {
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { journeyProgress } from './scrollState';
import { TAP_EVENT, isOpen, unmarkTapped, type AstreKey, type TapDetail } from './scene/astres';

// How much delay each pixel of distance from the tap buys, in ms. At 0.55 a word a full
// phone-height away lights up ~450ms after the touch — fast enough to read as one wave
// crossing the screen rather than as words queueing up.
const MS_PER_PX = 0.55;
// Past this the tail would still be arriving after the reader got there.
const MAX_DELAY = 620;

export type RevealState = 'dark' | 'lit';

const ALL: AstreKey[] = ['planet', 'blackHole', 'pulsar'];

// One state per astre, not per block: a section's prose and its chrome — tag pills, link
// buttons — have to agree, or the pills sit there lit over copy that has not arrived yet.
// That was the flaw in the previous take on this: a row of floating pills above no title.
const states = new Map<AstreKey, RevealState>();
const origins = new Map<AstreKey, { x: number; y: number }>();
const REVEAL_EVENT = 'astre:revealed';

const set = (key: AstreKey, next: RevealState, origin?: { x: number; y: number }) => {
  if (states.get(key) === next) return;
  states.set(key, next);
  if (origin) origins.set(key, origin);
  window.dispatchEvent(new CustomEvent(REVEAL_EVENT));
};

if (typeof window !== 'undefined') {
  window.addEventListener(TAP_EVENT, (event) => {
    const { key, x, y } = (event as CustomEvent<TapDetail>).detail ?? {};
    if (key && (states.get(key) ?? 'dark') === 'dark') set(key, 'lit', { x, y });
  });

  // The reveal lasts exactly as long as the astre that granted it. Once it has gone past,
  // the copy goes dark and the chip is re-armed, so coming back to the section is the same
  // invitation as the first time rather than a page that has already spent its trick.
  window.addEventListener(
    'scroll',
    () => {
      const progress = journeyProgress();
      ALL.forEach((key) => {
        if (states.get(key) === 'lit' && !isOpen(key, progress)) {
          unmarkTapped(key);
          set(key, 'dark');
        }
      });
    },
    { passive: true },
  );
}

export const useReveal = (astre: AstreKey) => {
  const [, bump] = useState(0);
  useEffect(() => {
    const sync = () => bump((n) => n + 1);
    window.addEventListener(REVEAL_EVENT, sync);
    return () => window.removeEventListener(REVEAL_EVENT, sync);
  }, []);
  return { state: states.get(astre) ?? 'dark', origin: origins.get(astre) };
};

// Splits every text node into per-word spans so each can be delayed on its own.
// Recursive: the copy mixes bare strings with elements — the About paragraph wraps a link
// mid-sentence — and a splitter that only handled top-level strings would drop the words
// on either side of it out of the wave.
const splitWords = (node: ReactNode): ReactNode => {
  if (typeof node === 'string') {
    // the whitespace chunks stay plain text nodes: that is what lets a line still break
    // normally between two inline-block words
    return node
      .split(/(\s+)/)
      .map((chunk, i) =>
        chunk.trim() === '' ? (
          chunk
        ) : (
          <span key={i} className="ignite-word">
            {chunk}
          </span>
        ),
      );
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => <Fragment key={i}>{splitWords(child)}</Fragment>);
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (element.props.children == null) return node;
    return cloneElement(element, undefined, splitWords(element.props.children));
  }
  return node;
};

/**
 * Prose the scene lights up.
 *
 * Tapping the astre this block belongs to fires the astre's own flare (PortfolioScene)
 * and, from the same point at the same instant, a wave across this text: every word is
 * delayed by its distance to the touch, not by its position in the sentence, so the light
 * travels outward and the words ignite as it reaches them. Each word peaks with a glow
 * that falls back to nothing, on the same shape as the flare it came from — the copy
 * reads as lit by the astre rather than faded in by a timer.
 *
 * The words stay in the DOM throughout, only transparent, so none of this costs anything
 * in indexing or for a screen reader.
 */
export const Ignite = ({ astre, children }: { astre: AstreKey; children: ReactNode }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const { state, origin } = useReveal(astre);

  // Measured once, when the state flips: the camera keeps flying during the reveal, so a
  // distance recomputed per frame would have the wave starting from a point that moved.
  useEffect(() => {
    const root = ref.current;
    if (state !== 'lit' || !origin || !root) return;
    root.querySelectorAll<HTMLElement>('.ignite-word').forEach((word) => {
      const box = word.getBoundingClientRect();
      const distance = Math.hypot(
        origin.x - (box.left + box.width / 2),
        origin.y - (box.top + box.height / 2),
      );
      word.style.animationDelay = `${Math.min(distance * MS_PER_PX, MAX_DELAY)}ms`;
    });
  }, [state, origin]);

  return (
    <span ref={ref} className={`ignite is-${state}`}>
      {splitWords(children)}
    </span>
  );
};

/**
 * The chrome that belongs to a section's copy — tag pills, link buttons. Their borders and
 * backgrounds are painted by the element, not by the words inside, so they cannot ride the
 * wave: a transparent word inside a lit pill still leaves the pill outline on screen. They
 * wait out the wave instead and settle in behind it.
 */
export const Settle = ({ astre, children }: { astre: AstreKey; children: ReactNode }) => {
  const { state } = useReveal(astre);
  return <div className={`settle is-${state}`}>{children}</div>;
};
