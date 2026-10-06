import { useEffect, useState } from 'react';
import { LINKS, useT } from './i18n';

const EVENT = 'email-copied';
export const EMAIL = LINKS.email.replace('mailto:', '');

// mailto: does nothing silently when no mail client is set up (Gmail-in-browser users),
// so the address is copied too and a toast confirms it.
export const contactByEmail = () => {
  navigator.clipboard?.writeText(EMAIL).then(
    () => window.dispatchEvent(new Event(EVENT)),
    () => {},
  );
  window.location.href = LINKS.email;
};

export const EmailToast = () => {
  const [visible, setVisible] = useState(false);
  const label = useT().contact.copied;

  useEffect(() => {
    let timer: number;
    const show = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 2500);
    };
    window.addEventListener(EVENT, show);
    return () => {
      window.removeEventListener(EVENT, show);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      role="status"
      className={`pointer-events-none fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full border border-neon-cyan/40 bg-void/90 px-5 py-2 text-sm font-bold text-neon-cyan shadow-[0_0_25px_-5px_#22d3ee] backdrop-blur-sm transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      {label} {EMAIL}
    </div>
  );
};
