"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fade + 12px rise on viewport entry (MASTER.md "Scroll Reveal", subtle tier).
 * Plain IntersectionObserver instead of GSAP/ScrollTrigger — one subtle
 * effect on a handful of sections doesn't justify the extra dependency.
 * Renders content at full opacity immediately when the visitor prefers
 * reduced motion, and never hides content from crawlers (starts visible,
 * only animates the transition).
 */
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
