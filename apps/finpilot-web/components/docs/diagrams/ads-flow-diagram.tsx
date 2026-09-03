"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import { anchor, drawEdge, drawNode, drawStepMarker, routeElbow, stage, type Box } from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

const STEPS = [
  { title: "Fund the wallet", subtitle: "Razorpay link → webhook credits", variant: "surface" as const },
  { title: "Create ad campaign", subtitle: "CPC ≤ daily budget", variant: "surface" as const },
  { title: "Match a search", subtitle: "same recall rule · balance ≥ CPC", variant: "surface" as const },
  { title: "Sponsored slot", subtitle: "prepended · impression is free", variant: "brand" as const },
  { title: "Click → check budget", subtitle: "balance? spend today + CPC?", variant: "warning" as const },
  { title: "Wallet debited", subtitle: "ad_click_charged logged", variant: "success" as const },
];

/** How a rupee actually leaves an ad wallet: only on a click, only if both
 * the balance and the day's remaining budget cover it, with the cost
 * re-derived server-side from the campaign rather than trusted from the page. */
export function AdsFlowDiagram() {
  const ref = useThemedCanvas((ctx, { width, colors, progress }) => {
    const wide = width >= 700;
    const padX = 16;

    if (wide) {
      // Sized so an edge label fits in the gap instead of overlapping the
      // steps on either side of it.
      const gap = 100;
      const cw = (width - padX * 2 - gap * 2) / 3;
      const h = 58;
      const rowY = [30, 148];
      const box = (i: number): Box => ({
        x: padX + (i % 3) * (cw + gap),
        y: rowY[Math.floor(i / 3)],
        w: cw,
        h,
      });

      const boxes = STEPS.map((_, i) => box(i));
      const noop: Box = { x: boxes[4].x, y: rowY[1] + h + 44, w: cw, h: 44 };

      STEPS.forEach((step, i) => {
        const alpha = stage(progress, i, STEPS.length + 1);
        drawNode(ctx, { ...boxes[i], title: step.title, subtitle: step.subtitle, variant: step.variant, alpha }, colors);
        drawStepMarker(ctx, i + 1, boxes[i].x + 13, boxes[i].y - 1, colors, { alpha, radius: 8.5 });
      });
      drawNode(
        ctx,
        { ...noop, variant: "outline", title: "Silently stops serving", subtitle: "never an error on the buyer's page", alpha: stage(progress, 6, 7) },
        colors,
      );

      const e = stage(progress, 3.4, 7);
      drawEdge(ctx, routeElbow(anchor(boxes[0], "right"), "right", anchor(boxes[1], "left"), "left"), colors, { alpha: e });
      drawEdge(ctx, routeElbow(anchor(boxes[1], "right"), "right", anchor(boxes[2], "left"), "left"), colors, { alpha: e });
      drawEdge(
        ctx,
        [
          anchor(boxes[2], "bottom"),
          { x: boxes[2].x + cw / 2, y: rowY[1] - 30 },
          { x: boxes[3].x + cw / 2, y: rowY[1] - 30 },
          anchor(boxes[3], "top"),
        ],
        colors,
        { alpha: e, label: "on a matching buyer search" },
      );
      drawEdge(ctx, routeElbow(anchor(boxes[3], "right"), "right", anchor(boxes[4], "left"), "left"), colors, {
        alpha: stage(progress, 5, 7),
        label: "buyer clicks",
      });
      drawEdge(ctx, routeElbow(anchor(boxes[4], "right"), "right", anchor(boxes[5], "left"), "left"), colors, {
        alpha: stage(progress, 5.6, 7),
        color: colors.success,
        label: "both pass",
      });
      drawEdge(ctx, routeElbow(anchor(boxes[4], "bottom"), "bottom", anchor(noop, "top"), "top"), colors, {
        alpha: stage(progress, 6.2, 7),
        dashed: true,
        label: "either fails",
      });
      return;
    }

    const w = width - padX * 2 - 26;
    const h = 54;
    const gapY = 14;
    STEPS.forEach((step, i) => {
      const alpha = stage(progress, i, STEPS.length);
      const box: Box = { x: padX + 26, y: 10 + i * (h + gapY), w, h };
      drawNode(ctx, { ...box, align: "left", title: step.title, subtitle: step.subtitle, variant: step.variant, alpha }, colors);
      drawStepMarker(ctx, i + 1, padX + 11, box.y + h / 2, colors, { alpha });
      if (i > 0) {
        const prevBottom = { x: box.x + 24, y: box.y - gapY };
        drawEdge(ctx, [prevBottom, { x: box.x + 24, y: box.y }], colors, { alpha, width: 1.4 });
      }
    });
  });

  return (
    <DiagramFrame
      title="Sponsored placement, funding to charge"
      caption="A sponsored result has to clear the same relevance rule as an organic one — paid placement buys a slot, not a match — and showing it costs nothing. Only a real click debits the wallet, after re-deriving the cost server-side and checking both the balance and the day's remaining budget. When either is exhausted the campaign simply stops serving; the buyer never sees an error."
    >
      <canvas
        ref={ref}
        className="block h-[420px] w-full md:h-[290px]"
        role="img"
        aria-label="Ads flow: fund the wallet, create a campaign whose cost-per-click is within its daily budget, match a buyer search using the same relevance rule as organic results, prepend a free sponsored impression, then on a click check the balance and the day's remaining budget before debiting the wallet — failing either check just stops the campaign serving."
      />
    </DiagramFrame>
  );
}
