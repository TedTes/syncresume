import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

type HScrollPaneProps = {
  children: ReactNode;
  /** Classes added to the wrapper div (the grid item). Pass template-comparison-before/after here. */
  className?: string;
};

export function HScrollPane({ children, className = "" }: HScrollPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const pane = paneRef.current;
    if (!pane) return;
    setCanScrollLeft(pane.scrollLeft > 2);
    setCanScrollRight(pane.scrollLeft + pane.clientWidth < pane.scrollWidth - 2);
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

  return (
    <div className={wrapperClass}>
      <div ref={paneRef} className="template-comparison-pane">
        {children}
      </div>
      <button
        className={`hscroll-arrow hscroll-arrow-left${canScrollLeft ? " is-visible" : ""}`}
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
