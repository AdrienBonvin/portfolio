import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

// Single source of truth for the mobile layout: the DOM (spacer sections) and the
// 3D staging must agree, otherwise the camera pauses on empty space.
export const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
};
