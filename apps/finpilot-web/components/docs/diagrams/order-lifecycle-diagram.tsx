"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import { anchor, drawEdge, drawNode, routeElbow, stage, type Box } from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

/**
 * Order status as the state machine it is. Two things the code guarantees and
 * the drawing should show: nothing but a webhook or a poll can move an order
 * out of `pending`, and a failed order is *reactivated in place* on retry
 * rather than duplicated into a second row.
 */
export function OrderLifecycleDiagram() {
  const ref = useThemedCanvas((ctx, { width, height, colors, progress }) => {
    const wide = width >= 640;

    if (wide) {
      const padX = 16;
      const cw = Math.min(178, (width - padX * 2 - 60) / 3);
      const h = 56;
      const midY = height / 2 - 34;

      const created: Box = { x: padX, y: midY, w: cw, h };
      const pending: Box = { x: width / 2 - cw / 2, y: midY, w: cw, h };
      const paid: Box = { x: width - padX - cw, y: midY - 40, w: cw, h };
      const failed: Box = { x: width - padX - cw, y: midY + 54, w: cw, h };

      drawNode(
        ctx,
        { ...created, eyebrow: "initial", title: "created", subtitle: "stock held · price fixed", alpha: stage(progress, 0, 4) },
        colors,
      );
      drawNode(
        ctx,
        { ...pending, variant: "brand", title: "pending", subtitle: "payment link open", alpha: stage(progress, 1, 4) },
        colors,
      );
      drawNode(
        ctx,
        { ...paid, variant: "success", eyebrow: "terminal", title: "paid", subtitle: "wallet / order settled", alpha: stage(progress, 2, 4) },
        colors,
      );
      drawNode(
        ctx,
        { ...failed, variant: "outline", eyebrow: "terminal", title: "failed", subtitle: "expired · cancelled · declined", alpha: stage(progress, 3, 4) },
        colors,
      );

      const e = stage(progress, 2.4, 4);
      drawEdge(ctx, routeElbow(anchor(created, "right"), "right", anchor(pending, "left"), "left"), colors, {
        alpha: e,
        label: "link issued",
      });
      drawEdge(ctx, routeElbow(anchor(pending, "right"), "right", anchor(paid, "left"), "left"), colors, {
        alpha: e,
        color: colors.success,
        label: "webhook or poll",
      });
      drawEdge(ctx, routeElbow(anchor(pending, "right", 0.85), "right", anchor(failed, "left"), "left"), colors, {
        alpha: e,
        dashed: true,
        label: "expiry / decline",
      });
      drawEdge(
        ctx,
        [
          anchor(failed, "bottom"),
          { x: failed.x + failed.w / 2, y: failed.y + failed.h + 26 },
          { x: created.x + created.w / 2, y: failed.y + failed.h + 26 },
          anchor(created, "bottom"),
        ],
        colors,
        { alpha: stage(progress, 3.4, 4), color: colors.chart2, dashed: true, label: "retry reuses the same row" },
      );
      return;
    }

    const padX = 14;
    const w = width - padX * 2;
    const h = 52;
    const y = (i: number) => 12 + i * (h + 30);

    const created: Box = { x: padX, y: y(0), w, h };
    const pending: Box = { x: padX, y: y(1), w, h };
    const outW = (w - 12) / 2;
    const paid: Box = { x: padX, y: y(2), w: outW, h };
    const failed: Box = { x: padX + outW + 12, y: y(2), w: outW, h };

    drawNode(ctx, { ...created, title: "created", subtitle: "stock held", alpha: stage(progress, 0, 4) }, colors);
    drawNode(ctx, { ...pending, variant: "brand", title: "pending", subtitle: "payment link open", alpha: stage(progress, 1, 4) }, colors);
    drawNode(ctx, { ...paid, variant: "success", title: "paid", alpha: stage(progress, 2, 4) }, colors);
    drawNode(ctx, { ...failed, variant: "outline", title: "failed", alpha: stage(progress, 3, 4) }, colors);

    const e = stage(progress, 2.4, 4);
    drawEdge(ctx, routeElbow(anchor(created, "bottom"), "bottom", anchor(pending, "top"), "top"), colors, { alpha: e });
    drawEdge(ctx, routeElbow(anchor(pending, "bottom", 0.25), "bottom", anchor(paid, "top"), "top"), colors, {
      alpha: e,
      color: colors.success,
      label: "webhook / poll",
    });
    drawEdge(ctx, routeElbow(anchor(pending, "bottom", 0.75), "bottom", anchor(failed, "top"), "top"), colors, {
      alpha: e,
      dashed: true,
    });
  });

  return (
    <DiagramFrame
      title="Order lifecycle"
      caption="A client never sets status directly. pending leaves only when Razorpay says so — through the signature-verified webhook, or through the polling fallback that check_payment_status triggers when the webhook hasn't landed. On the chat path a failed order is reactivated in place on retry, keeping one row per buyer-and-product rather than accumulating dead duplicates."
    >
      <canvas
        ref={ref}
        className="block h-[250px] w-full md:h-[230px]"
        role="img"
        aria-label="Order lifecycle state machine: created moves to pending once a payment link is issued; pending moves to the terminal state paid via webhook or polling, or to the terminal state failed on expiry, cancellation or decline. A retry of a failed order reuses the same row."
      />
    </DiagramFrame>
  );
}
