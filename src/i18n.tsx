import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'fr' | 'en';

export const LINKS = {
  email: 'mailto:adrien.bonvin@gmail.com',
  github: 'https://github.com/AdrienBonvin',
  linkedin: 'https://www.linkedin.com/in/adrien-bonvin/',
  youtube: 'https://www.youtube.com/@adrien_bonvin',
  spiraLive: 'https://flashcards-app-7a630.web.app/',
  spiraRepo: 'https://github.com/AdrienBonvin/flashcards-app',
  warhammerLive: 'https://warhammerclock.web.app/',
  warhammerRepo: 'https://github.com/AdrienBonvin/warhammer-clock',
};

type Entry = { title: string; period: string; tags: string[]; text: string };
type Project = {
  title: string;
  tags: string[];
  text: string;
  links: { label: string; href: string }[];
};

export type Dictionary = {
  hero: { kicker: string; tagline: string; scroll: string };
  about: { title: string; before: string; youtube: string; after: string };
  experience: { title: string; entries: Entry[] };
  projects: { title: string; items: Project[] };
  contact: { title: string; text: string; hint: string };
  spacers: { planet: string; blackHole: string; supernova: string };
  minimap: string[];
};

const fr: Dictionary = {
  hero: {
    kicker: 'Développeur Frontend',
    tagline: '8 ans à construire des interfaces. Expert React, explorateur IA.',
    scroll: '↓ scroll pour explorer',
  },
  about: {
    title: 'À propos',
    before:
      "Développeur frontend depuis 8 ans, je construis des interfaces React au quotidien chez iAdvize et je me forme en continu sur l'IA. Quand un sujet me prend, c'est dans ma nature de le pousser le plus loin possible — mes projets comme mes passions : la musique, les jeux de rôle, Warhammer, l'astronomie (le décor autour de vous n'est pas un hasard)… et même une ",
    youtube: 'chaîne YouTube dédiée au dev',
    after: '.',
  },
  experience: {
    title: 'Expérience',
    entries: [
      {
        title: 'iAdvize — Développeur Frontend Senior',
        period: '2026 — aujourd’hui',
        tags: ['React', 'TypeScript', 'GraphQL', 'IA'],
        text: "Je construis l'interface qui permet aux e-commerçants de piloter leur AI Shopping Assistant : configuration de l'IA, gestion de ses connaissances, dashboards de performance. Micro frontends React/TypeScript/GraphQL, avec l'IA au cœur du produit comme des pratiques de dev.",
      },
      {
        title: 'Sopra Steria — Développeur Front-End (puis Senior)',
        period: '2018 — 2026',
        tags: ['React', 'TypeScript', 'Angular', 'Formation'],
        text: "Du full stack Java/Angular sur des applications grands comptes à une spécialisation 100 % front, jusqu'à des applications sensibles pour l'État français en React : refonte d'un legacy massif, fiabilisation des tests, features saluées officiellement. Formateur React et Angular pour les équipes en parallèle. Pour le reste : motus. 🤫",
      },
    ],
  },
  projects: {
    title: 'Projets',
    items: [
      {
        title: 'Spira',
        tags: ['React', 'TypeScript', 'PWA', 'Firebase'],
        text: "Une app de flashcards à répétition espacée pour ancrer ce qu'on apprend — avec la suite de Fibonacci comme rythme de révision. Je l'utilise tous les jours pour ma veille React et IA.",
        links: [
          { label: 'Voir le site', href: LINKS.spiraLive },
          { label: 'GitHub', href: LINKS.spiraRepo },
        ],
      },
      {
        title: 'Warhammer Clock',
        tags: ['React', 'TypeScript', 'Warhammer 🎲'],
        text: "Une pendule d'échecs pensée pour les parties compétitives de Warhammer. Deux joueurs, un temps limité, zéro excuse pour les tours qui s'éternisent.",
        links: [
          { label: 'Voir le site', href: LINKS.warhammerLive },
          { label: 'GitHub', href: LINKS.warhammerRepo },
        ],
      },
    ],
  },
  contact: {
    title: 'Contact',
    text: 'Envie d’échanger ?',
    hint: '✨ Attrapez une constellation',
  },
  spacers: {
    planet: '✦ Touchez la planète',
    blackHole: '✦ Touchez le trou noir',
    supernova: '✦ Touchez la supernova',
  },
  minimap: ['Départ', 'À propos', 'Expérience', 'Projets', 'Contact'],
};

const en: Dictionary = {
  hero: {
    kicker: 'Frontend Developer',
    tagline: '8 years building interfaces. React expert, AI explorer.',
    scroll: '↓ scroll to explore',
  },
  about: {
    title: 'About',
    before:
      "Frontend developer for 8 years, I build React interfaces every day at iAdvize and keep training on AI. When something grabs me, it's in my nature to push it as far as it can go — my projects as much as my passions: music, tabletop RPGs, Warhammer, astronomy (the scenery around you is no accident)… and even a ",
    youtube: 'YouTube channel about coding',
    after: '.',
  },
  experience: {
    title: 'Experience',
    entries: [
      {
        title: 'iAdvize — Senior Frontend Developer',
        period: '2026 — today',
        tags: ['React', 'TypeScript', 'GraphQL', 'AI'],
        text: 'I build the interface e-merchants use to drive their AI Shopping Assistant: AI configuration, knowledge management, performance dashboards. React/TypeScript/GraphQL micro frontends, with AI at the core of both the product and the dev workflow.',
      },
      {
        title: 'Sopra Steria — Front-End Developer (then Senior)',
        period: '2018 — 2026',
        tags: ['React', 'TypeScript', 'Angular', 'Training'],
        text: 'From full stack Java/Angular on high-traffic major accounts to a 100% front-end specialization, up to sensitive React applications for the French State: massive legacy overhaul, test hardening, features officially praised. React and Angular trainer for the teams along the way. As for the rest: my lips are sealed. 🤫',
      },
    ],
  },
  projects: {
    title: 'Projects',
    items: [
      {
        title: 'Spira',
        tags: ['React', 'TypeScript', 'PWA', 'Firebase'],
        text: 'A spaced-repetition flashcards app that makes learning stick — with the Fibonacci sequence as the review rhythm. I use it every day for my React and AI learning.',
        links: [
          { label: 'Live app', href: LINKS.spiraLive },
          { label: 'GitHub', href: LINKS.spiraRepo },
        ],
      },
      {
        title: 'Warhammer Clock',
        tags: ['React', 'TypeScript', 'Warhammer 🎲'],
        text: 'A chess clock built for competitive Warhammer games. Two players, a time limit, no excuse for never-ending turns.',
        links: [
          { label: 'Live app', href: LINKS.warhammerLive },
          { label: 'GitHub', href: LINKS.warhammerRepo },
        ],
      },
    ],
  },
  contact: {
    title: 'Contact',
    text: 'Let’s talk?',
    hint: '✨ Catch a constellation',
  },
  spacers: {
    planet: '✦ Tap the planet',
    blackHole: '✦ Tap the black hole',
    supernova: '✦ Tap the supernova',
  },
  minimap: ['Start', 'About', 'Experience', 'Projects', 'Contact'],
};

const dictionaries: Record<Lang, Dictionary> = { fr, en };

// fr, fr-FR, fr-BE, fr-CA, fr-GP… → French; everything else → English
const detectLang = (): Lang => {
  const stored = localStorage.getItem('lang');
  if (stored === 'fr' || stored === 'en') return stored;
  const preferred = navigator.languages?.[0] ?? navigator.language ?? 'en';
  return preferred.toLowerCase().startsWith('fr') ? 'fr' : 'en';
};

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: 'fr',
  setLang: () => {},
});

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // persisted only on manual toggle, so auto-detection keeps working until then
  const setLang = (next: Lang) => {
    localStorage.setItem('lang', next);
    setLangState(next);
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
};

export const useLang = () => useContext(LangContext);
export const useT = () => dictionaries[useContext(LangContext).lang];
