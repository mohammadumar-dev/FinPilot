"use client";

import * as React from "react";
import { animate, stagger, type AnimationParams } from "animejs";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const REVEAL_FROM: AnimationParams = {
  opacity: [0, 1],
  translateY: [16, 0],
  duration: 600,
  ease: "outQuad",
};

/**
 * Runs the entrance, but never at the cost of the content existing: these
 * elements start at `opacity: 0`, so anything that stops the animation from
 * running would otherwise hide them permanently. If the call throws, the
 * final state is applied directly.
 */
function reveal(targets: HTMLElement | HTMLElement[], run: () => void) {
  const elements = Array.isArray(targets) ? targets : [targets];
  try {
    run();
  } catch {
    elements.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }
}

/**
 * Fades + lifts an element in the first time it crosses into the viewport —
 * used on <DocsSection> so every section on the docs page (text, diagram, or
 * chart alike) gets the same one-shot entrance instead of popping in cold.
 * Reduced-motion visitors get the final state immediately, no observer.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.style.opacity = "1";
      return;
    }

    el.style.opacity = "0";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        reveal(el, () => animate(el, REVEAL_FROM));
      },
      // threshold 0 — any intersecting pixel counts. A fractional threshold
      // can never be met by a section taller than the viewport divided by
      // that fraction, which would leave it hidden forever on short screens.
      { threshold: 0, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/**
 * Same idea, but staggers every direct child carrying `data-reveal-item`
 * instead of animating the container as one block — for card grids and
 * numbered step lists where each item should visibly follow the last.
 */
export function useRevealGroup<T extends HTMLElement>(staggerMs = 70) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal-item]"));
    if (items.length === 0) return;

    if (prefersReducedMotion()) {
      items.forEach((el) => {
        el.style.opacity = "1";
      });
      return;
    }

    items.forEach((el) => {
      el.style.opacity = "0";
    });
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        reveal(items, () => animate(items, { ...REVEAL_FROM, delay: stagger(staggerMs) }));
      },
      { threshold: 0, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [staggerMs]);

  return ref;
}
