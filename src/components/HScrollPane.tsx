import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

type HScrollPaneProps = {
  children: ReactNode;
  /** Classes added to the wrapper div (the grid item). Pass template-comparison-before/after here. */
  className?: string;
};

type ArrowPos = {
  top: number; // viewport-relative center of the visible pane slice (px)
  left: number; // viewport-relative left edge + gutter (px)
  right: number; // viewport-relative right gutter from right edge (px)
};

// Half the button height (36px) so `top + HALF_H` places the button CENTER at `top`
// when CSS still applies `transform: translateY(-50%)`.
const HALF_H = 18;

export function HScrollPane({ children, className = "" }: HScrollPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [arrowPos, setArrowPos] = useState<ArrowPos | null>(null);

  // Reads pane metrics and schedules a single React state update per animation
  // frame.  Called from pane scroll, window scroll, and ResizeObserver.
  const update = useCallback(() => {
    const pane = paneRef.current;
    if (!pane) return;

    setCanScrollLeft(pane.scrollLeft > 2);
    setCanScrollRight(pane.scrollLeft + pane.clientWidth < pane.scrollWidth - 2);

    const rect = pane.getBoundingClientRect();
    // Clamp to the visible slice of the pane inside the viewport.
    const visTop = Math.max(rect.top, 0);
    const visBottom = Math.min(rect.bottom, window.innerHeight);
    if (visBottom > visTop) {
      setArrowPos({
        top: (visTop + visBottom) / 2,
        left: rect.left + 10,
        right: window.innerWidth - rect.right + 10,
      });
    } else {
      setArrowPos(null);
    }
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return; // already queued this frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      update();
    });
  }, [update]);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    update(); // synchronous initial measurement before first paint
    pane.addEventListener("scroll", scheduleUpdate, { passive: true });
    // Window scroll fires when the pane rides along with a page scroll rather
    // than scrolling internally.  RAF debouncing keeps this from causing jank.
    window.addEventListener("scroll", scheduleUpdate, { passive: true });

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(scheduleUpdate);
      ro.observe(pane);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pane.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
      ro?.disconnect();
    };
  }, [update, scheduleUpdate]);

  const wrapperClass = [
    "hscroll-pane-wrapper",
    className,
    canScrollLeft ? "has-scroll-left" : "",
    canScrollRight ? "has-scroll-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // `position: fixed` anchors to the viewport so arrows never scroll with the
  // content, regardless of whether the pane or the outer page is the scroll
  // container.  `top + HALF_H` compensates for CSS `transform: translateY(-50%)`
  // so the button's visual center lands exactly at the computed midpoint.
  // When arrowPos is null (pane off-screen) the inline style is omitted and the
  // CSS fallback (`position: absolute; opacity: 0`) hides both arrows.
  const leftStyle: CSSProperties | undefined = arrowPos
    ? { position: "fixed", top: `${arrowPos.top + HALF_H}px`, left: `${arrowPos.left}px`, right: "auto" }
    : undefined;

  const rightStyle: CSSProperties | undefined = arrowPos
    ? { position: "fixed", top: `${arrowPos.top + HALF_H}px`, right: `${arrowPos.right}px`, left: "auto" }
    : undefined;

  // Wheel events on the arrows (position:fixed, pointer-events:auto when visible)
  // bubble through the DOM: arrow → wrapper → grid (overflow:hidden) and get
  // consumed without scrolling the pane.  Intercept at the wrapper level and
  // forward any event that did NOT originate inside the pane itself.
  const handleWrapperWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const pane = paneRef.current;
      if (!pane || pane.contains(e.target as Node)) return;
      pane.scrollBy({ top: e.deltaY, left: e.deltaX });
    },
    [],
  );

  return (
    <div className={wrapperClass} onWheel={handleWrapperWheel}>
      <div ref={paneRef} className="template-comparison-pane">
        {children}
      </div>
      <button
        className={`hscroll-arrow hscroll-arrow-left${canScrollLeft ? " is-visible" : ""}`}
        style={leftStyle}
        type="button"
        aria-label="Scroll left"
        aria-hidden={!canScrollLeft}
        tabIndex={canScrollLeft ? 0 : -1}
        onClick={() => paneRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button
        className={`hscroll-arrow hscroll-arrow-right${canScrollRight ? " is-visible" : ""}`}
        style={rightStyle}
        type="button"
        aria-label="Scroll right"
        aria-hidden={!canScrollRight}
        tabIndex={canScrollRight ? 0 : -1}
        onClick={() => paneRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
