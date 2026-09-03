"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import { anchor, drawEdge, drawNode, routeElbow, stage, type Box } from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

/**
 * The campaign state machine. The point the drawing has to make is that
 * `approved` is not `applied`: approving a proposal changes nothing a buyer
 * can see, and only the separate apply step puts a discount live.
 */
export function CampaignStateDiagram() {
  const ref = useThemedCanvas((ctx, { width, colors, progress }) => {
    const wide = width >= 700;
    const padX = 16;

    if (wide) {
      // Wide enough for the transition label to sit between two states
      // rather than on top of them.
      const gap = 82;
      const cw = (width - padX * 2 - gap * 3) / 4;
      const h = 58;
      const rowY = 42;
      const box = (i: number): Box => ({ x: padX + i * (cw + gap), y: rowY, w: cw, h });

      const proposed = box(0);
      const approved = box(1);
      const applied = box(2);
      const ended = box(3);
      const rejected: Box = { x: padX + cw / 2 + gap / 2, y: rowY + h + 62, w: cw, h: 50 };

      drawNode(
        ctx,
        { ...proposed, eyebrow: "agent output", title: "proposed", subtitle: "computed from 90d orders", alpha: stage(progress, 0, 5) },
        colors,
      );
      drawNode(
        ctx,
        { ...approved, title: "approved", subtitle: "reviewed — still not live", alpha: stage(progress, 1, 5) },
        colors,
      );
      drawNode(
        ctx,
        { ...applied, variant: "success", eyebrow: "live to buyers", title: "applied", subtitle: "prices change on read", alpha: stage(progress, 2, 5) },
        colors,
      );
      drawNode(ctx, { ...ended, variant: "muted", title: "ended", subtitle: "history kept for insights", alpha: stage(progress, 3, 5) }, colors);
      drawNode(ctx, { ...rejected, variant: "outline", title: "rejected", alpha: stage(progress, 4, 5) }, colors);

      const e = stage(progress, 2.6, 5);
      drawEdge(ctx, routeElbow(anchor(proposed, "right"), "right", anchor(approved, "left"), "left"), colors, {
        alpha: e,
        label: "approve",
      });
      drawEdge(ctx, routeElbow(anchor(approved, "right"), "right", anchor(applied, "left"), "left"), colors, {
        alpha: e,
        color: colors.success,
        label: "apply",
      });
      drawEdge(ctx, routeElbow(anchor(applied, "right"), "right", anchor(ended, "left"), "left"), colors, {
        alpha: e,
        label: "end",
      });
      drawEdge(ctx, routeElbow(anchor(proposed, "bottom"), "bottom", anchor(rejected, "left"), "left"), colors, {
        alpha: stage(progress, 4.2, 5),
        dashed: true,
      });
      drawEdge(ctx, routeElbow(anchor(approved, "bottom"), "bottom", anchor(rejected, "top"), "top"), colors, {
        alpha: stage(progress, 4.2, 5),
        dashed: true,
        label: "reject",
      });
      return;
    }

    // A lane on the left carries the reject branch past the states it skips,
    // rather than drawing a line straight through them.
    const lane = 20;
    const stackX = padX + lane;
    const w = width - stackX - padX;
    const h = 52;
    const y = (i: number) => 10 + i * (h + 26);
    const stack: Box[] = [0, 1, 2, 3].map((i) => ({ x: stackX, y: y(i), w, h }));
    const rejected: Box = { x: stackX + w * 0.25, y: y(4), w: w * 0.5, h: 44 };

    drawNode(ctx, { ...stack[0], title: "proposed", subtitle: "computed from 90d orders", alpha: stage(progress, 0, 5) }, colors);
    drawNode(ctx, { ...stack[1], title: "approved", subtitle: "still not live", alpha: stage(progress, 1, 5) }, colors);
    drawNode(ctx, { ...stack[2], variant: "success", title: "applied", subtitle: "live to buyers", alpha: stage(progress, 2, 5) }, colors);
    drawNode(ctx, { ...stack[3], variant: "muted", title: "ended", alpha: stage(progress, 3, 5) }, colors);
    drawNode(ctx, { ...rejected, variant: "outline", title: "rejected", alpha: stage(progress, 4, 5) }, colors);

    const e = stage(progress, 2.6, 5);
    const labels = ["approve", "apply", "end"];
    for (let i = 0; i < 3; i++) {
      drawEdge(ctx, routeElbow(anchor(stack[i], "bottom"), "bottom", anchor(stack[i + 1], "top"), "top"), colors, {
        alpha: e,
        label: labels[i],
        color: i === 1 ? colors.success : colors.mutedForeground,
      });
    }
    // Reject leaves from `approved` (and equally from `proposed`), never from
    // `ended` — so it runs down the left lane instead of continuing the stack.
    const from = anchor(stack[1], "left");
    const to = anchor(rejected, "left");
    drawEdge(
      ctx,
      [from, { x: padX, y: from.y }, { x: padX, y: to.y }, to],
      colors,
      { alpha: stage(progress, 4.2, 5), dashed: true, label: "reject" },
    );
  });

  return (
    <DiagramFrame
      title="Campaign state machine"
      caption="Every transition is an explicit merchant-admin action, and each one enforces the exact prior status. Approving a proposal deliberately changes nothing a buyer can see — only apply makes the discount real, and even then it's read live at price time (respecting the optional start/end window) rather than written into the catalog price."
    >
      <canvas
        ref={ref}
        className="block h-[390px] w-full md:h-[220px]"
        role="img"
        aria-label="Campaign states: proposed, then approved, then applied (the only state visible to buyers), then ended. Proposed or approved campaigns can instead be rejected."
      />
    </DiagramFrame>
  );
}
