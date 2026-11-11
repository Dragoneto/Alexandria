import { useEffect, useRef, useState } from 'react';

/** Delays placeholders on fast requests and keeps a shown placeholder from flashing away. */
export function useLoadingGate(loading: boolean, delayMs = 300, minimumVisibleMs = 300) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      if (visible) return;
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }

    if (!visible) return;
    const remaining = Math.max(
      0,
      minimumVisibleMs - (Date.now() - (shownAt.current ?? Date.now())),
    );
    timer = setTimeout(() => {
      shownAt.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [delayMs, loading, minimumVisibleMs, visible]);

  return visible;
}
