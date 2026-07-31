import {
  Fragment,
  useMemo,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useReveal } from './reveal';
import type { AstreKey } from './scene/astres';

// How much delay each pixel of distance from the tap buys, in ms. At 0.55 a word a full
// phone-height away lights up ~450ms after the touch — fast enough to read as one wave
// crossing the screen rather than as words queueing up.
const MS_PER_PX = 0.55;
// Past this the tail would still be arriving after the reader got there.
const MAX_DELAY = 620;

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
  // splitWords walks the whole subtree and clones every element in it. Without this it ran
  // again on each re-render, for no gain: the copy never changes between them.
  const words = useMemo(() => splitWords(children), [children]);

  // Measured once, when the state flips: the camera keeps flying during the reveal, so a
  // distance recomputed per frame would have the wave starting from a point that moved.
  useEffect(() => {
    const root = ref.current;
    if (state !== 'lit' || !origin || !root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.ignite-word'));

    // Every rect first, every style write after, rather than alternating: interleaving
    // invalidates layout on each word and forces a reflow per word. Measured at 213 words it
    // is only 1.5ms against 0.9ms, so this is tidiness rather than the fix — the delay came
    // from the arithmetic below, not from the DOM.
    const distances = nodes.map((word) => {
      const box = word.getBoundingClientRect();
      return Math.hypot(
        origin.x - (box.left + box.width / 2),
        origin.y - (box.top + box.height / 2),
      );
    });

    // Rebased on the nearest word, and this is what made the reveal feel broken. The astre is
    // off to one side of the copy, so raw distances gave the *closest* word a delay of 500ms
    // in the About block and over 1300ms in Experience and Projects — past MAX_DELAY, meaning
    // every word waited the full cap and nothing at all happened for 620ms after the tap.
    // Subtracting the minimum makes the block answer immediately and keeps the wave, since
    // only the differences between words ever mattered.
    const nearest = Math.min(...distances);
    nodes.forEach((word, i) => {
      const delay = Math.min((distances[i] - nearest) * MS_PER_PX, MAX_DELAY);
      word.style.animationDelay = `${delay}ms`;
    });
  }, [state, origin]);

  return (
    <span ref={ref} className={`ignite is-${state}`}>
      {words}
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
