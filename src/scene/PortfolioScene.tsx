import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Grid, Html, Stars, Trail, useCursor } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { isTouchDevice, scrollState } from '../scrollState';
import { useIsMobile } from '../useIsMobile';
import { LINKS } from '../i18n';
import {
  astreHalo,
  astrePosition,
  astreScale,
  cameraZ,
  hintAnchor,
  inFlyby,
  markTapped,
  type AstreKey,
} from './astres';

// Aspect ratio of the window, kept up to date on resize. Drives the responsive
// layout of the scene: on narrow screens the celestial objects slide toward the
// center instead of living off-screen.
const useAspect = () => {
  const [aspect, setAspect] = useState(
    () => window.innerWidth / Math.max(1, window.innerHeight),
  );
  useEffect(() => {
    // Ignore height-only resizes (mobile URL bar collapsing) to avoid a scene jump.
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      setAspect(window.innerWidth / Math.max(1, window.innerHeight));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return aspect;
};

// Scene fog, also handed to every raw shader here by hand. three only injects its fog
// chunks into built-in materials, so a ShaderMaterial is otherwise the one thing that
// never fades with distance — which is why the accretion disc was still at full
// brightness behind the hero title from 43 units away, and why, once the grain bands
// were fixed, the rim glows went on hanging there with every grain already gone.
const FOG_NEAR = 8;
const FOG_FAR = 42;

// At the hero the corridor is closed off short of the first astre, so the planet is still
// out there in the dark rather than hanging behind the title. Set just under its 28-unit
// distance rather than well under it: that hides the planet, which is the only thing that
// ever fought the type, while the grid, the asteroids, the near starfield and the whole
// decorative cluster — all inside 20 units — stay in frame. It opens back up to FOG_FAR
// over the first third of the journey, so each astre still materialises out of the void as
// you scroll toward it.
//
// Both viewports. Desktop used to keep its astres in full view from the first frame on the
// grounds that a wide frame leaves the type room, but it does not: the planet sits at x 5.5
// and its ring reached across "Adrien" from 28 units away.
const HERO_FOG_FAR = 26;

// One shared vector, so the drive below reaches every grain shader at once — three only
// injects its fog chunks into built-in materials, and a raw ShaderMaterial is otherwise the
// one thing here that never fades with distance. Which is the whole reason this has to be
// shared rather than left to scene.fog: the planet's rings and bands are raw shaders, so
// closing the scene fog alone would have hidden its core and left its ring hanging there.
const HERO_FOG = new THREE.Vector2(FOG_NEAR, HERO_FOG_FAR);

const fogRange = () => HERO_FOG;

const FogDrive = () => {
  const scene = useThree((state) => state.scene);
  useFrame((_, delta) => {
    const open = THREE.MathUtils.smoothstep(scrollState.progress, 0, 0.3);
    const far = THREE.MathUtils.lerp(HERO_FOG_FAR, FOG_FAR, open);
    HERO_FOG.y = THREE.MathUtils.damp(HERO_FOG.y, far, 4, delta);
    if (scene.fog instanceof THREE.Fog) scene.fog.far = HERO_FOG.y;
  });
  return null;
};

const NEON = {
  violet: '#a855f7',
  cyan: '#22d3ee',
  pink: '#f472b6',
};

// World position of the big object just tapped on a touch device. The camera tips toward
// it for a beat (answerTap), which is what makes the tap move the world. Desktop hover
// used to lean the camera the same way; it fought the scroll-driven framing every time
// the pointer crossed an astre, so hover now only animates the astre itself.
const focusState = { target: null as THREE.Vector3 | null };

// Warp effect: driven by scroll velocity. speed ramps smoothly between 0 and 1.
const warpState = { speed: 0 };

// The camera flies backwards along -Z as the user scrolls.
const CameraRig = () => {
  const look = useRef(new THREE.Vector3(0, 1, -4));
  const lean = useRef(new THREE.Vector3());
  const prevScrollY = useRef(0);
  // On touch the warp is the main jank source on fast flicks: trigger it later
  // and ramp it slower so it never spikes right when frames are already tight.
  const touch = isTouchDevice();
  const warpFloor = touch ? 2600 : 1200;
  const warpSpan = touch ? 4200 : 3300;

  useFrame(({ camera }, delta) => {
    const targetZ = cameraZ(scrollState.progress);
    let px = 0;
    let py = 1.4;
    let pz = targetZ;
    let lx = 0;
    let ly = 1;
    let lz = targetZ - 12;

    const focus = focusState.target;
    if (focus) {
      // step 0.9 units toward the object and tilt the gaze 25% toward it
      lean.current.set(focus.x - px, focus.y - py, focus.z - pz).normalize().multiplyScalar(0.9);
      px += lean.current.x;
      py += lean.current.y;
      pz += lean.current.z;
      lx += (focus.x - lx) * 0.25;
      ly += (focus.y - ly) * 0.25;
      lz += (focus.z - lz) * 0.25;
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, px, 2.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, py, 2.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pz, 3, delta);
    look.current.x = THREE.MathUtils.damp(look.current.x, lx, 2.5, delta);
    look.current.y = THREE.MathUtils.damp(look.current.y, ly, 2.5, delta);
    look.current.z = THREE.MathUtils.damp(look.current.z, lz, 3, delta);
    camera.lookAt(look.current);

    // warp effect when scrolling fast: star streaks + wider field of view
    const scrollY = window.scrollY;
    const velocity = Math.abs(scrollY - prevScrollY.current) / Math.max(delta, 0.001);
    prevScrollY.current = scrollY;
    const warpTarget = THREE.MathUtils.clamp((velocity - warpFloor) / warpSpan, 0, 1);
    warpState.speed = THREE.MathUtils.damp(warpState.speed, warpTarget, 4, delta);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, 60 + warpState.speed * 18, 3, delta);
      camera.updateProjectionMatrix();
    }
  });
  return null;
};

// Star streaks rushing past during warp — one LineSegments draw call, hidden when idle.
const WARP_LINES = 220;

const WarpLines = () => {
  const lines = useRef<THREE.LineSegments>(null);
  const material = useRef<THREE.LineBasicMaterial>(null);

  const seeds = useMemo(
    () =>
      Array.from({ length: WARP_LINES }, (_, i) => ({
        x: (rand01(i, 40) - 0.5) * 26,
        y: (rand01(i, 41) - 0.5) * 15 + 1.5,
        z: rand01(i, 42) * 75,
      })),
    [],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WARP_LINES * 2 * 3), 3));
    return geo;
  }, []);

  useFrame(({ camera }, delta) => {
    if (!lines.current || !material.current) return;
    const speed = warpState.speed;
    lines.current.visible = speed > 0.02;
    material.current.opacity = speed * 0.85;
    if (speed <= 0.02) return;

    const length = 0.5 + speed * 5;
    const positions = lines.current.geometry.getAttribute('position');
    seeds.forEach((seed, i) => {
      seed.z += delta * (30 + speed * 90);
      const z = camera.position.z - 70 + (seed.z % 75);
      positions.setXYZ(i * 2, seed.x, seed.y, z);
      positions.setXYZ(i * 2 + 1, seed.x, seed.y, z - length);
    });
    positions.needsUpdate = true;
  });

  return (
    <lineSegments ref={lines} visible={false} geometry={geometry}>
      <lineBasicMaterial ref={material} color="#9be7ff" transparent opacity={0} />
    </lineSegments>
  );
};

// The scenery that drifts past between the big astres. These used to be Platonic solids and
// a torus knot — handsome, but they belonged to a maths poster, not to a sky. Each one is
// now a small body you could name: a ringed world, an armillary sphere, a moon on its orbit,
// a comet. Same neon-wireframe idiom, and still the small cousins of the scene's own
// objects rather than repeats of them.
type ShapeKind = 'ringedWorld' | 'armillary' | 'orbit' | 'comet';

type NeonShapeProps = {
  position: [number, number, number];
  color: string;
  kind: ShapeKind;
  scale?: number;
  spin?: number;
};

const COLOR_CYCLE = [NEON.violet, NEON.cyan, NEON.pink];

// Each body is several meshes now, so the parts share one material: it is the thing the
// hover animates, and one instance per mesh would mean animating three of them in step and
// paying for three material set-ups per shape.
const ShapeParts = ({ kind, material }: { kind: ShapeKind; material: THREE.Material }) => {
  switch (kind) {
    // a world with its ring, seen at a tilt — the scene's own planet, pocket-sized
    case 'ringedWorld':
      return (
        <>
          <mesh material={material}>
            <sphereGeometry args={[0.6, 18, 12]} />
          </mesh>
          <mesh material={material} rotation={[1.28, 0.2, 0]}>
            <torusGeometry args={[1.12, 0.05, 6, 56]} />
          </mesh>
        </>
      );
    // three hoops on crossed axes: an armillary sphere, the instrument astronomers used to
    // model the sky before they could photograph it
    case 'armillary':
      return (
        <>
          <mesh material={material}>
            <sphereGeometry args={[0.2, 12, 8]} />
          </mesh>
          <mesh material={material}>
            <torusGeometry args={[1, 0.035, 6, 56]} />
          </mesh>
          <mesh material={material} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1, 0.035, 6, 56]} />
          </mesh>
          <mesh material={material} rotation={[0, 0, Math.PI / 2.4]}>
            <torusGeometry args={[0.82, 0.035, 6, 56]} />
          </mesh>
        </>
      );
    // a moon caught on its path, the bead sitting on the ring rather than inside it
    case 'orbit':
      return (
        <>
          <mesh material={material}>
            <sphereGeometry args={[0.34, 16, 12]} />
          </mesh>
          <mesh material={material} rotation={[1.1, 0.4, 0]}>
            <torusGeometry args={[1.05, 0.03, 6, 64]} />
          </mesh>
          <mesh material={material} position={[0.92, 0.42, 0.3]}>
            <sphereGeometry args={[0.14, 10, 8]} />
          </mesh>
        </>
      );
    // head and tail: the tail is a cone narrowing back to the head, so it reads as volume
    // streaming away rather than as a triangle stuck on the side
    case 'comet':
      return (
        <>
          <mesh material={material}>
            <sphereGeometry args={[0.34, 16, 12]} />
          </mesh>
          <mesh material={material} position={[-0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.3, 1.7, 12, 3, true]} />
          </mesh>
        </>
      );
  }
};

const NeonShape = ({ position, color, kind, scale = 1, spin = 0.3 }: NeonShapeProps) => {
  const group = useRef<THREE.Group>(null);
  // extra rotation speed added on click, decays back to 0 each frame
  const spinBoost = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [currentColor, setCurrentColor] = useState(color);
  useCursor(hovered);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0a0a18',
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.6,
        wireframe: true,
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.emissive.set(currentColor);
  }, [currentColor, material]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    node.rotation.x += delta * (spin + spinBoost.current);
    node.rotation.y += delta * (spin * 0.7 + spinBoost.current);
    spinBoost.current = THREE.MathUtils.damp(spinBoost.current, 0, 1.2, delta);

    const targetScale = hovered ? scale * 1.3 : scale;
    node.scale.setScalar(THREE.MathUtils.damp(node.scale.x, targetScale, 6, delta));
    material.emissiveIntensity = THREE.MathUtils.damp(
      material.emissiveIntensity,
      hovered ? 3 : 1.6,
      6,
      delta,
    );
  });

  const cycleColor = () => {
    spinBoost.current += 7;
    const next = (COLOR_CYCLE.indexOf(currentColor) + 1) % COLOR_CYCLE.length;
    setCurrentColor(COLOR_CYCLE[next]);
  };

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={1.2}>
      <group
        ref={group}
        position={position}
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={cycleColor}
      >
        <ShapeParts kind={kind} material={material} />
      </group>
    </Float>
  );
};

// Deterministic pseudo-random in [0,1) so the scene is identical on every visit.
const rand01 = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Small rocks scattered along the whole camera path — one InstancedMesh, one draw call.
const Asteroids = ({ xFactor, count }: { xFactor: number; count: number }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const side = rand01(i, 1) > 0.5 ? 1 : -1;
      dummy.position.set(
        side * (2.5 + rand01(i, 2) * 12) * xFactor,
        rand01(i, 3) * 9 - 1,
        4 - rand01(i, 4) * 72,
      );
      dummy.rotation.set(rand01(i, 5) * Math.PI, rand01(i, 6) * Math.PI, 0);
      dummy.scale.setScalar(0.12 + rand01(i, 7) * 0.3);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [xFactor, count]);

  return (
    <instancedMesh key={count} ref={mesh} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#1a1830" emissive="#8b8ba7" emissiveIntensity={0.3} />
    </instancedMesh>
  );
};

// Shooting star with a glowing trail, looping around the scene.
type CometProps = { color: string; speed: number; phase: number; altitude: number; xAmp: number };

const Comet = ({ color, speed, phase, altitude, xAmp }: CometProps) => {
  const head = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase;
    head.current?.position.set(
      Math.sin(t) * xAmp,
      altitude + Math.sin(t * 0.6) * 3,
      -28 + Math.cos(t * 0.8) * 38,
    );
  });

  return (
    <Trail width={1.8} length={7} color={color} attenuation={(w) => w * w}>
      <mesh ref={head}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#000" emissive="#ffffff" emissiveIntensity={6} />
      </mesh>
    </Trail>
  );
};

// Spiral galaxy made of ~1800 additive particles — the journey's final destination.
const Galaxy = ({ position, count = 4000 }: { position: [number, number, number]; count?: number }) => {
  const points = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const inner = new THREE.Color('#f472b6');
    const outer = new THREE.Color('#22d3ee');

    for (let i = 0; i < count; i++) {
      const radius = rand01(i, 8) ** 0.7 * 6;
      const branchAngle = ((i % 4) / 4) * Math.PI * 2 + radius * 0.9;
      const scatter = (1 - radius / 7) * 0.9;
      positions.set(
        [
          Math.cos(branchAngle) * radius + (rand01(i, 9) - 0.5) * scatter,
          (rand01(i, 10) - 0.5) * scatter * 0.6,
          Math.sin(branchAngle) * radius + (rand01(i, 11) - 0.5) * scatter,
        ],
        i * 3,
      );
      const color = inner.clone().lerp(outer, radius / 6);
      colors.set([color.r, color.g, color.b], i * 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count]);

  useFrame((_, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.06;
    // tilts the disk toward the viewer on approach — gently, ending at ~34° seen from above
    const approach = THREE.MathUtils.smoothstep(scrollState.progress, 0.55, 1);
    const tilt = THREE.MathUtils.lerp(0.35, 0.6, approach);
    points.current.rotation.x = THREE.MathUtils.damp(points.current.rotation.x, tilt, 2, delta);
  });

  return (
    <points ref={points} geometry={geometry} position={position} rotation={[0.35, 0, 0.25]}>
      <pointsMaterial
        size={0.05}
        vertexColors
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

type CelestialProps = {
  position: [number, number, number];
  scale?: number;
  // portrait: the astre keeps a fixed world position like on desktop, but pulled
  // toward the middle of the corridor so a narrow frame still catches it
  mobile?: boolean;
};

// Where the camera stands relative to one astre. `live` is the window in which the
// astre answers the pointer; `shown` drops it off the frame once it is past the fog
// wall. Portrait only — on desktop both are permanently true.
const useFlyby = (z: number, enabled?: boolean) => {
  const [state, setState] = useState({ live: true, shown: true });
  const current = useRef(state);

  useFrame(({ camera }) => {
    if (!enabled) return;
    // the camera flies along -Z, so this is positive while the astre is still ahead
    const ahead = camera.position.z - z;
    const next = {
      live: inFlyby(ahead),
      // Every shader here now fades with distance, but a handful of small rings are
      // plain MeshBasicMaterials, and three's fog can only mix those toward the fog
      // colour — added over the void that is still a smudge, which is what kept
      // showing through behind the hero title. Past the wall they come off entirely.
      shown: ahead < HERO_FOG.y,
    };
    if (next.live === current.current.live && next.shown === current.current.shown) return;
    current.current = next;
    setState(next);
  });

  return state;
};

// The pointer target around each astre is deliberately oversized, so the camera can
// lean in without the pointer ever falling off. On a phone the same sphere would cover
// the screen and swallow every tap meant for empty space — so there it only goes live
// during the flyby, which is the one moment the astre is worth touching anyway.
const AstreHitbox = ({
  radius,
  live,
  onHover,
  onTap,
}: {
  radius: number;
  live: boolean;
  onHover: (hovered: boolean) => void;
  onTap: (origin: { x: number; y: number }) => void;
}) => (
  <mesh
    scale={live ? 1 : 0.0001}
    onPointerOver={(e) => {
      e.stopPropagation();
      onHover(true);
    }}
    onPointerOut={() => {
      onHover(false);
    }}
    onClick={(e) => {
      e.stopPropagation();
      // the tap point in viewport pixels: the section copy lights up from here
      onTap({ x: e.clientX, y: e.clientY });
    }}
  >
    <sphereGeometry args={[radius, 16, 16]} />
    {/* DoubleSide: the portrait camera track flies *through* these spheres, and a
        front-facing-only target stops answering the moment you are inside it — which
        is exactly when the astre fills the phone screen and you want to poke it. */}
    <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>
);

// What a touch device gets in place of the hover it does not have. The astre's own
// animation fires either way; this is the part that makes the *page* answer — the
// camera tips toward it for a beat and settles back, which is the difference between
// a tap that plays an effect and a tap that moves the world. It also retires the
// affordance chip (AstreHint) for that astre, since the point has been made.
// Projects each astre to screen pixels every frame, for the DOM affordance chip to ride
// along (AstreHint). Done here because this is the only place the camera lives, and kept
// out of React state because it changes every frame — hintAnchor is a plain record the
// chip reads from its own animation loop.
const TrackHints = ({ portrait }: { portrait: boolean }) => {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const centre = useMemo(() => new THREE.Vector3(), []);
  const under = useMemo(() => new THREE.Vector3(), []);

  // Both viewports. It used to bail out on desktop, which is why the chip there never moved
  // and sat in the top-left corner: the anchors it reads were left at their initial zeros.
  useFrame(() => {
    (['planet', 'blackHole', 'pulsar'] as AstreKey[]).forEach((key) => {
      const position = astrePosition(key, portrait);
      centre.set(...position).project(camera);
      // the underside of the body, projected too: that difference is the astre's apparent
      // radius in pixels, which is what lets the label hug it at any distance
      under.set(position[0], position[1] - astreHalo(key, portrait), position[2]).project(camera);

      const anchor = hintAnchor[key];
      anchor.x = (centre.x * 0.5 + 0.5) * size.width;
      anchor.y = (-centre.y * 0.5 + 0.5) * size.height;
      anchor.bottom = (-under.y * 0.5 + 0.5) * size.height;
      anchor.radius = Math.abs(anchor.bottom - anchor.y);
      // past the far plane in NDC means the astre is behind the camera
      anchor.behind = centre.z > 1;
    });
  });

  return null;
};

const answerTap = (
  key: AstreKey,
  position: [number, number, number],
  origin: { x: number; y: number },
) => {
  markTapped(key, origin);
  if (!isTouchDevice()) return;
  navigator.vibrate?.(12);
  focusState.target = new THREE.Vector3(...position);
  window.setTimeout(() => {
    focusState.target = null;
  }, 1400);
};

// ── Ringed planet ──────────────────────────────────────────────────────────
// Companion of the "À propos" section. The ring is a particle band rather than a
// pair of wireframe discs: every grain carries its own orbital speed, so the band
// shears as it turns instead of rotating as one rigid piece.

const RING_INNER = 2.15;
const RING_OUTER = 3.6;
const RING_GAP: [number, number] = [2.75, 2.95]; // Cassini-style division

// Orbit and the click shockwave both live in the vertex shader: at a couple of
// thousand grains, rewriting the position buffer from JS every frame is the one
// thing that would actually cost something here.
const RING_VERT = /* glsl */ `
  attribute float aSpeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uShock;  // crest position in [0,1] while a click plays out, else -1
  uniform float uScale;  // pixels per world unit at one unit of depth
  uniform vec2 uFront;   // crest radius at shock 0 and 1 — reverse them to collapse inward
  uniform float uPush;   // radial displacement at the crest; negative drags grains in
  uniform float uLift;   // out-of-plane displacement at the crest
  uniform float uBeam;   // 0 = even, 1 = one limb brightened, the way a relativistic disc reads
  uniform vec2 uFog;     // near, far — matched to the scene's own fog
  varying vec3 vColor;
  varying float vGlow;
  varying float vFog;

  void main() {
    float radius = length(position.xz);
    float angle = uTime * aSpeed;
    float c = cos(angle);
    float s = sin(angle);
    vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);

    // a gaussian crest travelling through the band. It starts at one edge rather
    // than at the centre, so it does not spend its amplitude crossing empty space
    float front = mix(uFront.x, uFront.y, uShock);
    float offset = radius - front;
    float wave = exp(-offset * offset * 6.0) * (1.0 - smoothstep(0.3, 0.9, uShock));
    p.xz *= 1.0 + wave * uPush;
    p.y += wave * uLift;

    // Doppler beaming: the limb turning toward the camera outshines the other
    float side = p.x / max(radius, 0.001);
    vColor = aColor * mix(1.0, 0.4 + 0.85 * (side * 0.5 + 0.5), uBeam);
    vGlow = wave;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFog = 1.0 - clamp((-mv.z - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
    // capped: the mobile flyby passes far closer than the desktop track, and
    // uncapped grains balloon into confetti that no longer reads as a band
    gl_PointSize = min(aSize * (1.0 + wave * 2.4) * uScale / max(0.001, -mv.z), 11.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const RING_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vGlow;
  varying float vFog;

  void main() {
    if (vFog < 0.01) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float d2 = dot(uv, uv);
    if (d2 > 0.25) discard;
    gl_FragColor = vec4(vColor * (1.0 + vGlow * 2.2), smoothstep(0.25, 0.02, d2) * vFog);
  }
`;

// Rim light. A flat back-side sphere gives an even wash; weighting by the viewing
// angle puts the glow on the limb, where an atmosphere actually shows.
// Same hand-rolled fog as the grain bands, and for the same reason: these are raw
// ShaderMaterials, so three injects nothing, and an additive glow that never fades
// with distance is what was still hanging behind the hero title with every grain of
// its own astre already gone.
const GLOW_VERT = /* glsl */ `
  uniform vec2 uFog;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vFog;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vUv = uv;
    vFog = 1.0 - clamp((-mv.z - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMOSPHERE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFog;

  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.4);
    gl_FragColor = vec4(uColor * rim * uIntensity * 1.6, rim * uIntensity) * vFog;
  }
`;

// Latitude bands over the lit core: gas-giant structure, drawn graphically rather
// than with noise so it stays in the same register as the rest of the scene.
const BANDS_FRAG = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vFog;

  void main() {
    float lat = vUv.y;
    float bands = sin(lat * 58.0 + sin(lat * 9.0) * 2.6) * 0.5 + 0.5;
    bands = pow(bands, 2.2);
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.0);
    vec3 tint = mix(vec3(0.35, 0.12, 0.78), vec3(0.96, 0.45, 0.85), lat);
    float a = (bands * 0.42 + rim * 0.34) * uIntensity * vFog;
    gl_FragColor = vec4(tint * a, a);
  }
`;

type Band = {
  count: number;
  inner: number;
  outer: number;
  spin: number;
  thickness: number;
  size: [number, number];
  /** colour sampled inner → middle → outer */
  stops: [string, string, string];
  /** a division swept clear of grains, e.g. Cassini */
  gap?: [number, number];
  /** >1 crowds grains toward the inner edge, the way an accretion disc packs in */
  bias?: number;
  /** 0..1, how much smaller the outermost grains are than the innermost */
  falloff?: number;
  /** keeps two bands in the same scene from drawing the same cloud */
  salt: number;
};

// Deterministic grain cloud: colour banded by radius, an optional clean division,
// and Keplerian speeds so inner grains outrun outer ones and the band shears.
const orbitGeometry = ({
  count,
  inner,
  outer,
  spin,
  thickness,
  size,
  stops,
  gap,
  salt,
  bias = 1,
  falloff = 0,
}: Band) => {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const near = new THREE.Color(stops[0]);
  const mid = new THREE.Color(stops[1]);
  const far = new THREE.Color(stops[2]);
  const shade = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const spread = rand01(i, salt) ** bias;
    let radius = inner + spread * (outer - inner);
    // push anything landing in the division onto one of its edges
    if (gap && radius > gap[0] && radius < gap[1]) {
      radius = radius < (gap[0] + gap[1]) / 2 ? gap[0] : gap[1];
    }
    const angle = rand01(i, salt + 1) * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (rand01(i, salt + 2) - 0.5) * thickness;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    speeds[i] = spin * (inner / radius) ** 1.5 * (0.9 + rand01(i, salt + 3) * 0.2);

    const k = (radius - inner) / (outer - inner);
    shade.copy(near).lerp(mid, Math.min(1, k * 2));
    if (k > 0.5) shade.copy(mid).lerp(far, (k - 0.5) * 2);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;

    sizes[i] = (size[0] + rand01(i, salt + 4) * (size[1] - size[0])) * (1 - falloff * spread);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  return geo;
};

// Shared by every band: the point size has to track the drawing buffer and the
// warp effect's field of view, since gl_PointSize is in device pixels.
const pixelsPerUnit = (height: number, dpr: number, camera: THREE.Camera) => {
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 60;
  return (height * dpr) / (2 * Math.tan((fov * Math.PI) / 360));
};

const Planet = ({ position, scale = 1, mobile }: CelestialProps) => {
  const planet = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const moonOrbit = useRef<THREE.Group>(null);
  const ringMaterial = useRef<THREE.ShaderMaterial>(null);
  const atmosphere = useRef<THREE.ShaderMaterial>(null);
  const bands = useRef<THREE.ShaderMaterial>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const blast = useRef<THREE.Mesh>(null);
  const blastMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMaterial = useRef<THREE.ShaderMaterial>(null);
  // orbital clock, so a click can spin the band up without desyncing the grains
  const ringClock = useRef(0);
  const ringBoost = useRef(0);
  const moonBoost = useRef(0);
  // -1 = idle, otherwise the shockwave's progress
  const shock = useRef(-1);
  const flash = useRef(0);
  const [hovered, setHovered] = useState(false);
  const flyby = useFlyby(position[2], mobile);
  useCursor(hovered);

  const ringGeometry = useMemo(
    () =>
      orbitGeometry({
        count: mobile ? 2200 : 2800,
        inner: RING_INNER,
        outer: RING_OUTER,
        gap: RING_GAP,
        spin: 0.5,
        thickness: 0.08,
        size: [0.045, 0.1],
        stops: [NEON.cyan, NEON.violet, NEON.pink],
        salt: 70,
      }),
    [mobile],
  );
  const ringUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uShock: { value: -1 },
      uScale: { value: 600 },
      uFront: { value: new THREE.Vector2(1.9, 4.75) },
      uPush: { value: 0.26 },
      uLift: { value: 0.55 },
      uBeam: { value: 0 },
      uFog: { value: fogRange() },
    }),
    [],
  );
  const atmosphereUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#8b5cf6') },
      uIntensity: { value: 1 },
      uFog: { value: fogRange() },
    }),
    [],
  );
  const bandUniforms = useMemo(
    () => ({ uIntensity: { value: 1 }, uFog: { value: fogRange() } }),
    [],
  );
  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#a5f3fc') },
      uIntensity: { value: 0 },
      uFog: { value: fogRange() },
    }),
    [],
  );

  useFrame(({ camera, size, viewport }, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.15;
    if (moonOrbit.current) moonOrbit.current.rotation.y += delta * (0.45 + moonBoost.current);
    ringBoost.current = THREE.MathUtils.damp(ringBoost.current, 0, 1.2, delta);
    moonBoost.current = THREE.MathUtils.damp(moonBoost.current, 0, 1.4, delta);
    flash.current = THREE.MathUtils.damp(flash.current, 0, 3, delta);

    ringClock.current += delta * (1 + ringBoost.current);
    if (shock.current >= 0) {
      shock.current += delta / 1.05;
      if (shock.current > 1.0) shock.current = -1;
    }

    if (ringMaterial.current) {
      ringMaterial.current.uniforms.uTime.value = ringClock.current;
      ringMaterial.current.uniforms.uShock.value = shock.current;
      ringMaterial.current.uniforms.uScale.value = pixelsPerUnit(size.height, viewport.dpr, camera);
    }
    if (atmosphere.current) atmosphere.current.uniforms.uIntensity.value = 1 + flash.current * 3.5;
    if (bands.current) bands.current.uniforms.uIntensity.value = 1 + flash.current * 2.5;
    if (core.current) core.current.emissiveIntensity = 0.45 + flash.current * 2.2;

    const t = shock.current;
    if (blast.current && blastMaterial.current) {
      blast.current.visible = t >= 0;
      if (t >= 0) {
        blast.current.scale.setScalar(1.7 + t * 4.2);
        blastMaterial.current.opacity = Math.max(0, 1 - t) ** 2.2;
      }
    }
    if (halo.current && haloMaterial.current) {
      halo.current.visible = t >= 0;
      if (t >= 0) {
        halo.current.scale.setScalar(1.15 + t * 1.6);
        haloMaterial.current.uniforms.uIntensity.value = Math.max(0, 1 - t) ** 4 * 5;
      }
    }
  });

  const detonate = (origin: { x: number; y: number }) => {
    shock.current = 0;
    flash.current = 1;
    ringBoost.current += 9;
    moonBoost.current += 6;
    answerTap('planet', position, origin);
  };

  return (
    <group position={position} scale={scale} visible={flyby.shown}>
      <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.5}>
      <group ref={planet} rotation={[0.35, 0, -0.15]}>
        {/* invisible hitbox: keeps the hover alive while the camera leans in */}
        <AstreHitbox
          radius={4}
          live={!mobile || flyby.live}
          onHover={setHovered}
          onTap={detonate}
        />
        {/* core */}
        <mesh>
          <sphereGeometry args={[1.7, 48, 48]} />
          <meshStandardMaterial
            ref={core}
            color="#160d33"
            emissive="#7c3aed"
            emissiveIntensity={0.45}
            roughness={0.35}
          />
        </mesh>
        {/* banded cloud deck */}
        <mesh scale={1.008}>
          <sphereGeometry args={[1.7, 64, 48]} />
          <shaderMaterial
            ref={bands}
            uniforms={bandUniforms}
            vertexShader={GLOW_VERT}
            fragmentShader={BANDS_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* blast shell: a rim-lit bubble racing ahead of the ring wave */}
        <mesh ref={halo} scale={1.2} visible={false}>
          <sphereGeometry args={[1.7, 32, 32]} />
          <shaderMaterial
            ref={haloMaterial}
            uniforms={haloUniforms}
            vertexShader={GLOW_VERT}
            fragmentShader={ATMOSPHERE_FRAG}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* atmosphere: rim-weighted, so the glow sits on the limb */}
        <mesh scale={1.15}>
          <sphereGeometry args={[1.7, 48, 48]} />
          <shaderMaterial
            ref={atmosphere}
            uniforms={atmosphereUniforms}
            vertexShader={GLOW_VERT}
            fragmentShader={ATMOSPHERE_FRAG}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* ring: one draw call, orbits and reacts to clicks on the GPU */}
        <group ref={rings} rotation={[0.16, 0, 0]}>
          <points geometry={ringGeometry}>
            <shaderMaterial
              ref={ringMaterial}
              uniforms={ringUniforms}
              vertexShader={RING_VERT}
              fragmentShader={RING_FRAG}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
          {/* shockwave, expanding in the ring plane */}
          <mesh ref={blast} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.86, 1, 128]} />
            {/* toneMapped: the canvas tone-maps by default, which crushes a bright
                additive colour to grey — the one thing this ring must not be */}
            <meshBasicMaterial
              ref={blastMaterial}
              color="#67e8f9"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
        {/* little moon weaving through the rings */}
        <group ref={moonOrbit} rotation={[0.45, 0, 0.25]}>
          <mesh position={[2.95, 0, 0]}>
            <sphereGeometry args={[0.22, 24, 24]} />
            <meshStandardMaterial color="#0a0a18" emissive="#e2e8f0" emissiveIntensity={1.4} />
          </mesh>
        </group>
      </group>
      </Float>
    </group>
  );
};

// ── Black hole ─────────────────────────────────────────────────────────────
// Companion of "Expérience". Two wireframe tori became a real accretion disc:
// a grain band wide enough for the mobile flyby to pass through, lit brighter on
// the limb turning toward the camera. Click: the disc collapses inward and the
// hole answers with relativistic jets.

const DISC_INNER = 1.45;
const DISC_OUTER = 5.4;

// Two opposing beams along the disc axis, fired on click. Idle costs nothing:
// the whole system is hidden between detonations.
const JET_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSpread;
  attribute float aPhase;
  attribute float aSide;
  uniform float uJet;
  uniform float uScale;
  varying float vFade;

  void main() {
    float travel = aSeed * 0.3 + uJet * (1.2 + aSeed * 1.1);
    float cone = 0.09 + travel * 0.2;
    vec3 p = vec3(
      cos(aPhase) * aSpread * cone,
      aSide * travel * 5.0,
      sin(aPhase) * aSpread * cone
    );
    // ramps in off the horizon, then dies back once the beam has run its length
    vFade = smoothstep(0.0, 0.12, travel) * (1.0 - smoothstep(0.5, 1.0, uJet));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min((0.05 + aSpread * 0.035) * uScale / max(0.001, -mv.z), 10.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const JET_FRAG = /* glsl */ `
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d2 = dot(uv, uv);
    if (d2 > 0.25) discard;
    vec3 col = mix(vec3(0.72, 0.96, 1.0), vec3(0.66, 0.36, 0.98), 0.45);
    gl_FragColor = vec4(col * (1.0 + vFade * 2.0), smoothstep(0.25, 0.02, d2) * vFade);
  }
`;

const jetGeometry = (count: number) => {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const spreads = new Float32Array(count);
  const phases = new Float32Array(count);
  const sides = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    seeds[i] = rand01(i, 80);
    spreads[i] = rand01(i, 81) ** 0.6;
    phases[i] = rand01(i, 82) * Math.PI * 2;
    sides[i] = i % 2 === 0 ? 1 : -1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSpread', new THREE.BufferAttribute(spreads, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  return geo;
};

const BlackHole = ({ position, scale = 1, mobile }: CelestialProps) => {
  const discMaterial = useRef<THREE.ShaderMaterial>(null);
  const jets = useRef<THREE.Points>(null);
  const jetMaterial = useRef<THREE.ShaderMaterial>(null);
  const photonRing = useRef<THREE.Mesh>(null);
  const photonMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const lens = useRef<THREE.ShaderMaterial>(null);
  const discClock = useRef(0);
  const discBoost = useRef(0);
  // -1 = idle, otherwise the collapse's progress
  const collapse = useRef(-1);
  const flare = useRef(0);
  const [hovered, setHovered] = useState(false);
  const flyby = useFlyby(position[2], mobile);
  useCursor(hovered);

  const discGeometry = useMemo(
    () =>
      orbitGeometry({
        count: mobile ? 3000 : 4000,
        inner: DISC_INNER,
        outer: DISC_OUTER,
        spin: 0.95,
        thickness: 0.1,
        size: [0.05, 0.1],
        // white-hot at the horizon, cooling outward
        stops: ['#fff1f8', NEON.pink, '#6d28d9'],
        salt: 20,
        // a disc is not an even scatter: it packs in and brightens toward the ISCO
        bias: 1.9,
        falloff: 0.45,
      }),
    [mobile],
  );
  const beams = useMemo(() => jetGeometry(mobile ? 200 : 300), [mobile]);

  const discUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uShock: { value: -1 },
      uScale: { value: 600 },
      // reversed against the planet's: the crest starts outside and drags inward
      uFront: { value: new THREE.Vector2(DISC_OUTER + 0.4, DISC_INNER - 0.5) },
      uPush: { value: -0.3 },
      uLift: { value: 0.12 },
      uBeam: { value: 1 },
      uFog: { value: fogRange() },
    }),
    [],
  );
  const jetUniforms = useMemo(() => ({ uJet: { value: 0 }, uScale: { value: 600 } }), []);
  const lensUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#c4b5fd') },
      uIntensity: { value: 1 },
      uFog: { value: fogRange() },
    }),
    [],
  );

  useFrame(({ camera, size, viewport }, delta) => {
    discBoost.current = THREE.MathUtils.damp(discBoost.current, 0, 1.3, delta);
    flare.current = THREE.MathUtils.damp(flare.current, 0, 2.6, delta);
    discClock.current += delta * (1 + discBoost.current);

    if (collapse.current >= 0) {
      collapse.current += delta / 1.25;
      if (collapse.current > 1.0) collapse.current = -1;
    }
    const t = collapse.current;
    const pixels = pixelsPerUnit(size.height, viewport.dpr, camera);

    if (discMaterial.current) {
      discMaterial.current.uniforms.uTime.value = discClock.current;
      discMaterial.current.uniforms.uShock.value = t;
      discMaterial.current.uniforms.uScale.value = pixels;
    }
    if (jets.current && jetMaterial.current) {
      jets.current.visible = t >= 0;
      if (t >= 0) {
        jetMaterial.current.uniforms.uJet.value = t;
        jetMaterial.current.uniforms.uScale.value = pixels;
      }
    }
    if (photonRing.current && photonMaterial.current) {
      const flareScale = 1 + flare.current * 0.35;
      photonRing.current.scale.set(flareScale, flareScale, 1);
      photonMaterial.current.opacity = Math.min(1, 0.85 + flare.current);
    }
    if (lens.current) lens.current.uniforms.uIntensity.value = 0.7 + flare.current * 3;
  });

  const detonate = (origin: { x: number; y: number }) => {
    collapse.current = 0;
    flare.current = 1;
    discBoost.current += 7;
    answerTap('blackHole', position, origin);
  };

  return (
    <group position={position} scale={scale} visible={flyby.shown}>
      <group rotation={[0.9, 0.15, 0]}>
        {/* invisible hitbox: keeps the hover alive while the camera leans in */}
        {/* the disc is the widest thing in the scene, and on portrait the track goes
            straight through it — the target follows it out a little further there */}
        <AstreHitbox
          radius={mobile ? 3.8 : 3.2}
          live={!mobile || flyby.live}
          onHover={setHovered}
          onTap={detonate}
        />
        {/* event horizon: the one thing in the scene that emits nothing */}
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        {/* lensing halo — light bent around the far side of the horizon */}
        <mesh scale={1.45}>
          <sphereGeometry args={[1, 32, 32]} />
          <shaderMaterial
            ref={lens}
            uniforms={lensUniforms}
            vertexShader={GLOW_VERT}
            fragmentShader={ATMOSPHERE_FRAG}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* photon ring hugging the horizon; flares when the hole is fed */}
        <mesh ref={photonRing}>
          <torusGeometry args={[1.14, 0.022, 12, 96]} />
          <meshBasicMaterial
            ref={photonMaterial}
            color="#ffffff"
            transparent
            opacity={0.85}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* accretion disc */}
        <points geometry={discGeometry}>
          <shaderMaterial
            ref={discMaterial}
            uniforms={discUniforms}
            vertexShader={RING_VERT}
            fragmentShader={RING_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        {/* relativistic jets, fired on click */}
        <points ref={jets} geometry={beams} visible={false}>
          <shaderMaterial
            ref={jetMaterial}
            uniforms={jetUniforms}
            vertexShader={JET_VERT}
            fragmentShader={JET_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
};

// ── Pulsar ─────────────────────────────────────────────────────────────────
// Companion of "Projets". Deliberately made of light *shapes* rather than grains:
// the planet's ring and the black hole's disc already share one particle shader
// between them, and a third grain cloud read as more of the same. This one is
// cones and rings, and it is the only astre in the scene with a rhythm — the
// others turn, this one beats.

// Long and narrow rather than short and wide: a searing shaft carries further across the
// frame and keeps its shape when the camera is close, where a fat cone just becomes a haze.
const BEAM_LENGTH = 11;
const BEAM_RADIUS = 1;
const MAGNETIC_TILT = 0.55; // offset from the spin axis, which is what makes it sweep
const PULSE_RINGS = 5;
// How sharply the beam has to be pointing at you to blind you. High, so the sweep lands as
// a strike rather than a gradual brightening — this is the whole lighthouse effect.
const SWEEP_FOCUS = 9;

// A hollow open cone, lit at the silhouette. Seen edge-on the walls pile up and
// the shaft reads as volume, which a flat triangle of colour never does.
const BEAM_VERT = /* glsl */ `
  uniform vec2 uFog;
  varying vec2 vBeam;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFog;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vBeam = uv;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vFog = 1.0 - clamp((-mv.z - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vBeam;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFog;

  void main() {
    // uv.y is 1 at the apex, where the beam leaves the star, and 0 at the far end
    float along = pow(vBeam.y, 1.3);
    float grazing = 1.0 - abs(dot(vNormal, vView));
    float a = along * grazing * uIntensity * vFog;
    gl_FragColor = vec4(uColor * a * 1.5, a);
  }
`;

const Pulsar = ({ position, scale = 1, mobile }: CelestialProps) => {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  // the tilted group the beams live in: its local +Y is the magnetic axis, and where that
  // axis is pointing relative to the viewer is what the sweep is made of
  const axis = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const corona = useRef<THREE.ShaderMaterial>(null);
  const beamMaterial = useRef<THREE.ShaderMaterial>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const ringMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const burst = useRef<THREE.Mesh>(null);
  const burstMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const wake = useRef<THREE.Mesh>(null);
  const wakeMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const spinBoost = useRef(0);
  const flash = useRef(0);
  // -1 = idle, otherwise the progress of the click's shockwave
  const shock = useRef(-1);
  const [hovered, setHovered] = useState(false);
  const flyby = useFlyby(position[2], mobile);
  useCursor(hovered);

  // apex at the origin so the beam narrows to a point on the star, base out along -Y
  const beamGeometry = useMemo(() => {
    const geo = new THREE.ConeGeometry(BEAM_RADIUS, BEAM_LENGTH, 28, 1, true);
    geo.translate(0, -BEAM_LENGTH / 2, 0);
    return geo;
  }, []);

  const beamUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#8ff0ff') },
      uIntensity: { value: 1 },
      uFog: { value: fogRange() },
    }),
    [],
  );
  const coronaUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#c8f6ff') },
      uIntensity: { value: 1.2 },
      uFog: { value: fogRange() },
    }),
    [],
  );

  // scratch vectors, so the sweep costs no allocation per frame
  const beamAxis = useMemo(() => new THREE.Vector3(), []);
  const toViewer = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }, delta) => {
    const time = clock.elapsedTime;
    spinBoost.current = THREE.MathUtils.damp(spinBoost.current, 0, 1.3, delta);
    flash.current = THREE.MathUtils.damp(flash.current, 0, 2.6, delta);
    if (spin.current) spin.current.rotation.y += delta * (1.15 + spinBoost.current);

    // Bows out over the last stretch of the journey. Its own visibility test only asks
    // whether the star is too far away, so once the camera had gone past it the star kept
    // beating behind you — and with an 11-unit beam and additive blending, "behind you"
    // still reaches into the frame. At the end of the scroll the destination is the galaxy,
    // and the pulsar has no business still flashing over the closing screen.
    const bowOut = 1 - THREE.MathUtils.smoothstep(scrollState.progress, 0.9, 0.99);
    if (root.current) root.current.visible = flyby.shown && bowOut > 0.01;

    // the beat: a sharp crest once per turn rather than a gentle sine, so it
    // reads as a pulse and not as breathing
    const beat = Math.abs(Math.sin(time * 1.6)) ** 6;

    // The lighthouse. The beams already swept — but only their brightness was animated, on
    // a timer that had nothing to do with where they were pointing, so the one moment that
    // makes a pulsar a pulsar never happened: the strike as the shaft comes round onto you.
    // This reads the magnetic axis out of the tilted group's world matrix (its local +Y,
    // the 2nd column) and measures it against the direction of the camera. Absolute value
    // because the star fires both ways, and a high power so the flare is a strike and not a
    // swell.
    let sweep = 0;
    if (axis.current) {
      const m = axis.current.matrixWorld.elements;
      beamAxis.set(m[4], m[5], m[6]).normalize();
      toViewer
        .set(
          camera.position.x - position[0],
          camera.position.y - position[1],
          camera.position.z - position[2],
        )
        .normalize();
      sweep = Math.abs(beamAxis.dot(toViewer)) ** SWEEP_FOCUS;
    }

    // every output is scaled by bowOut, so the star dims away rather than being switched off
    if (core.current) {
      core.current.scale.setScalar(1 + beat * 0.25 + sweep * 0.5 + flash.current * 0.9);
    }
    if (coreMaterial.current) {
      coreMaterial.current.opacity = Math.min(1, 0.85 + flash.current) * bowOut;
    }
    if (corona.current) {
      corona.current.uniforms.uIntensity.value =
        (1.2 + beat * 1.4 + sweep * 2.6 + flash.current * 4.5) * bowOut;
    }
    if (beamMaterial.current) {
      // the shaft itself is dimmer than before between sweeps and far brighter through one:
      // the average luminance barely moves, the drama is all in the contrast
      beamMaterial.current.uniforms.uIntensity.value =
        (0.4 + beat * 0.6 + sweep * 2.2 + flash.current * 3.5) * bowOut;
    }

    // radio pulses leaving the star, staggered so one is always on its way out
    rings.current.forEach((ring, i) => {
      const material = ringMaterials.current[i];
      if (!ring || !material) return;
      const t = (time * 0.5 + i / PULSE_RINGS) % 1;
      ring.scale.setScalar(0.6 + t * 9);
      material.opacity = (1 - t) ** 2 * 0.5 * bowOut;
    });

    if (shock.current >= 0) {
      shock.current += delta / 1.3;
      if (shock.current > 1) shock.current = -1;
    }
    // Two fronts from one tap, not one: a hard white ring that outruns everything, and a
    // slower cyan one behind it. One expanding circle reads as a ripple; two at different
    // speeds read as something that detonated.
    if (burst.current && burstMaterial.current) {
      const t = shock.current;
      burst.current.visible = t >= 0;
      if (t >= 0) {
        burst.current.scale.setScalar(0.8 + t * 20);
        burstMaterial.current.opacity = Math.max(0, 1 - t) ** 1.6;
      }
    }
    if (wake.current && wakeMaterial.current) {
      // starts a beat late and travels two thirds as far, so it is still on its way out
      // when the first front has gone
      const t = shock.current >= 0 ? Math.max(0, shock.current - 0.12) / 0.88 : -1;
      wake.current.visible = t >= 0;
      if (t >= 0) {
        wake.current.scale.setScalar(0.6 + t * 13);
        wakeMaterial.current.opacity = Math.max(0, 1 - t) ** 2 * 0.8;
      }
    }
  });

  const detonate = (origin: { x: number; y: number }) => {
    shock.current = 0;
    flash.current = 1;
    spinBoost.current += 9;
    answerTap('pulsar', position, origin);
  };

  // No `visible` prop on the group: useFrame owns it, since it folds flyby.shown together
  // with the bow-out at the end of the journey. Both writing it would have React reset the
  // group on every re-render.
  return (
    <group ref={root} position={position} scale={scale}>
      {/* invisible hitbox: keeps the hover alive while the camera leans in */}
      <AstreHitbox
        radius={2.6}
        live={!mobile || flyby.live}
        onHover={setHovered}
        onTap={detonate}
      />
      {/* the neutron star: small and searing */}
      <mesh ref={core}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial
          ref={coreMaterial}
          color="#ffffff"
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={2.2}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <shaderMaterial
          ref={corona}
          uniforms={coronaUniforms}
          vertexShader={GLOW_VERT}
          fragmentShader={ATMOSPHERE_FRAG}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={spin}>
        {/* the magnetic axis is offset from the spin axis — that offset is the
            whole trick, it is what sweeps the beams around like a lighthouse */}
        <group ref={axis} rotation={[0, 0, MAGNETIC_TILT]}>
          <mesh geometry={beamGeometry}>
            <shaderMaterial
              ref={beamMaterial}
              uniforms={beamUniforms}
              vertexShader={BEAM_VERT}
              fragmentShader={BEAM_FRAG}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh geometry={beamGeometry} rotation={[Math.PI, 0, 0]}>
            <shaderMaterial
              uniforms={beamUniforms}
              vertexShader={BEAM_VERT}
              fragmentShader={BEAM_FRAG}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      </group>
      {/* equatorial pulses, so they read as rings in perspective rather than as
          flat circles pasted on the screen */}
      {Array.from({ length: PULSE_RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            rings.current[i] = mesh;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.94, 1, 96]} />
          <meshBasicMaterial
            ref={(material) => {
              ringMaterials.current[i] = material;
            }}
            color="#67e8f9"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      {/* click: one hard pulse that outruns the rest */}
      <mesh ref={burst} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 1, 128]} />
        <meshBasicMaterial
          ref={burstMaterial}
          color="#ffffff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* and the slower front behind it, thicker and cyan, so the tap has a wake */}
      <mesh ref={wake} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 1, 128]} />
        <meshBasicMaterial
          ref={wakeMaterial}
          color="#67e8f9"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* on a phone the camera passes much closer than the framing suggests, and
          the full desktop intensity washes the frame through the bloom pass */}
      <pointLight intensity={mobile ? 8 : 18} color="#67e8f9" distance={14} />
    </group>
  );
};

// Contact constellations — the four contact links drawn as star constellations
// wandering across the lower part of the view. Stars trace each logo, linked by
// faint lines; hovering fills the shape with its brand color. Click opens the link.

type ConstellationElement = {
  points: [number, number][];
  closed?: boolean; // default true (loop); false = open stroke (e.g. letters)
  color: string;
  idle: number; // line opacity at rest
  hover: number; // line opacity on hover
  fill?: string; // fill color revealed on hover (closed shapes only)
  fillHover?: number;
  fillAdditive?: boolean;
};

type ConstellationLogo = {
  label: string;
  href: string;
  salt: number; // seed for the deterministic star depths
  outline: ConstellationElement;
  inner?: ConstellationElement[];
  extraStars?: [number, number][]; // lone stars (eyes, dots…)
  position: [number, number, number];
  // 2×2 grid on portrait screens. The rows sit higher than the geometry alone would
  // suggest: the mini-map lays a 96px fade from the void across the bottom of the frame,
  // and at this distance one world unit is about 78px, so the lower row was sinking into it.
  mobilePosition: [number, number, number];
  phase: number; // desynchronizes the wander so logos never move in lockstep
  wander?: number; // horizontal drift amplitude
  baseScale?: number; // overall size (slightly smaller on mobile)
};

const CONTACT_LOGOS: ConstellationLogo[] = [
  {
    label: 'Email',
    href: LINKS.email,
    salt: 60,
    position: [-6.3, -2.1, -57.5],
    mobilePosition: [-1.15, -1, -57.5],
    phase: 0,
    outline: {
      points: [
        [-0.85, 0.55], [0.85, 0.55], [0.85, 0], [0.85, -0.55],
        [-0.85, -0.55], [-0.85, 0],
      ],
      color: '#22d3ee',
      idle: 0.3,
      hover: 0.9,
      fill: '#22d3ee',
      fillHover: 0.3,
      fillAdditive: true,
    },
    inner: [
      {
        points: [[-0.85, 0.55], [0, -0.1], [0.85, 0.55]],
        color: '#9be7ff',
        idle: 0.5,
        hover: 1,
        fill: '#ffffff',
        fillHover: 0.45,
      },
    ],
  },
  {
    label: 'GitHub',
    href: LINKS.github,
    salt: 61,
    position: [-2.1, -2.1, -56.5],
    mobilePosition: [1.15, -1, -56.8],
    phase: 2.1,
    outline: {
      // octocat head: wide cheeks, two pointy ears, rounded chin
      points: [
        [-0.62, -0.1], [-0.6, 0.22], [-0.5, 0.6], [-0.26, 0.44],
        [0.26, 0.44], [0.5, 0.6], [0.6, 0.22], [0.62, -0.1],
        [0.45, -0.45], [0.18, -0.6], [-0.18, -0.6], [-0.45, -0.45],
      ],
      color: '#c084fc',
      idle: 0.3,
      hover: 0.9,
      fill: '#a855f7',
      fillHover: 0.35,
      fillAdditive: true,
    },
    inner: [
      // big oval eyes, lit white on hover like the cutout of the real mark
      {
        points: [[-0.4, 0.02], [-0.27, 0.11], [-0.14, 0.02], [-0.27, -0.07]],
        color: '#e9d5ff',
        idle: 0.45,
        hover: 1,
        fill: '#ffffff',
        fillHover: 0.9,
      },
      {
        points: [[0.14, 0.02], [0.27, 0.11], [0.4, 0.02], [0.27, -0.07]],
        color: '#e9d5ff',
        idle: 0.45,
        hover: 1,
        fill: '#ffffff',
        fillHover: 0.9,
      },
      // the little curled tentacle of the invertocat
      {
        points: [[-0.18, -0.6], [-0.3, -0.76], [-0.52, -0.8], [-0.6, -0.66]],
        closed: false,
        color: '#c084fc',
        idle: 0.4,
        hover: 0.9,
      },
    ],
  },
  {
    label: 'LinkedIn',
    href: LINKS.linkedin,
    salt: 62,
    position: [2.1, -2.1, -57.2],
    mobilePosition: [-1.15, -2.25, -57.2],
    phase: 4.2,
    outline: {
      points: [
        [-0.38, 0.6], [0.38, 0.6], [0.6, 0.38], [0.6, -0.38],
        [0.38, -0.6], [-0.38, -0.6], [-0.6, -0.38], [-0.6, 0.38],
      ],
      color: '#5ea3e6',
      idle: 0.3,
      hover: 0.9,
      fill: '#2f7fd1',
      fillHover: 0.45,
      fillAdditive: true,
    },
    inner: [
      {
        points: [[-0.26, -0.35], [-0.26, 0.05]],
        closed: false,
        color: '#dbeafe',
        idle: 0.5,
        hover: 1,
      },
      {
        points: [
          [-0.04, -0.35], [-0.04, 0.05], [0.08, 0.14], [0.2, 0.1],
          [0.26, -0.04], [0.26, -0.35],
        ],
        closed: false,
        color: '#dbeafe',
        idle: 0.5,
        hover: 1,
      },
    ],
    extraStars: [[-0.26, 0.24]],
  },
  {
    label: 'YouTube',
    href: LINKS.youtube,
    salt: 63,
    position: [6.3, -2.1, -56.8],
    mobilePosition: [1.15, -2.25, -56.5],
    phase: 5.6,
    outline: {
      points: [
        [-0.55, 0.5], [0.55, 0.5], [0.78, 0.28], [0.78, -0.28],
        [0.55, -0.5], [-0.55, -0.5], [-0.78, -0.28], [-0.78, 0.28],
      ],
      color: '#ff4d67',
      idle: 0.3,
      hover: 0.9,
      fill: '#ff1a3c',
      fillHover: 0.35,
      fillAdditive: true,
    },
    inner: [
      {
        points: [[-0.2, 0.26], [-0.2, -0.26], [0.34, 0]],
        color: '#ffb3c0',
        idle: 0.5,
        hover: 1,
        fill: '#ffffff',
        fillHover: 0.95,
      },
    ],
  },
];

// A polyline becomes segment pairs so everything renders as one LineSegments.
const toSegments = (points: THREE.Vector3[], closed: boolean) => {
  const pairs: THREE.Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) pairs.push(points[i], points[i + 1]);
  if (closed) pairs.push(points[points.length - 1], points[0]);
  return new THREE.BufferGeometry().setFromPoints(pairs);
};

// Constellations only react to the pointer once the journey reaches the contact
// section — otherwise they can be hovered/clicked from way back in the scene.
const nearJourneyEnd = () => scrollState.progress > 0.82;

// On touch, only one constellation stays lit at a time: tapping another one
// (or empty space) releases the previous selection.
const touchSelection = { label: null as string | null };

const Constellation = ({ label, href, salt, outline, inner = [], extraStars = [], position, phase, wander = 1.4, baseScale = 1 }: Omit<ConstellationLogo, 'mobilePosition'>) => {
  const group = useRef<THREE.Group>(null);
  const starsMaterial = useRef<THREE.PointsMaterial>(null);
  const lineMaterials = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const fillMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const [hovered, setHovered] = useState(false);
  const touch = isTouchDevice();
  useCursor(hovered);

  const elements = useMemo(() => [outline, ...inner], [outline, inner]);

  const { starsGeometry, lineGeometries, fillGeometries } = useMemo(() => {
    // each outline star gets its own depth, like a real constellation
    const outlinePoints = outline.points.map(
      ([x, y], i) => new THREE.Vector3(x, y, (rand01(i, salt) - 0.5) * 0.4),
    );
    // inner shapes get depths interpolated from the surrounding outline stars,
    // so they follow the same deformation and always stay inside the frame
    const interpolateZ = (x: number, y: number) => {
      let sum = 0;
      let weights = 0;
      outlinePoints.forEach((star) => {
        const w = 1 / ((x - star.x) ** 2 + (y - star.y) ** 2 + 0.001);
        sum += star.z * w;
        weights += w;
      });
      return sum / weights;
    };
    const perElement = elements.map((element, index) =>
      index === 0
        ? outlinePoints
        : element.points.map(([x, y]) => new THREE.Vector3(x, y, interpolateZ(x, y))),
    );
    const lonelyStars = extraStars.map(([x, y]) => new THREE.Vector3(x, y, interpolateZ(x, y)));
    // fills are triangulated on the exact same 3D vertices as the stars/lines,
    // so they stay glued to the outline while the constellation sways
    const fill = (points3: THREE.Vector3[], points2: [number, number][]) => {
      const triangles = THREE.ShapeUtils.triangulateShape(
        points2.map(([x, y]) => new THREE.Vector2(x, y)),
        [],
      );
      const geo = new THREE.BufferGeometry().setFromPoints(points3);
      geo.setIndex(triangles.flat());
      return geo;
    };
    return {
      starsGeometry: new THREE.BufferGeometry().setFromPoints([
        ...perElement.flat(),
        ...lonelyStars,
      ]),
      lineGeometries: perElement.map((points, index) =>
        toSegments(points, elements[index].closed !== false),
      ),
      fillGeometries: perElement.map((points, index) =>
        elements[index].fill ? fill(points, elements[index].points) : null,
      ),
    };
  }, [elements, extraStars, outline.points, salt]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    if (hovered && !nearJourneyEnd()) setHovered(false);
    if (touch && hovered && touchSelection.label !== label) setHovered(false);
    const t = clock.elapsedTime + phase;
    // slow drift across the lower part of the view, like a wandering constellation
    group.current.position.set(
      position[0] + Math.sin(t * 0.11) * wander,
      position[1] + Math.sin(t * 0.17 + 2) * 0.25,
      position[2] + Math.sin(t * 0.07 + 4) * 0.8 * wander,
    );
    group.current.rotation.z = Math.sin(t * 0.13) * 0.08;
    // gentle sway around Y so the parallax reveals the stars' depth
    group.current.rotation.y = Math.sin(t * 0.21) * 0.22;

    const targetScale = baseScale * (hovered ? 1.25 : 1);
    group.current.scale.setScalar(
      THREE.MathUtils.damp(group.current.scale.x, targetScale, 6, delta),
    );
    // fade in as the journey approaches the contact section, so the logos don't
    // clutter the background of the previous sections
    const visibility = THREE.MathUtils.smoothstep(scrollState.progress, 0.68, 0.92);
    const twinkle = 0.75 + Math.sin(t * 2.1) * 0.15;
    if (starsMaterial.current) starsMaterial.current.opacity = (hovered ? 1 : twinkle) * visibility;
    elements.forEach((element, index) => {
      const line = lineMaterials.current[index];
      if (line) {
        line.opacity = THREE.MathUtils.damp(
          line.opacity,
          (hovered ? element.hover : element.idle) * visibility,
          6,
          delta,
        );
      }
      const fillMaterial = fillMaterials.current[index];
      if (fillMaterial) {
        fillMaterial.opacity = THREE.MathUtils.damp(
          fillMaterial.opacity,
          (hovered ? (element.fillHover ?? 0) : 0) * visibility,
          6,
          delta,
        );
      }
    });
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={(e) => {
        if (touch || !nearJourneyEnd()) return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        // on touch the pointer "leaves" as soon as the finger lifts — the reveal
        // must survive until the second tap, so only mouse pointers collapse it
        if (!touch) setHovered(false);
      }}
      onClick={(e) => {
        if (!nearJourneyEnd()) return;
        e.stopPropagation();
        // on touch, the first tap lights the constellation up, the second opens it
        if (touch && !hovered) {
          touchSelection.label = label;
          setHovered(true);
          return;
        }
        if (href.startsWith('mailto:')) window.location.href = href;
        else window.open(href, '_blank', 'noopener');
      }}
    >
      {/* oversized invisible hitbox, same trick as the planets */}
      <mesh>
        <sphereGeometry args={[1.1, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <points geometry={starsGeometry}>
        <pointsMaterial
          ref={starsMaterial}
          size={0.09}
          color="#ffffff"
          transparent
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {elements.map((element, index) => (
        <lineSegments key={index} geometry={lineGeometries[index]}>
          <lineBasicMaterial
            ref={(material) => {
              lineMaterials.current[index] = material;
            }}
            color={element.color}
            transparent
            opacity={element.idle}
          />
        </lineSegments>
      ))}
      {elements.map((element, index) =>
        fillGeometries[index] ? (
          <mesh key={index} geometry={fillGeometries[index]}>
            <meshBasicMaterial
              ref={(material) => {
                fillMaterials.current[index] = material;
              }}
              color={element.fill}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={element.fillAdditive ? THREE.AdditiveBlending : THREE.NormalBlending}
            />
          </mesh>
        ) : null,
      )}
      {hovered && (
        <Html position={[0, -1, 0]} center style={{ pointerEvents: 'none' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              color: '#9be7ff',
              textShadow: '0 0 12px #22d3ee',
            }}
          >
            {label}
          </span>
        </Html>
      )}
    </group>
  );
};

// One cluster of shapes per section, placed deeper and deeper along -Z.
const CLUSTERS: NeonShapeProps[][] = [
  // 0 — hero (kept wide so they never overlap the centered title). The armillary opens the
  // journey: of the four it is the one that reads as "astronomy" rather than "a planet",
  // which is the right note before the corridor has shown anything of its own.
  // Pushed wider than the solids they replace: a hooped sphere and a ringed world are two
  // to three times the silhouette of an icosahedron at the same scale, and at the old x the
  // ring cut straight through "Bonvin".
  [
    { position: [-8.5, 3.2, -5], color: NEON.violet, kind: 'armillary', scale: 1.3 },
    { position: [9.5, 3.4, -7], color: NEON.cyan, kind: 'ringedWorld', scale: 1.1 },
    { position: [-7.5, 6, -11], color: NEON.pink, kind: 'comet', scale: 0.85 },
  ],
  // 1 — à propos (planet on the right, so a moon on the left answers it)
  [{ position: [-4, 4.5, -21], color: NEON.pink, kind: 'orbit', scale: 0.95 }],
  // 2 — expérience (black hole on the left)
  [{ position: [7, 5.5, -36], color: NEON.cyan, kind: 'armillary', scale: 0.9 }],
  // 3 — projets (pulsar on the right)
  [{ position: [-4, 4.5, -49], color: NEON.violet, kind: 'ringedWorld', scale: 0.95 }],
  // 4 — contact (kept away from the centered text)
  [
    { position: [-7.5, 2.5, -60], color: NEON.cyan, kind: 'orbit', scale: 1.15 },
    { position: [-4.5, 1, -62], color: NEON.pink, kind: 'comet', scale: 0.9 },
    { position: [6.5, 3, -63], color: NEON.violet, kind: 'armillary', scale: 0.9 },
  ],
];

// Ephemeral shooting star launched by clicking on empty space.
type CometShot = { id: number; start: THREE.Vector3; dir: THREE.Vector3; color: string };

const ClickComet = ({ shot, onDone }: { shot: CometShot; onDone: (id: number) => void }) => {
  const head = useRef<THREE.Mesh>(null);
  const life = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    life.current += delta;
    head.current?.position.copy(shot.start).addScaledVector(shot.dir, life.current * 16);
    if (life.current > 1.5 && !done.current) {
      done.current = true;
      onDone(shot.id);
    }
  });

  return (
    <Trail width={1.6} length={6} color={shot.color} attenuation={(w) => w * w}>
      <mesh ref={head} position={shot.start}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#000" emissive="#ffffff" emissiveIntensity={6} />
      </mesh>
    </Trail>
  );
};

// Exposes the R3F camera to the launch handler living outside the Canvas.
const CaptureCamera = ({ cameraRef }: { cameraRef: RefObject<THREE.Camera | null> }) => {
  const camera = useThree((state) => state.camera);
  cameraRef.current = camera;
  return null;
};

const COMET_COLORS = [NEON.cyan, NEON.pink, NEON.violet];

export const PortfolioScene = () => {
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [shots, setShots] = useState<CometShot[]>([]);
  const nextId = useRef(0);
  const aspect = useAspect();
  // must match the DOM's spacer sections (useIsMobile), or the camera pauses on nothing
  const portrait = useIsMobile();
  const xFactor = Math.min(1, Math.max(0.42, aspect / 1.6));

  // Fired by R3F only when a click hits no 3D object.
  const launchComet = (event: MouseEvent) => {
    // tapping empty space releases the lit constellation
    touchSelection.label = null;
    const camera = cameraRef.current;
    if (!camera) return;
    const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;
    const target = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = target.sub(camera.position).normalize();
    const start = camera.position.clone().addScaledVector(dir, 6);
    // each comet shoots off in a random direction from the click point,
    // with a gentle deviation so it never veers too far off
    const angle = Math.random() * Math.PI * 2;
    const strength = 0.15 + Math.random() * 0.25;
    dir.x += Math.cos(angle) * strength;
    dir.y += Math.sin(angle) * strength * 0.6;
    dir.normalize();
    const id = nextId.current++;
    setShots((prev) => [...prev.slice(-3), { id, start, dir, color: COMET_COLORS[id % 3] }]);
  };

  return (
  <div className="fixed inset-0 -z-0">
    <Canvas
      camera={{ position: [0, 1.4, 8], fov: 60 }}
      // mobile: dpr 1 is too pixelated, native dpr too heavy with bloom — cap at 1.5
      dpr={portrait ? Math.min(1.5, window.devicePixelRatio) : [1, 1.25]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={launchComet}
    >
      <CaptureCamera cameraRef={cameraRef} />
      <fog attach="fog" args={['#050510', FOG_NEAR, HERO_FOG_FAR]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 6, 0]} intensity={30} color={NEON.violet} />

      <CameraRig />
      <TrackHints portrait={portrait} />
      <FogDrive />

      {/* the wireframe clutter is desktop-only: on a phone it crowds a frame that is
          already carrying an astre, the section title and a panel of body text */}
      {!portrait &&
        CLUSTERS.flat().map((shape, index) => (
          <NeonShape
            key={index}
            {...shape}
            position={[shape.position[0] * xFactor, shape.position[1], shape.position[2]]}
          />
        ))}

      {/* Same fixed world positions on both: the astres sit on the corridor from the
          first frame and the camera drifts past them, so each one is on screen — far,
          then close — well before its section arrives. Portrait only pulls them toward
          the middle of the corridor, since a phone frame is a third as wide and would
          otherwise never catch them. Depths are shared, so the pacing is identical. */}
      <Planet
        position={astrePosition('planet', portrait)}
        scale={astreScale('planet', portrait)}
        mobile={portrait}
      />
      {/* portrait y/x put the camera track inside the accretion disc, so scrolling
          past means passing through it — the same close pass the planet's rings give */}
      <BlackHole
        position={astrePosition('blackHole', portrait)}
        scale={astreScale('blackHole', portrait)}
        mobile={portrait}
      />
      {/* likewise the remnant shell: the track runs through the ejecta */}
      <Pulsar
        position={astrePosition('pulsar', portrait)}
        // still smaller than its siblings on mobile: it is the only astre that is a
        // light source, and close up a full-size one hazes the frame through the
        // bloom pass, taking the body text's contrast with it
        scale={astreScale('pulsar', portrait)}
        mobile={portrait}
      />
      {/* portrait: pushed back so the finale is a destination rather than the
          pulsar's next-door neighbour — but not so far that the fog eats it */}
      <Galaxy position={portrait ? [0, 6, -69] : [0, 6, -66]} count={portrait ? 2200 : 4000} />
      {CONTACT_LOGOS.map((logo) => (
        <Constellation
          key={logo.label}
          {...logo}
          position={portrait ? logo.mobilePosition : logo.position}
          wander={portrait ? 0.15 : 1.4}
          baseScale={portrait ? 0.8 : 1}
        />
      ))}

      <Asteroids xFactor={xFactor} count={portrait ? 24 : 40} />
      <WarpLines />
      <Comet color="#22d3ee" speed={0.35} phase={0} altitude={4} xAmp={16 * xFactor} />
      <Comet color="#f472b6" speed={0.25} phase={Math.PI} altitude={6} xAmp={16 * xFactor} />

      {shots.map((shot) => (
        <ClickComet
          key={shot.id}
          shot={shot}
          onDone={(id) => setShots((prev) => prev.filter((s) => s.id !== id))}
        />
      ))}

      <Grid
        position={[0, -1.5, -30]}
        args={[120, 120]}
        cellSize={1.5}
        cellColor="#1e1b3a"
        sectionSize={7.5}
        sectionColor="#4c1d95"
        fadeDistance={45}
        infiniteGrid
      />

      <Stars radius={80} depth={60} count={portrait ? 900 : 2500} factor={4} fade speed={0.6} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.1} luminanceThreshold={0.15} mipmapBlur />
      </EffectComposer>
    </Canvas>
  </div>
  );
};
