import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Grid, Html, Stars, Trail, useCursor } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { isTouchDevice, scrollState } from '../scrollState';
import { useIsMobile } from '../useIsMobile';
import { LINKS } from '../i18n';

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

export const SECTION_COUNT = 5;
const SECTION_DEPTH = 14;

const NEON = {
  violet: '#a855f7',
  cyan: '#22d3ee',
  pink: '#f472b6',
};

// World position of the big object currently hovered (planet, black hole, supernova).
// The camera gently leans toward it, like leaning in to look closer.
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
    const targetZ = 8 - scrollState.progress * SECTION_DEPTH * (SECTION_COUNT - 1);
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

type NeonShapeProps = {
  position: [number, number, number];
  color: string;
  kind: 'icosahedron' | 'torus' | 'torusKnot' | 'octahedron';
  scale?: number;
  spin?: number;
};

const COLOR_CYCLE = [NEON.violet, NEON.cyan, NEON.pink];

const NeonShape = ({ position, color, kind, scale = 1, spin = 0.3 }: NeonShapeProps) => {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  // extra rotation speed added on click, decays back to 0 each frame
  const spinBoost = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [currentColor, setCurrentColor] = useState(color);
  useCursor(hovered);

  useFrame((_, delta) => {
    if (!mesh.current || !material.current) return;
    mesh.current.rotation.x += delta * (spin + spinBoost.current);
    mesh.current.rotation.y += delta * (spin * 0.7 + spinBoost.current);
    spinBoost.current = THREE.MathUtils.damp(spinBoost.current, 0, 1.2, delta);

    const targetScale = hovered ? scale * 1.3 : scale;
    mesh.current.scale.setScalar(THREE.MathUtils.damp(mesh.current.scale.x, targetScale, 6, delta));
    material.current.emissiveIntensity = THREE.MathUtils.damp(
      material.current.emissiveIntensity,
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
      <mesh
        ref={mesh}
        position={position}
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={cycleColor}
      >
        {kind === 'icosahedron' && <icosahedronGeometry args={[1, 0]} />}
        {kind === 'torus' && <torusGeometry args={[1, 0.35, 16, 48]} />}
        {kind === 'torusKnot' && <torusKnotGeometry args={[0.8, 0.25, 96, 16]} />}
        {kind === 'octahedron' && <octahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial
          ref={material}
          color="#0a0a18"
          emissive={currentColor}
          emissiveIntensity={1.6}
          wireframe
        />
      </mesh>
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

// The hover hitbox around each astre is deliberately oversized on desktop, so the
// camera can lean in without the pointer ever falling off. A phone frame is much
// narrower, so the same sphere covers the screen as the camera draws level with the
// astre and swallows every tap meant for empty space — there it hugs the object.
const hitbox = (desktop: number, mobile: number, isMobile?: boolean) =>
  isMobile ? mobile : desktop;

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
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    float radius = length(position.xz);
    float angle = uTime * aSpeed;
    float c = cos(angle);
    float s = sin(angle);
    vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);

    // a gaussian crest sweeping outward through the band. It starts at the inner
    // edge, not at the planet's centre, and only fades once it has cleared the ring
    float front = 1.9 + uShock * 2.85;
    float offset = radius - front;
    float wave = exp(-offset * offset * 6.0) * (1.0 - smoothstep(0.3, 0.9, uShock));
    p.xz *= 1.0 + wave * 0.26;
    p.y += wave * 0.55;

    vColor = aColor;
    vGlow = wave;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // capped: the mobile flyby passes far closer than the desktop track, and
    // uncapped grains balloon into confetti that no longer reads as a ring
    gl_PointSize = min(aSize * (1.0 + wave * 2.4) * uScale / max(0.001, -mv.z), 11.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const RING_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d2 = dot(uv, uv);
    if (d2 > 0.25) discard;
    gl_FragColor = vec4(vColor * (1.0 + vGlow * 2.2), smoothstep(0.25, 0.02, d2));
  }
`;

// Rim light. A flat back-side sphere gives an even wash; weighting by the viewing
// angle puts the glow on the limb, where an atmosphere actually shows.
const GLOW_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vUv = uv;
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMOSPHERE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.4);
    gl_FragColor = vec4(uColor * rim * uIntensity * 1.6, rim * uIntensity);
  }
`;

// Latitude bands over the lit core: gas-giant structure, drawn graphically rather
// than with noise so it stays in the same register as the rest of the scene.
const BANDS_FRAG = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;

  void main() {
    float lat = vUv.y;
    float bands = sin(lat * 58.0 + sin(lat * 9.0) * 2.6) * 0.5 + 0.5;
    bands = pow(bands, 2.2);
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.0);
    vec3 tint = mix(vec3(0.35, 0.12, 0.78), vec3(0.96, 0.45, 0.85), lat);
    float a = (bands * 0.42 + rim * 0.34) * uIntensity;
    gl_FragColor = vec4(tint * a, a);
  }
`;

// Deterministic grain cloud: colour banded by radius, a clean gap, and Keplerian
// speeds so inner grains outrun outer ones.
const useRingGeometry = (count: number) =>
  useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const inner = new THREE.Color(NEON.cyan);
    const mid = new THREE.Color(NEON.violet);
    const outer = new THREE.Color(NEON.pink);
    const shade = new THREE.Color();

    for (let i = 0; i < count; i++) {
      let radius = RING_INNER + rand01(i, 70) * (RING_OUTER - RING_INNER);
      // push anything landing in the division onto one of its edges
      if (radius > RING_GAP[0] && radius < RING_GAP[1]) {
        radius = radius < (RING_GAP[0] + RING_GAP[1]) / 2 ? RING_GAP[0] : RING_GAP[1];
      }
      const angle = rand01(i, 71) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (rand01(i, 72) - 0.5) * 0.08; // the band is paper-thin
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      speeds[i] = 0.5 * (RING_INNER / radius) ** 1.5 * (0.9 + rand01(i, 73) * 0.2);

      const k = (radius - RING_INNER) / (RING_OUTER - RING_INNER);
      shade.copy(inner).lerp(mid, Math.min(1, k * 2));
      if (k > 0.5) shade.copy(mid).lerp(outer, (k - 0.5) * 2);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;

      sizes[i] = 0.045 + rand01(i, 74) * 0.055;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [count]);

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
  useCursor(hovered);

  const ringGeometry = useRingGeometry(mobile ? 2200 : 2800);
  const ringUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uShock: { value: -1 }, uScale: { value: 600 } }),
    [],
  );
  const atmosphereUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color('#8b5cf6') }, uIntensity: { value: 1 } }),
    [],
  );
  const bandUniforms = useMemo(() => ({ uIntensity: { value: 1 } }), []);
  const haloUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color('#a5f3fc') }, uIntensity: { value: 0 } }),
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
      // gl_PointSize is in device pixels, so the grains have to be re-scaled
      // whenever the drawing buffer or the warp effect's field of view changes
      const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 60;
      ringMaterial.current.uniforms.uScale.value =
        (size.height * viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
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

  const detonate = () => {
    shock.current = 0;
    flash.current = 1;
    ringBoost.current += 9;
    moonBoost.current += 6;
  };

  return (
    <group position={position} scale={scale}>
      <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.5}>
      <group ref={planet} rotation={[0.35, 0, -0.15]}>
        {/* invisible hitbox: keeps the hover alive while the camera leans in */}
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            if (!isTouchDevice()) focusState.target = new THREE.Vector3(...position);
          }}
          onPointerOut={() => {
            setHovered(false);
            focusState.target = null;
          }}
          onClick={(e) => {
            e.stopPropagation();
            detonate();
          }}
        >
          <sphereGeometry args={[hitbox(4, 2.8, mobile), 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
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

// Black hole with a spinning accretion disk — companion of "Expérience".
// Click: it swallows a swirl of matter spiraling into the event horizon.
const SUCK_COUNT = 110;

const BlackHole = ({ position, scale = 1, mobile }: CelestialProps) => {
  const disk = useRef<THREE.Group>(null);
  const swirl = useRef<THREE.Points>(null);
  // -1 = idle, otherwise progress of the suck animation in [0, ~1.5]
  const suckT = useRef(-1);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const seeds = useMemo(
    () =>
      Array.from({ length: SUCK_COUNT }, (_, i) => ({
        angle: rand01(i, 20) * Math.PI * 2,
        radius: 2.5 + rand01(i, 21) * 3.5,
        speed: 0.7 + rand01(i, 22) * 0.7,
        y: (rand01(i, 23) - 0.5) * 3,
      })),
    [],
  );

  const swirlGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SUCK_COUNT * 3), 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (disk.current) disk.current.rotation.z += delta * (suckT.current >= 0 ? 4 : 0.8);
    if (!swirl.current) return;
    swirl.current.visible = suckT.current >= 0;
    if (suckT.current < 0) return;

    suckT.current += delta / 1.6;
    const positions = swirl.current.geometry.getAttribute('position');
    seeds.forEach((seed, i) => {
      const t = Math.min(1, suckT.current * seed.speed);
      const radius = seed.radius * (1 - t) ** 1.5;
      const angle = seed.angle + t * 7;
      positions.setXYZ(i, Math.cos(angle) * radius, seed.y * (1 - t), Math.sin(angle) * radius);
    });
    positions.needsUpdate = true;
    if (suckT.current > 1.5) suckT.current = -1;
  });

  return (
    <group position={position} scale={scale}>
      <group rotation={[0.9, 0.15, 0]}>
      {/* invisible hitbox: keeps the hover alive while the camera leans in */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (!isTouchDevice()) focusState.target = new THREE.Vector3(...position);
        }}
        onPointerOut={() => {
          setHovered(false);
          focusState.target = null;
        }}
        onClick={(e) => {
          e.stopPropagation();
          suckT.current = 0;
        }}
      >
        <sphereGeometry args={[hitbox(3.2, 2.2, mobile), 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <points ref={swirl} visible={false} geometry={swirlGeometry}>
        <pointsMaterial
          size={0.08}
          color="#f472b6"
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* photon ring hugging the event horizon */}
      <mesh>
        <torusGeometry args={[1.12, 0.03, 12, 80]} />
        <meshStandardMaterial color="#000" emissive="#ffffff" emissiveIntensity={4} />
      </mesh>
      <group ref={disk}>
        <mesh>
          <torusGeometry args={[1.8, 0.16, 10, 80]} />
          <meshStandardMaterial color="#000" emissive="#f472b6" emissiveIntensity={2.5} wireframe />
        </mesh>
        <mesh>
          <torusGeometry args={[2.5, 0.1, 8, 80]} />
          <meshStandardMaterial color="#000" emissive="#a855f7" emissiveIntensity={1.8} wireframe />
        </mesh>
      </group>
      </group>
    </group>
  );
};

// Pulsing supernova — companion of "Projets". Click: it explodes in a particle burst.
const BURST_COUNT = 150;

const Supernova = ({ position, scale = 1, mobile }: CelestialProps) => {
  const core = useRef<THREE.Mesh>(null);
  const coreMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const shockwave = useRef<THREE.Mesh>(null);
  const burst = useRef<THREE.Points>(null);
  const burstMaterial = useRef<THREE.PointsMaterial>(null);
  // -1 = idle, otherwise progress of the explosion in [0, 1]
  const burstT = useRef(-1);
  const flash = useRef(0);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const seeds = useMemo(
    () =>
      Array.from({ length: BURST_COUNT }, (_, i) => {
        const theta = rand01(i, 30) * Math.PI * 2;
        const phi = Math.acos(rand01(i, 31) * 2 - 1);
        return {
          dir: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta),
          ),
          speed: 3 + rand01(i, 32) * 5,
        };
      }),
    [],
  );

  const burstGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_COUNT * 3), 3));
    return geo;
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    flash.current = THREE.MathUtils.damp(flash.current, 0, 2.5, delta);
    if (core.current) {
      core.current.scale.setScalar((1 + Math.sin(t * 2.5) * 0.18) * (1 + flash.current * 0.8));
    }
    if (coreMaterial.current) coreMaterial.current.emissiveIntensity = 5 + flash.current * 12;
    if (shockwave.current) {
      shockwave.current.rotation.y += delta * 0.25;
      shockwave.current.scale.setScalar(1 + ((t * 0.35) % 1) * 0.6);
    }

    if (!burst.current) return;
    burst.current.visible = burstT.current >= 0;
    if (burstT.current < 0) return;

    burstT.current += delta / 1.6;
    const ease = burstT.current * (2 - burstT.current);
    const positions = burst.current.geometry.getAttribute('position');
    seeds.forEach((seed, i) => {
      positions.setXYZ(
        i,
        seed.dir.x * seed.speed * ease,
        seed.dir.y * seed.speed * ease,
        seed.dir.z * seed.speed * ease,
      );
    });
    positions.needsUpdate = true;
    if (burstMaterial.current) burstMaterial.current.opacity = Math.max(0, 1 - burstT.current);
    if (burstT.current > 1) burstT.current = -1;
  });

  return (
    <group position={position} scale={scale}>
      {/* invisible hitbox: keeps the hover alive while the camera leans in */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (!isTouchDevice()) focusState.target = new THREE.Vector3(...position);
        }}
        onPointerOut={() => {
          setHovered(false);
          focusState.target = null;
        }}
        onClick={(e) => {
          e.stopPropagation();
          burstT.current = 0;
          flash.current = 1;
        }}
      >
        <sphereGeometry args={[hitbox(2.6, 1.8, mobile), 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial ref={coreMaterial} color="#000" emissive="#ffffff" emissiveIntensity={5} />
      </mesh>
      <mesh ref={shockwave}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial
          color="#000"
          emissive="#f472b6"
          emissiveIntensity={1.6}
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>
      <points ref={burst} visible={false} geometry={burstGeometry}>
        <pointsMaterial
          ref={burstMaterial}
          size={0.09}
          color="#ffd6ec"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* on a phone the camera passes much closer to this than the framing suggests,
          and the full desktop intensity washes the screen pink through the bloom pass */}
      <pointLight intensity={mobile ? 12 : 25} color="#f472b6" distance={14} />
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
  mobilePosition: [number, number, number]; // 2×2 grid on portrait screens
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
    mobilePosition: [-1.15, -1.4, -57.5],
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
    mobilePosition: [1.15, -1.4, -56.8],
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
    mobilePosition: [-1.15, -3, -57.2],
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
    mobilePosition: [1.15, -3, -56.5],
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
  // 0 — hero (kept wide so they never overlap the centered title)
  [
    { position: [-6.5, 3, -5], color: NEON.violet, kind: 'icosahedron', scale: 1.4 },
    { position: [7, 2.5, -7], color: NEON.cyan, kind: 'torusKnot', scale: 1.1 },
    { position: [-5, 5.5, -10], color: NEON.pink, kind: 'octahedron', scale: 0.8 },
  ],
  // 1 — à propos (planet on the right)
  [{ position: [-4, 4.5, -21], color: NEON.pink, kind: 'torus', scale: 0.9 }],
  // 2 — expérience (black hole on the left)
  [{ position: [7, 5.5, -36], color: NEON.cyan, kind: 'octahedron', scale: 0.9 }],
  // 3 — projets (supernova on the right)
  [{ position: [-4, 4.5, -49], color: NEON.violet, kind: 'torus', scale: 0.9 }],
  // 4 — contact (kept away from the centered text)
  [
    { position: [-7.5, 2.5, -60], color: NEON.cyan, kind: 'torusKnot', scale: 1.2 },
    { position: [-4.5, 1, -62], color: NEON.pink, kind: 'octahedron', scale: 0.9 },
    { position: [6.5, 3, -63], color: NEON.violet, kind: 'icosahedron', scale: 0.9 },
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
      <fog attach="fog" args={['#050510', 8, 42]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 6, 0]} intensity={30} color={NEON.violet} />

      <CameraRig />

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
        position={portrait ? [1.8, 1.8, -20] : [5.5, 2, -20]}
        scale={portrait ? 0.85 : 1}
        mobile={portrait}
      />
      <BlackHole
        position={portrait ? [-2.4, 3.8, -35] : [-8, 4, -35]}
        scale={portrait ? 0.85 : 1}
        mobile={portrait}
      />
      <Supernova
        position={portrait ? [2.2, 2.4, -48] : [12, 3.5, -48]}
        // smaller than its siblings on mobile: it is the only astre that is a light
        // source, and close up a full-size one hazes the whole frame through the
        // bloom pass, taking the body text's contrast with it
        scale={portrait ? 0.62 : 1}
        mobile={portrait}
      />
      <Galaxy position={[0, 6, -66]} count={portrait ? 2200 : 4000} />
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
