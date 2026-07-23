import { useEffect, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { journeyProgress, sectionTops } from './scrollState';
import { useIsMobile } from './useIsMobile';

type Stop = { color: string; icon: ReactNode };

const STOPS: Stop[] = [
  {
    color: '#22d3ee',
    icon: <circle cx="10" cy="10" r="3.5" fill="currentColor" />,
  },
  {
    color: '#a855f7',
    icon: (
      <>
        <circle cx="10" cy="10" r="4.5" fill="currentColor" />
        <ellipse
          cx="10"
          cy="10"
          rx="8.5"
          ry="2.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          transform="rotate(-18 10 10)"
        />
      </>
    ),
  },
  {
    color: '#f472b6',
    icon: (
      <>
        <circle cx="10" cy="10" r="3" fill="#050510" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      </>
    ),
  },
  {
    color: '#ffffff',
    icon: (
      <path
        d="M10 2 L11.5 8.5 L18 10 L11.5 11.5 L10 18 L8.5 11.5 L2 10 L8.5 8.5 Z"
        fill="currentColor"
      />
    ),
  },
  {
    color: '#9be7ff',
    icon: (
      <>
        <circle cx="10" cy="10" r="2" fill="currentColor" />
        <path d="M10 10 a5 5 0 0 1 7 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10 a5 5 0 0 1 -7 -3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  },
];

// Vertical journey map on the right edge: one stop per section,
// a marker following the scroll, click to jump. Desktop only.
export const MiniMap = () => {
  const [progress, setProgress] = useState(0);
  const labels = useT().minimap;
  const isMobile = useIsMobile();

  useEffect(() => {
    const onScroll = () => setProgress(journeyProgress());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const active = Math.round(progress * (STOPS.length - 1));
  const jump = (index: number) => {
    // on mobile, spacer sections sit between the content ones
    const domIndex = isMobile ? [0, 1, 3, 5, 7][index] : index;
    window.scrollTo({ top: sectionTops()[domIndex] ?? 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 md:bottom-7">
      <div className="relative h-5 w-72 md:w-[26rem]">
        {/* track */}
        <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-gradient-to-r from-neon-cyan/40 via-neon-violet/40 to-neon-pink/40" />
        {/* travelled portion */}
        <div
          className="absolute top-1/2 left-0 h-px -translate-y-1/2 bg-neon-cyan shadow-[0_0_8px_#22d3ee]"
          style={{ width: `${progress * 100}%` }}
        />
        {/* current position marker */}
        <div
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_#ffffff]"
          style={{ left: `${progress * 100}%` }}
        />
        {STOPS.map((stop, index) => (
          <button
            key={labels[index]}
            type="button"
            onClick={() => jump(index)}
            className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer p-1"
            style={{ left: `${(index / (STOPS.length - 1)) * 100}%`, color: stop.color }}
            aria-label={labels[index]}
          >
            <svg
              viewBox="0 0 20 20"
              className={`size-4 transition-all duration-300 ${
                active === index
                  ? 'scale-150 drop-shadow-[0_0_6px_currentColor]'
                  : 'opacity-60 group-hover:scale-[1.8] group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_currentColor]'
              }`}
            >
              {stop.icon}
            </svg>
            <span className="holo-text pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 text-xs font-bold tracking-widest whitespace-nowrap text-white uppercase opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {labels[index]}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
