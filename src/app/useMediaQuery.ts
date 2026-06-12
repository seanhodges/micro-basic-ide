import { useSyncExternalStore } from 'react';

/** Breakpoint below which the IDE switches to the tabbed mobile layout. */
export const MOBILE_QUERY = '(max-width: 768px)';

export function isMobileViewport(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
