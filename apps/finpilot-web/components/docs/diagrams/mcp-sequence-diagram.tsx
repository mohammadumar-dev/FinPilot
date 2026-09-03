"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import { drawEdge, drawNode, drawStepMarker, drawText, stage, type Box } from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

const LANES = ["External agent", "Auth middleware", "MCP tool", "Checkout core", "Razorpay"];

type Message = {
  from: number;
  to: number;
  label: string;
  mono?: boolean;
  dashed?: boolean;
  self?: boolean;
  tone?: "default" | "brand" | "success";
};

const MESSAGES: Message[] = [
  { from: 0, to: 1, label: "Authorization: Bearer fp_live_…", mono: true },
  { from: 1, to: 1, label: "bcrypt verify · not revoked", self: true },
  { from: 1, to: 2, label: "AgentIdentity → ContextVar", tone: "brand" },
  { from: 2, to: 3, label: "create_order(product_id, key)", mono: true },
  { from: 3, to: 3, label: "re-derive price + stock · check caps", self: true },
  { from: 3, to: 4, label: "create payment link", tone: "brand" },
  { from: 4, to: 0, label: "order_id · status · payment_link", dashed: true, tone: "success" },
];

const STEPS = [
  { actor: "External agent → Auth", title: "Presents its scoped key", body: "Authorization: Bearer fp_live_…" },
  { actor: "Auth middleware", title: "Resolves the agent client", body: "bcrypt verify against non-revoked clients, fresh every request" },
  { actor: "Auth → MCP tool", title: "Hands over identity", body: "AgentIdentity in a ContextVar — MCP tools run outside FastAPI DI" },
  { actor: "MCP tool → Core", title: "Calls the shared service", body: "create_order(product_id, idempotency_key, quantity)" },
  { actor: "Checkout core", title: "Re-derives everything", body: "price, stock, then the per-order cap and the daily rate limit" },
  { actor: "Core → Razorpay", title: "Creates the payment link", body: "only once every check has passed" },
  { actor: "Core → agent", title: "Returns the order", body: "order_id, status, payment_link — or a typed error code" },
];

/** A request as it actually travels: agent → auth → tool → shared core →
 * Razorpay, with the two checks that can stop it drawn on the lane that
 * performs them. */
export function McpSequenceDiagram() {
  const ref = useThemedCanvas((ctx, { width, height, colors, progress }) => {
    const wide = width >= 720;

    if (!wide) {
      // Lifelines don't survive a phone-width canvas — the same exchange
      // reads better as an ordered list of who does what.
      const padX = 14;
      const h = 54;
      const gapY = 12;
      STEPS.forEach((step, i) => {
        const alpha = stage(progress, i, STEPS.length);
        const box: Box = { x: padX + 26, y: 10 + i * (h + gapY), w: width - padX * 2 - 26, h };
        drawNode(
          ctx,
          { ...box, align: "left", eyebrow: step.actor, title: step.title, subtitle: step.body, alpha },
          colors,
        );
        drawStepMarker(ctx, i + 1, padX + 11, box.y + h / 2, colors, { alpha });
      });
      return;
    }

    const padX = 12;
    const laneW = (width - padX * 2) / LANES.length;
    const centerX = (i: number) => padX + laneW * i + laneW / 2;
    const headerY = 10;
    const headerH = 44;
    const lifelineTop = headerY + headerH;
    const firstMessageY = lifelineTop + 34;
    const spacing = (height - firstMessageY - 22) / (MESSAGES.length - 1);

    LANES.forEach((lane, i) => {
      const alpha = stage(progress, i * 0.4, LANES.length);
      drawNode(
        ctx,
        {
          x: padX + laneW * i + 6,
          y: headerY,
          w: laneW - 12,
          h: headerH,
          title: lane,
          variant: i === 3 ? "brand" : "surface",
          radius: 10,
          alpha,
        },
        colors,
      );
      // Lifeline
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX(i), lifelineTop + 4);
      ctx.lineTo(centerX(i), height - 14);
      ctx.stroke();
      ctx.restore();
    });

    MESSAGES.forEach((msg, i) => {
      const alpha = stage(progress, i + 1, MESSAGES.length + 1);
      const y = firstMessageY + spacing * i;
      const color =
        msg.tone === "brand" ? colors.brand : msg.tone === "success" ? colors.success : colors.mutedForeground;

      if (msg.self) {
        const x = centerX(msg.from);
        const w = Math.min(46, laneW * 0.34);
        drawEdge(
          ctx,
          [
            { x, y: y - 9 },
            { x: x + w, y: y - 9 },
            { x: x + w, y: y + 9 },
            { x: x + 2, y: y + 9 },
          ],
          colors,
          { alpha, color, cornerRadius: 6, width: 1.4 },
        );
        drawText(ctx, msg.label, x + w + 10, y, {
          color: colors.mutedForeground,
          size: 10,
          alpha,
          maxWidth: laneW * 1.5,
        });
      } else {
        const from = centerX(msg.from);
        const to = centerX(msg.to);
        const dir = Math.sign(to - from);
        drawEdge(
          ctx,
          [
            { x: from + dir * 4, y },
            { x: to - dir * 4, y },
          ],
          colors,
          { alpha, color, dashed: msg.dashed, width: 1.5 },
        );
        drawText(ctx, msg.label, (from + to) / 2, y - 11, {
          color: colors.mutedForeground,
          size: 10,
          align: "center",
          alpha,
          mono: msg.mono,
          maxWidth: Math.abs(to - from) - 16,
        });
      }
      drawStepMarker(ctx, i + 1, centerX(msg.from) - (msg.self ? 16 : 0), msg.self ? y : y, colors, {
        alpha,
        radius: 8,
        color: colors.card,
        fg: colors.mutedForeground,
      });
    });
  });

  return (
    <DiagramFrame
      title="External agent request, end to end"
      caption="The scoped API key is verified on every single request (revocation is never cached), the resolved identity travels in a ContextVar because MCP tools run outside FastAPI's dependency injection, and the per-order cap plus daily rate limit are checked inside the shared core — before Razorpay is ever contacted."
    >
      <canvas
        ref={ref}
        className="block h-[470px] w-full md:h-[330px]"
        role="img"
        aria-label="Sequence: the external agent sends its bearer key to the auth middleware, which bcrypt-verifies it against non-revoked clients and passes an AgentIdentity to the MCP tool. The tool calls the shared checkout core, which re-derives price and stock, checks the spend cap and rate limit, creates a Razorpay payment link, and returns the order id, status and payment link to the agent."
      />
    </DiagramFrame>
  );
}
