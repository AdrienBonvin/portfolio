import { useEffect, useRef } from 'react';
import { isTouchDevice } from './scrollState';

// Neon cursor companion: a bright dot riding the native cursor plus a lagging halo.
// Both grow when hovering something clickable (HTML links or 3D objects). Desktop only.
export const CursorGlow = () => {
  const glow = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const touch = isTouchDevice();

  useEffect(() => {
    if (touch) return;
    const pos = { x: -300, y: -300 };
    const target = { x: -300, y: -300 };
    let overHtmlInteractive = false;
    let scale = 1;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      overHtmlInteractive = e.target instanceof Element && e.target.closest('a, button') !== null;
    };

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.1;
      pos.y += (target.y - pos.y) * 0.1;
      // 3D objects set a pointer cursor on <body> via drei's useCursor
      const active = overHtmlInteractive || document.body.style.cursor === 'pointer';
      scale += ((active ? 2.1 : 1) - scale) * 0.18;
      if (glow.current) {
        glow.current.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(${1 + (scale - 1) * 0.4})`;
        glow.current.style.opacity = active ? '0.55' : '0.35';
      }
      if (dot.current) {
        dot.current.style.transform = `translate(${target.x}px, ${target.y}px) translate(-50%, -50%) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [touch]);

  if (touch) return null;

  return (
    <>
      <div
        ref={glow}
        className="pointer-events-none fixed top-0 left-0 z-20 hidden size-48 rounded-full mix-blend-screen blur-3xl md:block"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, #22d3ee 40%, transparent 70%)', opacity: 0.35 }}
      />
      <div
        ref={dot}
        className="pointer-events-none fixed top-0 left-0 z-30 hidden size-2.5 rounded-full bg-neon-cyan shadow-[0_0_12px_#22d3ee] md:block"
      />
    </>
  );
};
