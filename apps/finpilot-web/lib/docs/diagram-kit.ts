/**
 * A small drawing kit for the docs page's canvas diagrams.
 *
 * The one thing worth knowing up front: **canvas does not resolve CSS custom
 * properties**. Setting `ctx.font = "600 13px var(--font-sans)"` is not a
 * font — it's an unparseable value, which the spec says to ignore, leaving
 * the context on its `10px sans-serif` default. Every diagram label has to
 * be drawn with a *resolved* family string, which is what `resolveFonts()`
 * below reads off the cascade once and caches.
 */

import type { DocsCanvasColors } from "@/lib/docs/use-themed-canvas";

export type Point = { x: number; y: number };
export type Side = "top" | "right" | "bottom" | "left";
export type Box = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

let fontCache: { sans: string; mono: string } | null = null;

/** Dropped when webfonts finish loading, so metrics get re-measured against
 * the real face rather than the fallback (see useThemedCanvas). */
export function resetFontCache() {
  fontCache = null;
}

export function resolveFonts(): { sans: string; mono: string } {
  if (fontCache) return fontCache;
  if (typeof window === "undefined") {
    return { sans: "system-ui, sans-serif", mono: "ui-monospace, monospace" };
  }
  const root = getComputedStyle(document.documentElement);
  const varSans = root.getPropertyValue("--font-sans").trim();
  const varMono = root.getPropertyValue("--font-geist-mono").trim();
  const bodySans = getComputedStyle(document.body).fontFamily;
  fontCache = {
    sans: varSans || bodySans || "system-ui, sans-serif",
    mono: varMono || "ui-monospace, SFMono-Regular, monospace",
  };
  return fontCache;
}

type FontOpts = { size: number; weight?: number | string; mono?: boolean; tracking?: string };

export function setFont(ctx: CanvasRenderingContext2D, { size, weight = 500, mono, tracking }: FontOpts) {
  const fonts = resolveFonts();
  ctx.font = `${weight} ${size}px ${mono ? fonts.mono : fonts.sans}`;
  // letterSpacing is well-supported in Chromium/Safari and simply ignored
  // elsewhere; it's what makes the uppercase eyebrows read as eyebrows.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = tracking ?? "0px";
}

/** Truncate with a real ellipsis instead of letting fillText's maxWidth
 * horizontally squash the glyphs (which is what makes a diagram look cheap). */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
}

/** Greedy word wrap, capped at `maxLines` with an ellipsis on the last one. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines) lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1], maxWidth);
  return lines;
}

// ---------------------------------------------------------------------------
// Staged reveal
// ---------------------------------------------------------------------------

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Splits a 0→1 entrance into overlapping per-item windows, so nodes arrive
 * in sequence rather than all at once. Returns that item's own eased 0→1.
 */
export function stage(progress: number, index: number, total: number, overlap = 0.62): number {
  if (total <= 1) return easeOutCubic(clamp01(progress));
  const itemDuration = 1 / (1 + (total - 1) * (1 - overlap));
  const start = index * (1 - overlap) * itemDuration;
  return easeOutCubic(clamp01((progress - start) / itemDuration));
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  { x, y, w, h }: Box,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type NodeVariant = "surface" | "brand" | "muted" | "outline" | "success" | "warning" | "danger";

type VariantStyle = { fill: string; stroke: string; title: string; sub: string; fillAlpha?: number };

function variantStyle(variant: NodeVariant, c: DocsCanvasColors): VariantStyle {
  switch (variant) {
    case "brand":
      return { fill: c.brand, stroke: c.brand, title: c.brandForeground, sub: c.brandForeground };
    case "muted":
      return { fill: c.muted, stroke: c.border, title: c.foreground, sub: c.mutedForeground };
    case "outline":
      return { fill: c.card, stroke: c.mutedForeground, title: c.mutedForeground, sub: c.mutedForeground, fillAlpha: 0 };
    case "success":
      return { fill: c.success, stroke: c.success, title: c.successForeground, sub: c.successForeground };
    case "warning":
      return { fill: c.warning, stroke: c.warning, title: c.warningForeground, sub: c.warningForeground };
    case "danger":
      return { fill: c.destructive, stroke: c.destructive, title: c.destructiveForeground, sub: c.destructiveForeground };
    case "surface":
    default:
      return { fill: c.card, stroke: c.border, title: c.foreground, sub: c.mutedForeground };
  }
}

export type NodeSpec = Box & {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  variant?: NodeVariant;
  radius?: number;
  /** 0→1 reveal for this node; it fades and rises into place. */
  alpha?: number;
  align?: "center" | "left";
};

export function drawNode(ctx: CanvasRenderingContext2D, spec: NodeSpec, c: DocsCanvasColors) {
  const {
    title,
    subtitle,
    eyebrow,
    variant = "surface",
    radius = 12,
    alpha = 1,
    align = "center",
  } = spec;
  if (alpha <= 0.001) return;

  const style = variantStyle(variant, c);
  const lift = (1 - alpha) * 10;
  const box: Box = { x: spec.x, y: spec.y + lift, w: spec.w, h: spec.h };

  ctx.save();
  ctx.globalAlpha = alpha;

  // Elevation — the thing that makes a node read as a raised surface rather
  // than an outline. Kept soft, and stronger in dark mode where a 6% shadow
  // is invisible.
  ctx.save();
  ctx.shadowColor = c.isDark ? "rgba(0,0,0,0.45)" : "rgba(40,32,22,0.12)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  roundRectPath(ctx, box, radius);
  if (style.fillAlpha === 0) {
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = c.card;
  } else {
    ctx.fillStyle = style.fill;
  }
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = alpha;
  roundRectPath(ctx, box, radius);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1;
  if (variant === "outline") ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const pad = 12;
  const innerW = box.w - pad * 2;
  const cx = align === "center" ? box.x + box.w / 2 : box.x + pad;
  ctx.textAlign = align === "center" ? "center" : "left";
  ctx.textBaseline = "middle";

  // Vertical rhythm: measure what's actually present, then center the block.
  const hasEyebrow = Boolean(eyebrow);
  const hasSub = Boolean(subtitle);
  const blockH = (hasEyebrow ? 13 : 0) + 15 + (hasSub ? 14 : 0);
  let cursor = box.y + box.h / 2 - blockH / 2 + (hasEyebrow ? 6 : 7);

  if (eyebrow) {
    setFont(ctx, { size: 9, weight: 600, tracking: "0.09em" });
    ctx.fillStyle = style.sub;
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillText(fitText(ctx, eyebrow.toUpperCase(), innerW), cx, cursor);
    ctx.globalAlpha = alpha;
    cursor += 13;
  }

  setFont(ctx, { size: 12.5, weight: 600 });
  ctx.fillStyle = style.title;
  ctx.fillText(fitText(ctx, title, innerW), cx, cursor);
  cursor += 15;

  if (subtitle) {
    setFont(ctx, { size: 10.5, weight: 450 });
    ctx.fillStyle = style.sub;
    ctx.globalAlpha = alpha * (variant === "brand" || variant === "success" ? 0.82 : 1);
    ctx.fillText(fitText(ctx, subtitle, innerW), cx, cursor);
  }

  ctx.restore();
}

/** A dashed boundary with a label chip — for "everything inside here is one
 * subsystem" (the Merchant Checkout Core, a request lane, a trust boundary). */
export function drawGroup(
  ctx: CanvasRenderingContext2D,
  box: Box,
  label: string,
  c: DocsCanvasColors,
  opts: { alpha?: number; color?: string; tint?: boolean } = {},
) {
  const { alpha = 1, color = c.brand, tint = true } = opts;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (tint) {
    roundRectPath(ctx, box, 16);
    ctx.globalAlpha = alpha * (c.isDark ? 0.1 : 0.05);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  roundRectPath(ctx, box, 16);
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1;
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = alpha;

  setFont(ctx, { size: 9, weight: 700, tracking: "0.1em" });
  const text = label.toUpperCase();
  const textW = ctx.measureText(text).width;
  const chip: Box = { x: box.x + 14, y: box.y - 8, w: textW + 16, h: 17 };
  roundRectPath(ctx, chip, 8);
  ctx.fillStyle = c.background;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, chip.x + 8, chip.y + chip.h / 2 + 0.5);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

export function anchor(box: Box, side: Side, offset = 0.5): Point {
  switch (side) {
    case "top":
      return { x: box.x + box.w * offset, y: box.y };
    case "bottom":
      return { x: box.x + box.w * offset, y: box.y + box.h };
    case "left":
      return { x: box.x, y: box.y + box.h * offset };
    case "right":
    default:
      return { x: box.x + box.w, y: box.y + box.h * offset };
  }
}

const isHorizontal = (side: Side) => side === "left" || side === "right";

/**
 * Orthogonal (elbow) routing between two anchors. Right-angle connectors read
 * as a system diagram; naive point-to-point curves read as a doodle.
 */
export function routeElbow(from: Point, fromSide: Side, to: Point, toSide: Side): Point[] {
  const fh = isHorizontal(fromSide);
  const th = isHorizontal(toSide);

  if (fh && th) {
    if (Math.abs(from.y - to.y) < 1) return [from, to];
    const mx = (from.x + to.x) / 2;
    return [from, { x: mx, y: from.y }, { x: mx, y: to.y }, to];
  }
  if (!fh && !th) {
    if (Math.abs(from.x - to.x) < 1) return [from, to];
    const my = (from.y + to.y) / 2;
    return [from, { x: from.x, y: my }, { x: to.x, y: my }, to];
  }
  // Mixed: exactly one corner, turning on the axis the source leaves along.
  return fh ? [from, { x: to.x, y: from.y }, to] : [from, { x: from.x, y: to.y }, to];
}

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

export type EdgeOptions = {
  color?: string;
  dashed?: boolean;
  width?: number;
  /** 0→1; the line draws itself in via a dash offset. */
  alpha?: number;
  arrow?: boolean;
  cornerRadius?: number;
  label?: string;
  labelBg?: string;
};

export function drawEdge(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  c: DocsCanvasColors,
  opts: EdgeOptions = {},
) {
  const {
    color = c.mutedForeground,
    dashed = false,
    width = 1.5,
    alpha = 1,
    arrow = true,
    cornerRadius = 10,
    label,
    labelBg,
  } = opts;
  if (alpha <= 0.001 || points.length < 2) return;

  const length = polylineLength(points);
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * 1.2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (dashed) {
    // A dashed line can't also use the dash array to reveal itself, so it
    // fades in and grows by clipping the drawn length instead.
    ctx.setLineDash([5, 4]);
  } else if (alpha < 1) {
    ctx.setLineDash([length * alpha, length]);
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(cornerRadius, inLen / 2, outLen / 2);
    ctx.arcTo(curr.x, curr.y, next.x, next.y, r);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (arrow) {
    const tip = points[points.length - 1];
    const prev = points[points.length - 2];
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const size = 7;
    // The head only lands once the line has essentially arrived.
    ctx.globalAlpha = clamp01((alpha - 0.75) / 0.25);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - size * Math.cos(angle - Math.PI / 7), tip.y - size * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(tip.x - size * 0.72 * Math.cos(angle), tip.y - size * 0.72 * Math.sin(angle));
    ctx.lineTo(tip.x - size * Math.cos(angle + Math.PI / 7), tip.y - size * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (label) {
    const mid = midpointOf(points);
    drawChip(ctx, label, mid.x, mid.y, c, {
      alpha: clamp01((alpha - 0.6) / 0.4),
      bg: labelBg ?? c.background,
      color: c.mutedForeground,
    });
  }
}

function midpointOf(points: Point[]): Point {
  const target = polylineLength(points) / 2;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    walked += seg;
  }
  return points[points.length - 1];
}

/** A small pill of text on its own background — edge labels, legends, notes. */
export function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  c: DocsCanvasColors,
  opts: { alpha?: number; bg?: string; color?: string; size?: number; weight?: number; mono?: boolean; ring?: string } = {},
) {
  const { alpha = 1, bg = c.background, color = c.mutedForeground, size = 10, weight = 500, mono = false, ring } = opts;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  setFont(ctx, { size, weight, mono });
  const textW = ctx.measureText(text).width;
  const box: Box = { x: cx - textW / 2 - 6, y: cy - size / 2 - 4.5, w: textW + 12, h: size + 9 };
  roundRectPath(ctx, box, 6);
  ctx.fillStyle = bg;
  ctx.fill();
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

/** Free-standing caption text, for axis/lane titles and footnotes. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    color: string;
    size?: number;
    weight?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    alpha?: number;
    mono?: boolean;
    tracking?: string;
    maxWidth?: number;
  },
) {
  const { color, size = 11, weight = 500, align = "left", baseline = "middle", alpha = 1, mono, tracking, maxWidth } = opts;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  setFont(ctx, { size, weight, mono, tracking });
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(maxWidth ? fitText(ctx, text, maxWidth) : text, x, y);
  ctx.restore();
}

/** A numbered step marker — the small filled circle the sequence and flow
 * diagrams use to make reading order unambiguous. */
export function drawStepMarker(
  ctx: CanvasRenderingContext2D,
  n: number,
  cx: number,
  cy: number,
  c: DocsCanvasColors,
  opts: { alpha?: number; color?: string; fg?: string; radius?: number } = {},
) {
  const { alpha = 1, color = c.brand, fg = c.brandForeground, radius = 9 } = opts;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  setFont(ctx, { size: 10, weight: 700 });
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), cx, cy + 0.5);
  ctx.restore();
}

/** Bottom-aligned legend row: a swatch + label per entry. */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  entries: { label: string; color: string; dashed?: boolean }[],
  x: number,
  y: number,
  c: DocsCanvasColors,
  alpha = 1,
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  setFont(ctx, { size: 10, weight: 500 });
  let cursor = x;
  for (const entry of entries) {
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(entry.dashed ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(cursor, y);
    ctx.lineTo(cursor + 16, y);
    ctx.stroke();
    ctx.setLineDash([]);
    cursor += 22;
    ctx.fillStyle = c.mutedForeground;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(entry.label, cursor, y + 0.5);
    cursor += ctx.measureText(entry.label).width + 18;
  }
  ctx.restore();
}
