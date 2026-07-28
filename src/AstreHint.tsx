import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { journeyProgress } from './scrollState';
import { TAP_EVENT, approaching, hintAnchor, type AstreKey } from './scene/astres';

// How far under the astre the chip rides, in pixels. Below rather than centred, so it
// never covers the thing it is pointing at.
const DROP = 84;
// Kept this far from every edge. Anchoring to a world position means the astre can be
// half out of frame — which is exactly how the previous take on this ended up showing
// "✦ TAP THE" with the rest of the sentence off-screen.
const MARGIN = 16;
// The chip waits for its section's title to have climbed to the middle of the frame before
// offering itself. Two reasons: the astre is only worth touching once it is properly on
// screen rather than a speck in the fog, and the invitation should not be the first thing
// that arrives — the title names the section, then the scene offers the way in.
const TITLE_GATE = 0.5;

// Whether the title of the section this astre carries has travelled far enough up.
const titleIsIn = (key: AstreKey) => {
  const title = document.querySelector<HTMLElement>(`h2[data-astre="${key}"]`);
  if (!title) return false;
  return title.getBoundingClientRect().top <= window.innerHeight * TITLE_GATE;
};

// The three big astres answer to a touch, and a phone has no hover to say so — which is
// why that whole layer of the scene went unnoticed on mobile.
//
// The chip rides along with whichever astre is coming up the corridor: the scene projects
// each astre to screen pixels every frame (TrackHints) and this reads that from its own
// animation loop, so following the astre costs no React renders. It stays a DOM element
// outside the canvas rather than an <Html> planted in the scene, for two reasons — it
// cannot be clipped by the frame, and it keeps full CSS control of the tilt that gives it
// its relief.
export const AstreHint = () => {
  const t = useT();
  const [astre, setAstre] = useState<AstreKey | null>(null);
  const chip = useRef<HTMLDivElement>(null);
  // read inside the animation loop, which is bound once
  const current = useRef<AstreKey | null>(null);

  useEffect(() => {
    const sync = () => {
      const open = approaching(journeyProgress());
      const next = open && titleIsIn(open) ? open : null;
      current.current = next;
      setAstre(next);
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.addEventListener(TAP_EVENT, sync);
    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener(TAP_EVENT, sync);
    };
  }, []);

  // Follows the astre. Writes a transform straight to the node every frame instead of
  // going through state: the anchor moves with the camera, so this runs at 60fps.
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      frame = requestAnimationFrame(follow);
      const node = chip.current;
      const key = current.current;
      if (!node || !key) return;
      const anchor = hintAnchor[key];
      const box = node.getBoundingClientRect();
      const x = Math.min(
        Math.max(anchor.x, MARGIN + box.width / 2),
        window.innerWidth - MARGIN - box.width / 2,
      );
      const y = Math.min(
        Math.max(anchor.y + DROP, MARGIN + box.height / 2),
        window.innerHeight - MARGIN - box.height / 2,
      );
      node.style.transform = `translate3d(${x - box.width / 2}px, ${y - box.height / 2}px, 0)`;
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, []);

  // the label survives the astre leaving, so the chip fades out on its own words
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (astre) setLabel(`${t.scene.tap} ${t.scene[astre]}`);
  }, [astre, t]);

  return (
    <div
      ref={chip}
      aria-hidden
      // z-5 puts it between the canvas (z-0) and the page (main is z-10): it belongs to
      // the scene, so a section title coming on screen passes in front of it rather than
      // being crossed by a chip riding over the type.
      className="pointer-events-none fixed top-0 left-0 z-[5] md:hidden"
    >
      <span className={`astre-hint ${astre ? 'is-in' : ''}`}>{label}</span>
    </div>
  );
};
