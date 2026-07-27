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

const ORDER: AstreKey[] = ['planet', 'blackHole', 'pulsar'];

// Astres answer to a tap once and then they have made their point: the affordance is
// for someone who has not discovered it yet.
const tapped = new Set<AstreKey>();
export const TAP_EVENT = 'astre:tapped';

export const markTapped = (key: AstreKey) => {
  if (tapped.has(key)) return;
  tapped.add(key);
  window.dispatchEvent(new Event(TAP_EVENT));
};

// The astre currently going past and still waiting to be touched. Two of them can be
// in the window at once — the corridor is 14 units per section and the window is 13 —
// so it is the nearest one that gets named, since that is the one filling the frame.
export const approaching = (progress: number): AstreKey | null => {
  const z = cameraZ(progress);
  // positive while the astre is still ahead of the camera. Same window the astre itself
  // uses, so the chip never invites a tap that would not land.
  const open = ORDER.filter((key) => !tapped.has(key) && inFlyby(z - ASTRE_DEPTH[key]));
  const distance = (key: AstreKey) => Math.abs(z - ASTRE_DEPTH[key]);
  return open.sort((a, b) => distance(a) - distance(b))[0] ?? null;
};
