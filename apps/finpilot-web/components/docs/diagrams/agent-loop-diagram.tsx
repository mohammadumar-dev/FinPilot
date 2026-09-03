"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import {
  anchor,
  drawEdge,
  drawNode,
  routeElbow,
  stage,
  type Box,
  type Point,
} from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

/** A return path that rises out of the row before doubling back, so the loop
 * reads as a loop instead of a line drawn on top of the nodes. */
function loopBack(from: Point, to: Point, rise: number): Point[] {
  return [from, { x: from.x, y: from.y - rise }, { x: to.x, y: to.y - rise }, to];
}

/**
 * The buyer-agent turn. The important shape here is that it's a *cycle* —
 * the model calls a tool, the result is appended, and it runs again, up to 12
 * times — and that the one edge leading to a real order passes through a gate
 * that needs two independent facts to be true.
 */
export function AgentLoopDiagram() {
  const ref = useThemedCanvas((ctx, { width, colors, progress }) => {
    const wide = width >= 760;

    if (wide) {
      const padX = 16;
      const gap = 22;
      const cw = (width - padX * 2 - gap * 3) / 4;
      const colX = (i: number) => padX + i * (cw + gap);

      const rowA = 34;
      const rowB = 138;
      const rowC = 238;

      const message: Box = { x: colX(0), y: rowA, w: cw, h: 54 };
      const llm: Box = { x: colX(1), y: rowA, w: cw, h: 54 };
      const tool: Box = { x: colX(2), y: rowA, w: cw, h: 54 };
      const reply: Box = { x: colX(1), y: rowB, w: cw, h: 54 };
      const gate: Box = { x: colX(2), y: rowB, w: cw, h: 58 };
      const blocked: Box = { x: colX(2), y: rowC, w: cw, h: 50 };
      const order: Box = { x: colX(3), y: rowC, w: cw, h: 50 };

      drawNode(ctx, { ...message, title: "Buyer message", subtitle: "persisted, then replayed", alpha: stage(progress, 0, 7) }, colors);
      drawNode(
        ctx,
        { ...llm, variant: "brand", title: "LLM turn", subtitle: "tool_choice: auto · T 0.3", alpha: stage(progress, 1, 7) },
        colors,
      );
      drawNode(ctx, { ...tool, title: "Execute tool", subtitle: "catalog · orders · payments", alpha: stage(progress, 2, 7) }, colors);
      drawNode(ctx, { ...reply, title: "Agent reply", subtitle: "end of turn", alpha: stage(progress, 3, 7) }, colors);
      drawNode(
        ctx,
        {
          ...gate,
          variant: "warning",
          eyebrow: "gate",
          title: "Confirmed AND shown?",
          subtitle: "both, or nothing happens",
          alpha: stage(progress, 4, 7),
        },
        colors,
      );
      drawNode(
        ctx,
        { ...blocked, variant: "outline", title: "confirmation_required", subtitle: "audited as blocked", alpha: stage(progress, 5, 7) },
        colors,
      );
      drawNode(
        ctx,
        { ...order, variant: "success", title: "Order created", subtitle: "+ Razorpay link", alpha: stage(progress, 6, 7) },
        colors,
      );

      const eA = stage(progress, 2.2, 7);
      const eB = stage(progress, 4.4, 7);
      const eC = stage(progress, 6.2, 7);

      drawEdge(ctx, routeElbow(anchor(message, "right"), "right", anchor(llm, "left"), "left"), colors, { alpha: eA });
      // No label on this hop: the gap between adjacent columns is narrower
      // than the chip would be, and the return edge above already names what
      // is travelling in each direction.
      drawEdge(ctx, routeElbow(anchor(llm, "right"), "right", anchor(tool, "left"), "left"), colors, { alpha: eA });
      drawEdge(ctx, loopBack(anchor(tool, "top", 0.5), anchor(llm, "top", 0.5), 24), colors, {
        alpha: eB,
        color: colors.brand,
        label: "result appended · ≤ 12×",
      });
      drawEdge(ctx, routeElbow(anchor(llm, "bottom"), "bottom", anchor(reply, "top"), "top"), colors, {
        alpha: eB,
        label: "no tool calls",
      });
      drawEdge(ctx, routeElbow(anchor(tool, "bottom"), "bottom", anchor(gate, "top"), "top"), colors, {
        alpha: eB,
        label: "create_order",
      });
      drawEdge(ctx, routeElbow(anchor(gate, "bottom"), "bottom", anchor(blocked, "top"), "top"), colors, {
        alpha: eC,
        color: colors.mutedForeground,
        dashed: true,
        label: "fails either",
      });
      drawEdge(ctx, routeElbow(anchor(gate, "right"), "right", anchor(order, "top"), "top"), colors, {
        alpha: eC,
        color: colors.success,
        label: "passes both",
      });
      return;
    }

    // Narrow: the same cycle as a vertical stack, with the return path
    // running down a dedicated lane on the left.
    const lane = 22;
    const padX = 14 + lane;
    const w = width - padX - 14;
    const h = 48;
    const gapY = 26;
    const y = (i: number) => 14 + i * (h + gapY);

    const message: Box = { x: padX, y: y(0), w, h };
    const llm: Box = { x: padX, y: y(1), w, h };
    const tool: Box = { x: padX, y: y(2), w, h };
    const gate: Box = { x: padX, y: y(3), w, h };
    const outW = (w - 12) / 2;
    const blocked: Box = { x: padX, y: y(4), w: outW, h };
    const order: Box = { x: padX + outW + 12, y: y(4), w: outW, h };

    drawNode(ctx, { ...message, title: "Buyer message", alpha: stage(progress, 0, 6) }, colors);
    drawNode(ctx, { ...llm, variant: "brand", title: "LLM turn", subtitle: "tool_choice: auto", alpha: stage(progress, 1, 6) }, colors);
    drawNode(ctx, { ...tool, title: "Execute tool", subtitle: "shared core services", alpha: stage(progress, 2, 6) }, colors);
    drawNode(ctx, { ...gate, variant: "warning", title: "Confirmed AND shown?", alpha: stage(progress, 3, 6) }, colors);
    drawNode(ctx, { ...blocked, variant: "outline", title: "Blocked", alpha: stage(progress, 4, 6) }, colors);
    drawNode(ctx, { ...order, variant: "success", title: "Order", alpha: stage(progress, 5, 6) }, colors);

    const e = stage(progress, 3.5, 6);
    drawEdge(ctx, routeElbow(anchor(message, "bottom"), "bottom", anchor(llm, "top"), "top"), colors, { alpha: e });
    drawEdge(ctx, routeElbow(anchor(llm, "bottom"), "bottom", anchor(tool, "top"), "top"), colors, { alpha: e });
    drawEdge(ctx, routeElbow(anchor(tool, "bottom"), "bottom", anchor(gate, "top"), "top"), colors, { alpha: e, label: "create_order" });
    drawEdge(ctx, routeElbow(anchor(gate, "bottom", 0.25), "bottom", anchor(blocked, "top"), "top"), colors, { alpha: e, dashed: true });
    drawEdge(ctx, routeElbow(anchor(gate, "bottom", 0.75), "bottom", anchor(order, "top"), "top"), colors, { alpha: e, color: colors.success });

    const from = anchor(tool, "left");
    const to = anchor(llm, "left");
    drawEdge(
      ctx,
      [from, { x: padX - lane, y: from.y }, { x: padX - lane, y: to.y }, to],
      colors,
      { alpha: e, color: colors.brand },
    );
  });

  return (
    <DiagramFrame
      title="Buyer-agent turn"
      caption="Each turn replays the whole conversation, then loops: the model calls a tool, the result is appended, and it runs again — up to 12 iterations — until it answers with plain text instead. The only path to a real order runs through a gate that requires both an affirmative confirmation and prior sight of that exact product; failing either is recorded in the audit trail as blocked."
    >
      <canvas
        ref={ref}
        className="block h-[385px] w-full md:h-[310px]"
        role="img"
        aria-label="Buyer-agent loop: a buyer message feeds an LLM turn, which either replies with plain text (ending the turn) or calls a tool whose result loops back into the model, up to twelve times. A create_order call must pass a gate requiring both buyer confirmation and that the product was previously shown; failing either is blocked and audited, passing both creates the order and a Razorpay payment link."
      />
    </DiagramFrame>
  );
}
