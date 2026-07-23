import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
    const onResize = () => setAspect(window.innerWidth / Math.max(1, window.innerHeight));
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
    const warpTarget = THREE.MathUtils.clamp((velocity - 1200) / 3300, 0, 1);
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

// Small rocks scattered along the whole camera path.
type Rock = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

const Asteroids = ({ xFactor }: { xFactor: number }) => {
  const rocks = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i): Rock => {
        const side = rand01(i, 1) > 0.5 ? 1 : -1;
        return {
          position: [
            side * (2.5 + rand01(i, 2) * 12) * xFactor,
            rand01(i, 3) * 9 - 1,
            4 - rand01(i, 4) * 72,
          ],
          rotation: [rand01(i, 5) * Math.PI, rand01(i, 6) * Math.PI, 0],
          scale: 0.12 + rand01(i, 7) * 0.3,
        };
      }),
    [xFactor],
  );

  return (
    <>
      {rocks.map((rock, i) => (
        <mesh key={i} position={rock.position} rotation={rock.rotation} scale={rock.scale}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#1a1830" emissive="#8b8ba7" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </>
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
const Galaxy = ({ position }: { position: [number, number, number] }) => {
  const points = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const count = 4000;
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
  }, []);

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

// fadeWindow (mobile): [inStart, inEnd, outStart, outEnd] in journey progress.
// The object is hidden while its section's text is on screen, grows in as the
// spacer screen approaches, then shrinks away before the camera plows through it.
type CelestialProps = {
  position: [number, number, number];
  scale?: number;
  fadeWindow?: [number, number, number, number];
};

const fadeFactor = (fadeWindow?: [number, number, number, number]) => {
  if (!fadeWindow) return 1;
  const progress = scrollState.progress;
  return (
    THREE.MathUtils.smoothstep(progress, fadeWindow[0], fadeWindow[1]) *
    (1 - THREE.MathUtils.smoothstep(progress, fadeWindow[2], fadeWindow[3]))
  );
};

// Ringed planet — companion of the "À propos" section. Click: the rings spin wildly.
const Planet = ({ position, scale = 1, fadeWindow }: CelestialProps) => {
  const planet = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const moonOrbit = useRef<THREE.Group>(null);
  const ringBoost = useRef(0);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame((_, delta) => {
    if (planet.current) {
      planet.current.rotation.y += delta * 0.15;
      const fade = fadeFactor(fadeWindow);
      planet.current.scale.setScalar(scale * fade);
      planet.current.visible = fade > 0.02;
    }
    if (rings.current) rings.current.rotation.z += delta * (0.1 + ringBoost.current);
    if (moonOrbit.current) moonOrbit.current.rotation.y += delta * 0.45;
    ringBoost.current = THREE.MathUtils.damp(ringBoost.current, 0, 1.2, delta);
  });

  return (
    <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.5}>
      <group ref={planet} position={position} rotation={[0.35, 0, -0.15]} scale={scale}>
        {/* oversized invisible hitbox: keeps the hover alive while the camera leans in */}
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
            ringBoost.current += 14;
          }}
        >
          <sphereGeometry args={[4, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* core */}
        <mesh>
          <sphereGeometry args={[1.7, 48, 48]} />
          <meshStandardMaterial color="#1b1140" emissive="#7c3aed" emissiveIntensity={0.45} roughness={0.35} />
        </mesh>
        {/* surface graticule */}
        <mesh scale={1.01}>
          <sphereGeometry args={[1.7, 24, 16]} />
          <meshStandardMaterial
            color="#0a0a18"
            emissive="#c084fc"
            emissiveIntensity={0.8}
            wireframe
            transparent
            opacity={0.25}
          />
        </mesh>
        {/* atmosphere glow */}
        <mesh scale={1.18}>
          <sphereGeometry args={[1.7, 32, 32]} />
          <meshBasicMaterial
            color="#a855f7"
            transparent
            opacity={0.14}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* double ring system */}
        <group ref={rings} rotation={[Math.PI / 2.15, 0, 0]}>
          <mesh>
            <ringGeometry args={[2.2, 2.9, 80]} />
            <meshStandardMaterial
              color="#0a0a18"
              emissive="#22d3ee"
              emissiveIntensity={1.3}
              side={THREE.DoubleSide}
              transparent
              opacity={0.7}
              wireframe
            />
          </mesh>
          <mesh>
            <ringGeometry args={[3.05, 3.45, 80]} />
            <meshStandardMaterial
              color="#0a0a18"
              emissive="#f472b6"
              emissiveIntensity={1}
              side={THREE.DoubleSide}
              transparent
              opacity={0.35}
              wireframe
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
  );
};

// Black hole with a spinning accretion disk — companion of "Expérience".
// Click: it swallows a swirl of matter spiraling into the event horizon.
const SUCK_COUNT = 110;

const BlackHole = ({ position, scale = 1, fadeWindow }: CelestialProps) => {
  const root = useRef<THREE.Group>(null);
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
    if (root.current) {
      const fade = fadeFactor(fadeWindow);
      root.current.scale.setScalar(scale * fade);
      root.current.visible = fade > 0.02;
    }
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
    <group ref={root} position={position} rotation={[0.9, 0.15, 0]} scale={scale}>
      {/* oversized invisible hitbox: keeps the hover alive while the camera leans in */}
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
        <sphereGeometry args={[3.2, 16, 16]} />
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
  );
};

// Pulsing supernova — companion of "Projets". Click: it explodes in a particle burst.
const BURST_COUNT = 150;

const Supernova = ({ position, scale = 1, fadeWindow }: CelestialProps) => {
  const root = useRef<THREE.Group>(null);
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
    if (root.current) {
      const fade = fadeFactor(fadeWindow);
      root.current.scale.setScalar(scale * fade);
      root.current.visible = fade > 0.02;
    }
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
    <group ref={root} position={position} scale={scale}>
      {/* oversized invisible hitbox: keeps the hover alive while the camera leans in */}
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
        <sphereGeometry args={[2.6, 16, 16]} />
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
      <pointLight intensity={25} color="#f472b6" distance={14} />
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
};

const CONTACT_LOGOS: ConstellationLogo[] = [
  {
    label: 'Email',
    href: LINKS.email,
    salt: 60,
    position: [-6.3, -2.1, -57.5],
    mobilePosition: [-1.3, -1.4, -57.5],
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
    mobilePosition: [1.3, -1.4, -56.8],
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
    mobilePosition: [-1.3, -3, -57.2],
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
    mobilePosition: [1.3, -3, -56.5],
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

const Constellation = ({ label, href, salt, outline, inner = [], extraStars = [], position, phase, wander = 1.4 }: Omit<ConstellationLogo, 'mobilePosition'>) => {
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

    const targetScale = hovered ? 1.25 : 1;
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
      dpr={[1, 1.25]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={launchComet}
    >
      <CaptureCamera cameraRef={cameraRef} />
      <fog attach="fog" args={['#050510', 8, 42]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 6, 0]} intensity={30} color={NEON.violet} />

      <CameraRig />

      {CLUSTERS.flat().map((shape, index) => (
        <NeonShape
          key={index}
          {...shape}
          position={[
            shape.position[0] * xFactor,
            // portrait: shapes ride higher and smaller to stay off the text
            shape.position[1] + (portrait ? 1 : 0),
            shape.position[2],
          ]}
          scale={shape.scale ? shape.scale * (portrait ? 0.7 : 1) : undefined}
        />
      ))}

      {/* mobile: each object is staged full-frame on its spacer screen (camera stops
          at z = 8 - progress·56, spacers at stops 2/7, 4/7 and 6/7 → z -8, -24, -40),
          then shrinks away before the camera reaches the next section */}
      <Planet
        position={portrait ? [0.4, 1.4, -17] : [5.5, 2, -20]}
        scale={portrait ? 0.85 : 1}
        fadeWindow={portrait ? [0.19, 0.27, 0.31, 0.41] : undefined}
      />
      <BlackHole
        position={portrait ? [-0.4, 1.4, -33] : [-8, 4, -35]}
        scale={portrait ? 0.8 : 1}
        fadeWindow={portrait ? [0.47, 0.55, 0.6, 0.7] : undefined}
      />
      <Supernova
        position={portrait ? [0.4, 1.5, -49] : [12, 3.5, -48]}
        scale={portrait ? 0.8 : 1}
        fadeWindow={portrait ? [0.76, 0.84, 0.88, 0.96] : undefined}
      />
      <Galaxy position={[0, 6, -66]} />
      {CONTACT_LOGOS.map((logo) => (
        <Constellation
          key={logo.label}
          {...logo}
          position={portrait ? logo.mobilePosition : logo.position}
          wander={portrait ? 0.35 : 1.4}
        />
      ))}

      <Asteroids xFactor={xFactor} />
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

      <Stars radius={80} depth={60} count={portrait ? 1500 : 2500} factor={4} fade speed={0.6} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.1} luminanceThreshold={0.15} mipmapBlur />
      </EffectComposer>
    </Canvas>
  </div>
  );
};
