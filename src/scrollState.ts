// Mutable singleton read by the 3D scene on every frame.
// Avoids re-rendering the whole React tree on each scroll event.
export const scrollState = { progress: 0 };

// Real top offsets of the DOM sections. On mobile some sections are taller than
// one viewport, so the camera can't assume "section = index × 100vh": progress is
// derived from these measured boundaries instead. Cached, refreshed on resize.
let tops: number[] = [];

export const sectionTops = () => {
  if (tops.length === 0) {
    tops = Array.from(document.querySelectorAll<HTMLElement>('main > section')).map(
      (section) => section.offsetTop,
    );
  }
  return tops;
};

if (typeof window !== 'undefined') {
  // Only invalidate on real layout changes (width). On mobile the collapsing URL
  // bar fires resize with height-only changes — ignoring those avoids the jump.
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    tops = [];
  });
}

// Journey progress in [0, 1]: reaching the top of section i = stop i of the camera.
export const journeyProgress = () => {
  const bounds = sectionTops();
  if (bounds.length < 2) return 0;
  const y = window.scrollY;
  let index = bounds.length - 1;
  while (index > 0 && y < bounds[index]) index--;
  if (index >= bounds.length - 1) return 1;
  const span = bounds[index + 1] - bounds[index];
  const fraction = span > 0 ? Math.min(1, (y - bounds[index]) / span) : 0;
  return Math.min(1, (index + fraction) / (bounds.length - 1));
};

// True on phones/tablets: no hover, interactions must work with taps.
export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
