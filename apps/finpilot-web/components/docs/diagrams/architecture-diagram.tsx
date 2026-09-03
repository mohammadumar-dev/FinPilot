"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import { anchor, drawEdge, drawGroup, drawLegend, drawNode, routeElbow, stage, type Box } from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

/**
 * The system's central claim, drawn: two independent front doors — a human in
 * the chat UI and any external AI agent over MCP — terminate in the same
 * Merchant Checkout Core, which is the only thing that touches Postgres or
 * Razorpay. The dashed return edge is Razorpay's webhook, the one inbound
 * path nobody in the diagram initiated.
 */
export function ArchitectureDiagram() {
  const ref = useThemedCanvas((ctx, { width, height, colors, progress }) => {
    const padX = 16;
    const wide = width >= 780;
    const legendY = height - 12;

    if (wide) {
      const gap = 30;
      const sideW = Math.min(172, (width - padX * 2) * 0.23);
      const groupX = padX + sideW + gap;
      const groupW = width - padX * 2 - (sideW + gap) * 2;
      const groupY = 20;
      const groupH = height - groupY - 44;
      const innerPad = 15;
      const innerX = groupX + innerPad;
      const innerW = groupW - innerPad * 2;

      const rowH = 50;
      const coreH = 56;
      const vGap = (groupH - innerPad * 2 - rowH * 2 - coreH) / 2;

      const chatLoop: Box = { x: innerX, y: groupY + innerPad, w: innerW, h: rowH };
      const core: Box = { x: innerX, y: chatLoop.y + rowH + vGap, w: innerW, h: coreH };
      const mcp: Box = { x: innerX, y: core.y + coreH + vGap, w: innerW, h: rowH };

      const buyer: Box = { x: padX, y: chatLoop.y - 4, w: sideW, h: 58 };
      const agent: Box = { x: padX, y: mcp.y - 4, w: sideW, h: 58 };
      const db: Box = { x: width - padX - sideW, y: chatLoop.y - 4, w: sideW, h: 58 };
      const pay: Box = { x: width - padX - sideW, y: mcp.y - 4, w: sideW, h: 58 };

      drawGroup(ctx, { x: groupX, y: groupY, w: groupW, h: groupH }, "Merchant Checkout Core", colors, {
        alpha: stage(progress, 0, 7),
      });

      drawNode(ctx, { ...buyer, eyebrow: "Front door 1", title: "Human buyer", subtitle: "Next.js chat UI", alpha: stage(progress, 1, 7) }, colors);
      drawNode(ctx, { ...agent, eyebrow: "Front door 2", title: "External AI agent", subtitle: "MCP client + scoped key", alpha: stage(progress, 2, 7) }, colors);
      drawNode(ctx, { ...chatLoop, title: "Buyer-agent chat loop", subtitle: "FastAPI · tool-calling", alpha: stage(progress, 3, 7) }, colors);
      drawNode(
        ctx,
        {
          ...core,
          variant: "brand",
          title: "Shared services",
          subtitle: "catalog · pricing · orders · audit",
          alpha: stage(progress, 4, 7),
        },
        colors,
      );
      drawNode(ctx, { ...mcp, title: "Agent Checkout MCP server", subtitle: "separate process · :8100", alpha: stage(progress, 5, 7) }, colors);
      drawNode(ctx, { ...db, variant: "muted", title: "PostgreSQL", subtitle: "orders · audit · wallets", alpha: stage(progress, 6, 7) }, colors);
      drawNode(ctx, { ...pay, variant: "muted", title: "Razorpay", subtitle: "test-mode payment links", alpha: stage(progress, 6, 7) }, colors);

      const edgeAlpha = stage(progress, 5.5, 7);
      drawEdge(ctx, routeElbow(anchor(buyer, "right"), "right", anchor(chatLoop, "left"), "left"), colors, { alpha: edgeAlpha });
      drawEdge(ctx, routeElbow(anchor(agent, "right"), "right", anchor(mcp, "left"), "left"), colors, { alpha: edgeAlpha });
      drawEdge(ctx, routeElbow(anchor(chatLoop, "bottom"), "bottom", anchor(core, "top"), "top"), colors, {
        alpha: edgeAlpha,
        color: colors.brand,
      });
      drawEdge(ctx, routeElbow(anchor(mcp, "top"), "top", anchor(core, "bottom"), "bottom"), colors, {
        alpha: edgeAlpha,
        color: colors.brand,
      });
      drawEdge(ctx, routeElbow(anchor(core, "right", 0.3), "right", anchor(db, "left"), "left"), colors, { alpha: edgeAlpha });
      drawEdge(ctx, routeElbow(anchor(core, "right", 0.72), "right", anchor(pay, "left"), "left"), colors, { alpha: edgeAlpha });

      drawLegend(
        ctx,
        [
          { label: "request path", color: colors.mutedForeground },
          { label: "shared core — one implementation, both doors", color: colors.brand },
        ],
        padX,
        legendY,
        colors,
        stage(progress, 6.5, 7),
      );
      return;
    }

    // Narrow: the two front doors sit side by side with their own adapter
    // directly beneath each, so nothing has to cross anything else to reach
    // the shared services row.
    const colW = (width - padX * 2 - 14) / 2;
    const colRightX = padX + colW + 14;
    const rowH = 54;

    const buyer: Box = { x: padX, y: 12, w: colW, h: rowH };
    const agent: Box = { x: colRightX, y: 12, w: colW, h: rowH };

    const groupY = buyer.y + rowH + 28;
    const innerPad = 13;
    const innerW = width - padX * 2 - innerPad * 2;
    const innerColW = (innerW - 12) / 2;
    const chatLoop: Box = { x: padX + innerPad, y: groupY + innerPad, w: innerColW, h: 46 };
    const mcp: Box = { x: padX + innerPad + innerColW + 12, y: chatLoop.y, w: innerColW, h: 46 };
    const core: Box = { x: padX + innerPad, y: chatLoop.y + 46 + 22, w: innerW, h: 50 };
    const groupH = innerPad * 2 + 46 + 22 + 50;

    const infraY = groupY + groupH + 28;
    const db: Box = { x: padX, y: infraY, w: colW, h: rowH };
    const pay: Box = { x: colRightX, y: infraY, w: colW, h: rowH };

    drawGroup(ctx, { x: padX, y: groupY, w: width - padX * 2, h: groupH }, "Merchant Checkout Core", colors, {
      alpha: stage(progress, 0, 7),
    });
    drawNode(ctx, { ...buyer, title: "Human buyer", subtitle: "chat UI", alpha: stage(progress, 1, 7) }, colors);
    drawNode(ctx, { ...agent, title: "External agent", subtitle: "MCP client", alpha: stage(progress, 2, 7) }, colors);
    drawNode(ctx, { ...chatLoop, title: "Chat loop", subtitle: "FastAPI", alpha: stage(progress, 3, 7) }, colors);
    drawNode(ctx, { ...mcp, title: "MCP server", subtitle: ":8100", alpha: stage(progress, 4, 7) }, colors);
    drawNode(
      ctx,
      { ...core, variant: "brand", title: "Shared services", subtitle: "catalog · orders · audit", alpha: stage(progress, 5, 7) },
      colors,
    );
    drawNode(ctx, { ...db, variant: "muted", title: "PostgreSQL", alpha: stage(progress, 6, 7) }, colors);
    drawNode(ctx, { ...pay, variant: "muted", title: "Razorpay", alpha: stage(progress, 6, 7) }, colors);

    const edgeAlpha = stage(progress, 5.5, 7);
    drawEdge(ctx, routeElbow(anchor(buyer, "bottom"), "bottom", anchor(chatLoop, "top"), "top"), colors, { alpha: edgeAlpha });
    drawEdge(ctx, routeElbow(anchor(agent, "bottom"), "bottom", anchor(mcp, "top"), "top"), colors, { alpha: edgeAlpha });
    drawEdge(ctx, routeElbow(anchor(chatLoop, "bottom"), "bottom", anchor(core, "top", 0.25), "top"), colors, {
      alpha: edgeAlpha,
      color: colors.brand,
    });
    drawEdge(ctx, routeElbow(anchor(mcp, "bottom"), "bottom", anchor(core, "top", 0.75), "top"), colors, {
      alpha: edgeAlpha,
      color: colors.brand,
    });
    drawEdge(ctx, routeElbow(anchor(core, "bottom", 0.25), "bottom", anchor(db, "top"), "top"), colors, { alpha: edgeAlpha });
    drawEdge(ctx, routeElbow(anchor(core, "bottom", 0.75), "bottom", anchor(pay, "top"), "top"), colors, { alpha: edgeAlpha });
  });

  return (
    <DiagramFrame
      title="System architecture"
      caption="A human buyer reaches the Merchant Checkout Core through the Next.js chat UI and the FastAPI buyer-agent loop; any external AI agent reaches the same core through the standalone Agent Checkout MCP server using a scoped API key. Only the core talks to PostgreSQL and Razorpay — and Razorpay calls back into it asynchronously over a signature-verified webhook, which the order lifecycle below draws in full."
    >
      <canvas
        ref={ref}
        className="block h-[380px] w-full md:h-[330px]"
        role="img"
        aria-label="System architecture diagram: a human buyer and an external AI agent each enter through their own front door — the chat loop and the MCP server — both of which call one shared Merchant Checkout Core, which is the only component talking to PostgreSQL and Razorpay."
      />
    </DiagramFrame>
  );
}
