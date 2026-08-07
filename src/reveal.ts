import { useEffect, useState } from 'react';
import { journeyProgress } from './scrollState';
import { TAP_EVENT, isOpen, unmarkTapped, type AstreKey, type TapDetail } from './scene/astres';

// Which sections have had their copy lit, and from where. Its own module rather than living
// next to the components that read it: both Ignite and AstreHint depend on this, and keeping
// it in a component file broke fast refresh for the two of them.

export type RevealState = 'dark' | 'lit';

const ALL: AstreKey[] = ['planet', 'blackHole', 'pulsar'];

// One state per astre, not per block: a section's prose and its chrome — tag pills, link
// buttons — have to agree, or the pills sit there lit over copy that has not arrived yet.
// That was the flaw in the previous take on this: a row of floating pills above no title.
const states = new Map<AstreKey, RevealState>();
const origins = new Map<AstreKey, { x: number; y: number }>();

export const REVEAL_EVENT = 'astre:revealed';

const set = (key: AstreKey, next: RevealState, origin?: { x: number; y: number }) => {
  if (states.get(key) === next) return;
  states.set(key, next);
  if (origin) origins.set(key, origin);
  window.dispatchEvent(new CustomEvent(REVEAL_EVENT));
};

// True while any section's copy is lit. The affordance chip consults this so an invitation
// and a paragraph are never on the page together: the flyby windows are 13 units wide for
// sections spaced 14 apart, so two astres are regularly open at once — touching the planet
// lights the About copy and leaves `approaching` free to name the black hole, which is how
// the chip ended up sitting next to a paragraph it had nothing to do with.
export const anyLit = () => ALL.some((key) => states.get(key) === 'lit');

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

// The key is optional because not every block belongs to an astre — the closing section has
// none, and nothing gates its copy. Absent a key the answer is 'lit': there is no astre that
// could light this, so it is already showing.
export const useReveal = (astre?: AstreKey) => {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!astre) return;
    // Only re-render when *this* astre changes. Every reveal used to wake all seventeen
    // subscribers, and each Ignite re-splits its copy into word spans when it renders, so
    // one tap rebuilt every paragraph on the page instead of the three it lit.
    let last = states.get(astre) ?? 'dark';
    const sync = () => {
      const now = states.get(astre) ?? 'dark';
      if (now === last) return;
      last = now;
      bump((n) => n + 1);
    };
    window.addEventListener(REVEAL_EVENT, sync);
    return () => window.removeEventListener(REVEAL_EVENT, sync);
  }, [astre]);
  if (!astre) return { state: 'lit' as RevealState, origin: undefined };
  return { state: states.get(astre) ?? 'dark', origin: origins.get(astre) };
};
