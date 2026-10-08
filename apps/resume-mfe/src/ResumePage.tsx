import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

// Keep document line wrapping independent of the workspace and sidebar width.
// Zoom changes only the view; it never rewrites or trims resume content.
export function ResumePage({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });
  useLayoutEffect(() => {
    const measure = () => {
      if (!viewport.current || !surface.current) return;
      const next = {
        width: viewport.current.clientWidth,
        height: Math.max(PAGE_HEIGHT, surface.current.offsetHeight),
      };
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (surface.current) observer.observe(surface.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const scale = Math.min(1, size.width / PAGE_WIDTH);
  const pages = Math.ceil(size.height / PAGE_HEIGHT);
  return (
    <div className="rf-page-viewer">
      <div className="rf-page-view-controls" aria-label="Resume page layout">
        <span>
          A4 · {pages} {pages === 1 ? "page" : "pages"}
        </span>
        <span>Fit to width</span>
      </div>
      {pages > 1 ? (
        <p className="rf-page-overflow" role="status">
          Content exceeds one A4 page. Adjust spacing in Customize Template; all
          text is kept.
        </p>
      ) : null}
      <div ref={viewport} className="rf-page-viewport">
        <div
          className="rf-page-zoom-frame"
          style={{ width: PAGE_WIDTH * scale, height: size.height * scale }}
        >
          <div
            ref={surface}
            className="rf-page-zoom-surface"
            style={{ transform: `scale(${String(scale)})` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
