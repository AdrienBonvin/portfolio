import { useLang, type Lang } from './i18n';

const OPTIONS: Lang[] = ['fr', 'en'];

export const LangToggle = () => {
  const { lang, setLang } = useLang();

  return (
    // near-opaque on mobile: the section bodies are taller than the screen, so
    // their text is permanently scrolling under this
    <div className="pointer-events-auto fixed top-3 right-3 z-40 flex gap-1 rounded-full border border-white/15 bg-void/85 p-0.5 backdrop-blur-sm md:top-5 md:right-5 md:bg-black/30 md:p-1">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase transition ${
            lang === option
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-[0_0_12px_-2px_#22d3ee]'
              : 'text-white/50 hover:text-white'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};
