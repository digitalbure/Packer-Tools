import { useEffect } from 'react';

const HREF =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600&family=Big+Shoulders+Display:wght@700;800;900&family=Permanent+Marker&display=swap';

/** Loads the landing page fonts once, only on the landing route (the rest of the app is unaffected). */
export function useLandingFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-pt-landing-fonts]')) return;
    const pre1 = Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    const pre2 = Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' });
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: HREF });
    css.setAttribute('data-pt-landing-fonts', '');
    document.head.append(pre1, pre2, css);
  }, []);
}
