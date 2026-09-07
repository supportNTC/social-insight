"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fade + 12px rise on viewport entry (MASTER.md "Scroll Reveal", subtle tier).
 * Plain IntersectionObserver instead of GSAP/ScrollTrigger — one subtle
 * effect on a handful of sections doesn't justify the extra dependency.
 *
 * A backstop timeout forces `visible` regardless of the observer: browsers
 * can throttle or altogether skip intersection callbacks for a backgrounded/
 * occluded tab, and this is decorative motion — it must never be able to
 * leave real data permanently stuck at opacity-0.
 */
const REVEAL_FALLBACK_MS = 600;

export function ScrollReveal({
  children,
  delayMs = 0,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    const reveal = () => setVisible(true);
    const fallback = setTimeout(reveal, REVEAL_FALLBACK_MS + delayMs);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
          observer.disconnect();
          clearTimeout(fallback);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [delayMs]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-[350ms] ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
