// Geometry of the journey, shared by the 3D scene and by the DOM chrome that has to
// agree with it. The camera's depth is a pure function of scroll progress and the
// astres sit at fixed depths, so "which astre is going past right now" is knowable
// outside the canvas — which is what lets the tap affordance be a plain DOM element
// instead of a label planted in the scene, where it spent half the flyby behind the
// section copy.

export const SECTION_COUNT = 5;
export const SECTION_DEPTH = 14;

// The camera flies backwards along -Z as the user scrolls (CameraRig).
export const cameraZ = (progress: number) => 8 - progress * SECTION_DEPTH * (SECTION_COUNT - 1);

// How far ahead of an astre its flyby starts. One section is SECTION_DEPTH units, and
// each astre sits inside its own section's stretch of the corridor, so this window
// opens roughly when its section arrives and closes once the astre is behind you.
export const FLYBY_RANGE = 13;

// The window in which an astre answers the pointer, given how far ahead of the camera
// it still is. It has to close the moment the astre is behind you: its target sphere is
// double-sided, so that a tap still lands while you are flying through the thing, and a
// sphere left live behind the camera goes on taking every tap meant for the next astre
// down the corridor — which is exactly how the pulsar ended up unreachable, with the
// black hole two units behind the camera quietly answering for it.
export const inFlyby = (ahead: number) => ahead > -1.5 && ahead < FLYBY_RANGE;

export type AstreKey = 'planet' | 'blackHole' | 'pulsar';

// Depths are shared between desktop and portrait — the portrait staging only pulls the
// astres sideways, toward the middle of a frame a third as wide, so the pacing of the
// journey is identical on both.
export const ASTRE_DEPTH: Record<AstreKey, number> = {
  planet: -20,
  blackHole: -35,
  pulsar: -43,
};

// Where each astre sits off the corridor. Here rather than inline in the scene because
// the DOM affordance has to project the very same point to follow it (hintAnchor below),
// and two copies of these numbers would drift apart on the first tweak.
const OFFSET: Record<AstreKey, { portrait: [number, number]; desktop: [number, number] }> = {
  planet: { portrait: [1.8, 1.8], desktop: [5.5, 2] },
  blackHole: { portrait: [-1.7, 2.6], desktop: [-8, 4] },
  pulsar: { portrait: [1.6, 2.3], desktop: [12, 3.5] },
};

export const astrePosition = (key: AstreKey, portrait: boolean): [number, number, number] => {
  const [x, y] = portrait ? OFFSET[key].portrait : OFFSET[key].desktop;
  return [x, y, ASTRE_DEPTH[key]];
};

// Each astre's projected screen position, in CSS pixels, written every frame by the scene
// and read by the affordance chip so it can ride along. A plain mutable record rather than
// React state: this changes every frame, and re-rendering the chip 60 times a second to
// move it is exactly the cost the rest of this scene is built to avoid.
export const hintAnchor: Record<AstreKey, { x: number; y: number; behind: boolean }> = {
  planet: { x: 0, y: 0, behind: true },
  blackHole: { x: 0, y: 0, behind: true },
  pulsar: { x: 0, y: 0, behind: true },
};

const ORDER: AstreKey[] = ['planet', 'blackHole', 'pulsar'];

// Astres answer to a tap once and then they have made their point: the affordance is
// for someone who has not discovered it yet.
const tapped = new Set<AstreKey>();
export const TAP_EVENT = 'astre:tapped';

// Where the finger landed, in viewport pixels. The section copy lights up from this
// point (Ignite), so the light comes out of the spot that was actually touched rather
// than from a re-projection of the astre's centre — which would drift, since the camera
// keeps flying while the reveal plays.
export type TapDetail = { key: AstreKey; x: number; y: number };

export const markTapped = (key: AstreKey, origin: { x: number; y: number }) => {
  if (tapped.has(key)) return;
  tapped.add(key);
  window.dispatchEvent(new CustomEvent<TapDetail>(TAP_EVENT, { detail: { key, ...origin } }));
};

// Re-arms the affordance once the astre has gone by, so coming back to a section offers
// the gesture again rather than a chip that has retired for good.
export const unmarkTapped = (key: AstreKey) => tapped.delete(key);

// Whether this astre is currently the one going past — the window in which it answers a
// tap, and therefore the window in which the copy it carries stays lit.
export const isOpen = (key: AstreKey, progress: number) =>
  inFlyby(cameraZ(progress) - ASTRE_DEPTH[key]);

// The astre currently going past and still waiting to be touched. Two of them can be
// in the window at once — the corridor is 14 units per section and the window is 13 —
// so it is the nearest one that gets named, since that is the one filling the frame.
export const approaching = (progress: number): AstreKey | null => {
  const z = cameraZ(progress);
  // positive while the astre is still ahead of the camera. Same window the astre itself
  // uses, so the chip never invites a tap that would not land.
  const open = ORDER.filter((key) => !tapped.has(key) && inFlyby(z - ASTRE_DEPTH[key]));
  // An astre you have just flown past still answers a tap for a beat, but it must never
  // out-rank one that is genuinely coming up: ranking by absolute distance had the chip
  // still naming the planet, 1.4 units behind, while the black hole filled the frame 8
  // units ahead. Ahead first, nearest of those, and only then the one just behind.
  const rank = (key: AstreKey) => {
    const ahead = z - ASTRE_DEPTH[key];
    return ahead >= 0 ? ahead : Infinity;
  };
  return open.sort((a, b) => rank(a) - rank(b))[0] ?? null;
};
