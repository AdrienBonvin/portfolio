import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { journeyProgress } from './scrollState';
import { TAP_EVENT, approaching, type AstreKey } from './scene/astres';

// The three big astres answer to a touch, and a phone has no hover to say so — which
// is why that whole layer of the scene went unnoticed on mobile. This names whichever
// one is currently coming up the corridor, and retires it once it has been touched.
//
// A DOM chip rather than a label planted in the scene: the astres pass late, well into
// the next section, so anything anchored to one of them spends half the flyby behind
// the body copy. Down here it is always legible, and it sits above the mini-map like
// the piece of chrome it is.
export const AstreHint = () => {
  const t = useT();
  const [astre, setAstre] = useState<AstreKey | null>(null);

  useEffect(() => {
    const sync = () => setAstre(approaching(journeyProgress()));
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

  // the label survives the astre leaving, so the chip fades out on its own words
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (astre) setLabel(`${t.scene.tap} ${t.scene[astre]}`);
  }, [astre, t]);

  // bottom-11 keeps it inside the mini-map's own fade, where the section copy has
  // already dissolved into the void — a chip any higher up ends up straddling the next
  // section's title as it comes on screen
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-11 z-40 flex justify-center px-6 md:hidden"
    >
      <span className={`astre-hint ${astre ? 'is-in' : ''}`}>{label}</span>
    </div>
  );
};
