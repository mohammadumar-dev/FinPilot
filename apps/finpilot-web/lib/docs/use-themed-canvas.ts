"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { animate } from "animejs";

import { resetFontCache } from "@/lib/docs/diagram-kit";

/** The design-token colors a canvas diagram needs, pulled live off the
 * cascade (`getComputedStyle`) rather than duplicated as hex literals —
 * so a diagram redrawn after a theme flip always matches globals.css
 * without the two ever being able to drift apart. */
export type DocsCanvasColors = {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  muted: string;
  secondary: string;
  border: string;
  brand: string;
  brandForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  destructive: string;
  destructiveForeground: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  /** True when the dark palette is active — for shadow strength, mostly. */
  isDark: boolean;
};

function readColors(): DocsCanvasColors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim() || "#888";
  return {
    background: read("--background"),
    card: read("--card"),
    foreground: read("--foreground"),
    mutedForeground: read("--muted-foreground"),
    muted: read("--muted"),
    secondary: read("--secondary"),
    border: read("--border"),
    brand: read("--brand"),
    brandForeground: read("--brand-foreground"),
    success: read("--success"),
    successForeground: read("--success-foreground"),
    warning: read("--warning"),
    warningForeground: read("--warning-foreground"),
    destructive: read("--destructive"),
    destructiveForeground: read("--destructive-foreground"),
    chart1: read("--chart-1"),
    chart2: read("--chart-2"),
    chart3: read("--chart-3"),
    chart4: read("--chart-4"),
    chart5: read("--chart-5"),
    isDark: document.documentElement.classList.contains("dark"),
  };
}

export type DiagramDrawContext = {
  width: number;
  height: number;
  colors: DocsCanvasColors;
  /** 0 → 1 entrance progress, for staged reveals. Always 1 when the visitor
   * asked for reduced motion, or once the entrance has already played. */
  progress: number;
};

export type DiagramDraw = (ctx: CanvasRenderingContext2D, dims: DiagramDrawContext) => void;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wires a `<canvas>` up to the app's design tokens and lifecycle:
 *
 * - sizes it to its container at devicePixelRatio, so strokes and text are
 *   crisp on retina rather than upscaled from CSS pixels;
 * - re-reads the CSS custom properties and redraws on every theme flip and
 *   container resize;
 * - redraws once `document.fonts.ready` resolves, because until the webfont
 *   lands every `measureText` call is measuring the fallback face and the
 *   layout computed from it is wrong;
 * - drives a one-shot entrance animation (anime.js) the first time the
 *   diagram scrolls into view, handing `progress` to the draw function so it
 *   can stage nodes and connectors in.
 *
 * `draw` receives CSS-pixel space — the DPR transform is pre-applied, so no
 * drawing code ever touches devicePixelRatio itself.
 */
export function useThemedCanvas(
  draw: DiagramDraw,
  options: { animated?: boolean; duration?: number } = {},
) {
  const { animated = true, duration = 900 } = options;
  const ref = React.useRef<HTMLCanvasElement>(null);
  const drawRef = React.useRef(draw);
  React.useEffect(() => {
    drawRef.current = draw;
  });

  // Survives the theme-change effect re-run, so toggling light/dark repaints
  // the finished diagram instead of replaying its entrance.
  const hasAnimatedRef = React.useRef(false);
  const progressRef = React.useRef(animated ? 0 : 1);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawRef.current(ctx, {
        width: rect.width,
        height: rect.height,
        colors: readColors(),
        progress: progressRef.current,
      });
    };

    const shouldAnimate = animated && !hasAnimatedRef.current && !prefersReducedMotion();
    progressRef.current = shouldAnimate ? 0 : 1;
    render();

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(canvas);

    // Webfonts land after first paint; everything measured before then used
    // the fallback metrics, so drop the cached family and lay out again.
    document.fonts?.ready.then(() => {
      resetFontCache();
      render();
    });

    let viewObserver: IntersectionObserver | undefined;
    if (shouldAnimate) {
      const state = { p: 0 };
      viewObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          viewObserver?.disconnect();
          animate(state, {
            p: 1,
            duration,
            ease: "outQuad",
            onUpdate: () => {
              progressRef.current = state.p;
              render();
            },
            onComplete: () => {
              hasAnimatedRef.current = true;
              progressRef.current = 1;
              render();
            },
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -5% 0px" },
      );
      viewObserver.observe(canvas);
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      viewObserver?.disconnect();
    };
    // resolvedTheme is read only to force a redraw when it flips; the actual
    // values come from the DOM inside render().
  }, [resolvedTheme, animated, duration]);

  return ref;
}
