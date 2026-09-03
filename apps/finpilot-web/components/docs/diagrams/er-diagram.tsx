"use client";

import { useThemedCanvas, type DocsCanvasColors } from "@/lib/docs/use-themed-canvas";
import {
  anchor,
  drawEdge,
  drawText,
  fitText,
  roundRectPath,
  routeElbow,
  setFont,
  stage,
  type Box,
} from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

type Entity = { name: string; fields: string[]; accent?: boolean };

const ORDERS: Entity = {
  name: "orders",
  fields: ["id · PK", "user_id · FK?", "agent_client_id · FK?", "product_id · FK", "merchant_id · FK", "idempotency_key · UQ", "status · placed_by"],
  accent: true,
};
const USERS: Entity = { name: "users", fields: ["id · PK", "email · UQ", "role", "merchant_id · FK?"] };
const AGENT_CLIENTS: Entity = {
  name: "agent_clients",
  fields: ["id · PK", "api_key_hash", "max_order_amount_paise", "max_orders_per_day", "revoked"],
};
const PRODUCTS: Entity = { name: "products", fields: ["id · PK", "merchant_id · FK", "price_paise", "cost_price_paise?", "stock_quantity"] };
const MERCHANTS: Entity = { name: "merchants", fields: ["id · PK", "slug · UQ", "sku_prefix"] };

const HEADER_H = 25;
const ROW_H = 14.5;
const PAD_Y = 8;

function entityHeight(entity: Entity, maxFields: number) {
  return HEADER_H + Math.min(entity.fields.length, maxFields) * ROW_H + PAD_Y;
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  box: Box,
  entity: Entity,
  c: DocsCanvasColors,
  alpha: number,
  maxFields: number,
) {
  if (alpha <= 0.001) return;
  const lift = (1 - alpha) * 10;
  const y = box.y + lift;
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.save();
  ctx.shadowColor = c.isDark ? "rgba(0,0,0,0.45)" : "rgba(40,32,22,0.12)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  roundRectPath(ctx, { ...box, y }, 10);
  ctx.fillStyle = c.card;
  ctx.fill();
  ctx.restore();

  // Header strip
  ctx.save();
  roundRectPath(ctx, { ...box, y }, 10);
  ctx.clip();
  ctx.fillStyle = entity.accent ? c.brand : c.muted;
  ctx.fillRect(box.x, y, box.w, HEADER_H);
  ctx.restore();

  roundRectPath(ctx, { ...box, y }, 10);
  ctx.strokeStyle = entity.accent ? c.brand : c.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawText(ctx, entity.name, box.x + 10, y + HEADER_H / 2, {
    color: entity.accent ? c.brandForeground : c.foreground,
    size: 11.5,
    weight: 700,
    mono: true,
    maxWidth: box.w - 20,
  });

  setFont(ctx, { size: 10, mono: true, weight: 450 });
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  entity.fields.slice(0, maxFields).forEach((field, i) => {
    const [column, marker] = field.split(" · ");
    const rowY = y + HEADER_H + PAD_Y / 2 + i * ROW_H + ROW_H / 2 - 1;
    ctx.fillStyle = c.foreground;
    setFont(ctx, { size: 10, mono: true, weight: 450 });
    const columnText = fitText(ctx, column, box.w - 20 - (marker ? 34 : 0));
    ctx.fillText(columnText, box.x + 10, rowY);
    if (marker) {
      ctx.textAlign = "right";
      ctx.fillStyle = c.mutedForeground;
      setFont(ctx, { size: 8.5, mono: true, weight: 600 });
      ctx.fillText(marker, box.x + box.w - 10, rowY);
      ctx.textAlign = "left";
    }
  });

  ctx.restore();
}

/**
 * The orders table sits at the intersection of four foreign keys — and the
 * two identity columns are mutually exclusive, which is the whole "one table,
 * two front doors" design in a single row.
 */
export function ErDiagram() {
  const ref = useThemedCanvas((ctx, { width, height, colors, progress }) => {
    const wide = width >= 780;
    const padX = 14;

    if (wide) {
      const sideW = Math.min(190, (width - padX * 2) * 0.25);
      const centerW = Math.min(230, (width - padX * 2) * 0.3);
      const centerX = width / 2 - centerW / 2;
      const rightX = width - padX - sideW;

      const ordersH = entityHeight(ORDERS, 7);
      const orders: Box = { x: centerX, y: height / 2 - ordersH / 2, w: centerW, h: ordersH };
      const users: Box = { x: padX, y: 16, w: sideW, h: entityHeight(USERS, 4) };
      const agents: Box = { x: padX, y: height - 16 - entityHeight(AGENT_CLIENTS, 5), w: sideW, h: entityHeight(AGENT_CLIENTS, 5) };
      const products: Box = { x: rightX, y: 16, w: sideW, h: entityHeight(PRODUCTS, 5) };
      const merchants: Box = { x: rightX, y: height - 16 - entityHeight(MERCHANTS, 3), w: sideW, h: entityHeight(MERCHANTS, 3) };

      drawEntity(ctx, orders, ORDERS, colors, stage(progress, 0, 5), 7);
      drawEntity(ctx, users, USERS, colors, stage(progress, 1, 5), 4);
      drawEntity(ctx, agents, AGENT_CLIENTS, colors, stage(progress, 2, 5), 5);
      drawEntity(ctx, products, PRODUCTS, colors, stage(progress, 3, 5), 5);
      drawEntity(ctx, merchants, MERCHANTS, colors, stage(progress, 4, 5), 3);

      const e = stage(progress, 4, 5);
      drawEdge(ctx, routeElbow(anchor(users, "right"), "right", anchor(orders, "left", 0.25), "left"), colors, {
        alpha: e,
        label: "user_id?",
      });
      drawEdge(ctx, routeElbow(anchor(agents, "right"), "right", anchor(orders, "left", 0.75), "left"), colors, {
        alpha: e,
        label: "agent_client_id?",
      });
      drawEdge(ctx, routeElbow(anchor(orders, "right", 0.25), "right", anchor(products, "left"), "left"), colors, {
        alpha: e,
        label: "product_id",
      });
      drawEdge(ctx, routeElbow(anchor(orders, "right", 0.75), "right", anchor(merchants, "left"), "left"), colors, {
        alpha: e,
        label: "merchant_id",
      });
      return;
    }

    const w = width - padX * 2;
    const half = (w - 12) / 2;
    let y = 12;
    const usersBox: Box = { x: padX, y, w: half, h: entityHeight(USERS, 4) };
    const agentsBox: Box = { x: padX + half + 12, y, w: half, h: entityHeight(AGENT_CLIENTS, 4) };
    y += Math.max(usersBox.h, agentsBox.h) + 34;
    const ordersBox: Box = { x: padX, y, w, h: entityHeight(ORDERS, 7) };
    y += ordersBox.h + 34;
    const productsBox: Box = { x: padX, y, w: half, h: entityHeight(PRODUCTS, 4) };
    const merchantsBox: Box = { x: padX + half + 12, y, w: half, h: entityHeight(MERCHANTS, 3) };

    drawEntity(ctx, usersBox, USERS, colors, stage(progress, 1, 5), 4);
    drawEntity(ctx, agentsBox, AGENT_CLIENTS, colors, stage(progress, 2, 5), 4);
    drawEntity(ctx, ordersBox, ORDERS, colors, stage(progress, 0, 5), 7);
    drawEntity(ctx, productsBox, PRODUCTS, colors, stage(progress, 3, 5), 4);
    drawEntity(ctx, merchantsBox, MERCHANTS, colors, stage(progress, 4, 5), 3);

    const e = stage(progress, 4, 5);
    drawEdge(ctx, routeElbow(anchor(usersBox, "bottom"), "bottom", anchor(ordersBox, "top", 0.25), "top"), colors, { alpha: e });
    drawEdge(ctx, routeElbow(anchor(agentsBox, "bottom"), "bottom", anchor(ordersBox, "top", 0.75), "top"), colors, { alpha: e });
    drawEdge(ctx, routeElbow(anchor(ordersBox, "bottom", 0.25), "bottom", anchor(productsBox, "top"), "top"), colors, { alpha: e });
    drawEdge(ctx, routeElbow(anchor(ordersBox, "bottom", 0.75), "bottom", anchor(merchantsBox, "top"), "top"), colors, { alpha: e });
  });

  return (
    <DiagramFrame
      title="Orders sit at the centre of four keys"
      caption="user_id and agent_client_id are both nullable and mutually exclusive — a buyer-chat order carries the first, an external-agent order the second — which is how one table, one audit trail and one set of guarantees serve both front doors. A trailing ? marks a nullable column, UQ a unique index."
    >
      <canvas
        ref={ref}
        className="block h-[420px] w-full md:h-[330px]"
        role="img"
        aria-label="Entity relationship diagram: the orders table references users (nullable), agent_clients (nullable), products and merchants by foreign key, with a unique index on idempotency_key."
      />
    </DiagramFrame>
  );
}
