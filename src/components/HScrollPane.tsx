import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

type HScrollPaneProps = {
  children: ReactNode;
  /** Classes added to the wrapper div (the grid item). Pass template-comparison-before/after here. */
  className?: string;
};

export function HScrollPane({ children, className = "" }: HScrollPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [arrowTopPx, setArrowTopPx] = useState<number | null>(null);

  const updateScrollState = useCallback(() => {
    const pane = paneRef.current;
    if (!pane) return;
    setCanScrollLeft(pane.scrollLeft > 2);
    setCanScrollRight(pane.scrollLeft + pane.clientWidth < pane.scrollWidth - 2);
    // clientHeight is the visible height of the pane; it stays constant while
    // the pane scrolls internally (only changes on resize).  Half of it is the
    // centre of the visible area in wrapper-relative coordinates, so the arrows
    // stay visible regardless of how far the content has been scrolled.
    setArrowTopPx(pane.clientHeight / 2);
  }, []);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    updateScrollState();
    pane.addEventListener("scroll", updateScrollState, { passive: true });

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateScrollState);
      ro.observe(pane);
    }

    return () => {
      pane.removeEventListener("scroll", updateScrollState);
      ro?.disconnect();
    };
  }, [updateScrollState]);

  const wrapperClass = [
    "hscroll-pane-wrapper",
    className,
    canScrollLeft ? "has-scroll-left" : "",
    canScrollRight ? "has-scroll-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // CSS `top: 50%` is the SSR/pre-paint fallback; overridden once the pane
  // has a measured clientHeight so the arrows track the visible centre even
  // if the wrapper ever grows taller than the viewport.
  const arrowStyle: CSSProperties | undefined =
    arrowTopPx !== null ? { top: `${arrowTopPx}px` } : undefined;

  return (
    <div className={wrapperClass}>
      <div ref={paneRef} className="template-comparison-pane">
        {children}
      </div>
      <button
        className={`hscroll-arrow hscroll-arrow-left${canScrollLeft ? " is-visible" : ""}`}
        style={arrowStyle}
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
        style={arrowStyle}
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
