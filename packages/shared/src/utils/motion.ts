import { useEffect, useState, type RefObject } from "react";

/**
 * Tracks OS/browser `prefers-reduced-motion: reduce` setting, with an optional
 * explicit override (for testing or user preference toggles).
 */
export function useReducedMotion(explicitOverride?: boolean): boolean {
  const [systemReduced, setSystemReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemReduced(event.matches);
    };
    setSystemReduced(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return explicitOverride ?? systemReduced;
}

/**
 * Tracks whether a decorative container is currently visible in the viewport
 * AND the browser tab is active (`document.visibilityState === "visible"`).
 * Used to pause/unmount canvas and CSS animations when offscreen or in background tabs.
 */
export function useDecorativeActivity(containerRef: RefObject<HTMLElement | null>): boolean {
  const [inViewport, setInViewport] = useState<boolean>(true);
  const [tabVisible, setTabVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      setTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setInViewport(entry.isIntersecting);
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  return inViewport && tabVisible;
}

/**
 * Detects narrow/mobile viewports or coarse pointers so decorative effects
 * stay within a bounded mobile rendering budget and disable cursor gravity on touch.
 */
export function useMobileOrTouchViewport(): { isCompact: boolean; isCoarsePointer: boolean } {
  const [state, setState] = useState<{ isCompact: boolean; isCoarsePointer: boolean }>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return { isCompact: false, isCoarsePointer: false };
    }
    return {
      isCompact: window.matchMedia("(max-width: 768px)").matches,
      isCoarsePointer: window.matchMedia("(pointer: coarse)").matches,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const compactQuery = window.matchMedia("(max-width: 768px)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");

    const update = () => {
      setState({
        isCompact: compactQuery.matches,
        isCoarsePointer: coarseQuery.matches,
      });
    };

    update();
    compactQuery.addEventListener("change", update);
    coarseQuery.addEventListener("change", update);
    return () => {
      compactQuery.removeEventListener("change", update);
      coarseQuery.removeEventListener("change", update);
    };
  }, []);

  return state;
}
