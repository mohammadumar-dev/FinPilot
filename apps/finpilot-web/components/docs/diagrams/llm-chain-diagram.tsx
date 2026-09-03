"use client";

import { useThemedCanvas } from "@/lib/docs/use-themed-canvas";
import { drawEdge, drawNode, drawStepMarker, drawText, stage, type Box } from "@/lib/docs/diagram-kit";
import { DiagramFrame } from "@/components/docs/diagrams/diagram-frame";

/** Provider catalogues as configured in .env — the chain is built from these
 * at import time, so adding a provider is a key, not a code change. */
const PROVIDERS = [
  { name: "Groq", models: ["gpt-oss-120b", "qwen3.8-27b", "gpt-oss-20b"], limits: "30 rpm · 8k tpm" },
  { name: "NVIDIA", models: ["gpt-oss-120b", "nemotron-49b"], limits: "reactive only" },
  { name: "OpenRouter", models: ["minimax-m3", "ling-3.0-flash"], limits: "reactive only" },
  { name: "Gemini", models: ["flash-lite", "2.5-flash", "2.5-pro"], limits: "reactive only" },
];

/** Round-robin by rank: the chain takes every provider's flagship before it
 * touches anyone's fallback tier. */
function chainOrder(): Map<string, number> {
  const order = new Map<string, number>();
  const maxRank = Math.max(...PROVIDERS.map((p) => p.models.length));
  let position = 1;
  for (let rank = 0; rank < maxRank; rank++) {
    PROVIDERS.forEach((provider, providerIndex) => {
      if (rank < provider.models.length) order.set(`${providerIndex}:${rank}`, position++);
    });
  }
  return order;
}

/**
 * Why a single provider outage doesn't take checkout down: every
 * (provider, model) pair is its own quota bucket, and the fallback chain is
 * interleaved by rank rather than draining one provider's catalogue first.
 */
export function LlmChainDiagram() {
  const ref = useThemedCanvas((ctx, { width, colors, progress }) => {
    const order = chainOrder();
    const wide = width >= 700;
    const padX = 14;

    if (wide) {
      const gap = 14;
      const colW = (width - padX * 2 - gap * (PROVIDERS.length - 1)) / PROVIDERS.length;
      const headerY = 26;
      const headerH = 40;
      const chipH = 40;
      const chipGap = 10;

      PROVIDERS.forEach((provider, i) => {
        const x = padX + i * (colW + gap);
        const alpha = stage(progress, i * 0.5, 8);
        drawNode(
          ctx,
          {
            x,
            y: headerY,
            w: colW,
            h: headerH,
            variant: "muted",
            title: provider.name,
            subtitle: provider.limits,
            alpha,
            radius: 10,
          },
          colors,
        );

        provider.models.forEach((model, rank) => {
          const position = order.get(`${i}:${rank}`) ?? 0;
          const chipAlpha = stage(progress, 1.5 + position * 0.45, 8);
          const box: Box = {
            x,
            y: headerY + headerH + 16 + rank * (chipH + chipGap),
            w: colW,
            h: chipH,
          };
          drawNode(
            ctx,
            {
              ...box,
              title: model,
              variant: position === 1 ? "brand" : "surface",
              alpha: chipAlpha,
              radius: 9,
            },
            colors,
          );
          drawStepMarker(ctx, position, box.x + 12, box.y - 1, colors, {
            alpha: chipAlpha,
            radius: 8.5,
            color: position === 1 ? colors.brand : colors.muted,
            fg: position === 1 ? colors.brandForeground : colors.mutedForeground,
          });
        });
      });

      drawText(ctx, "Chain order — every provider's flagship before anyone's fallback tier", padX, 12, {
        color: colors.mutedForeground,
        size: 10.5,
        alpha: stage(progress, 0, 8),
      });
      return;
    }

    // Narrow: the interleaving is the message, so show the flattened chain.
    const flat = [...order.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([key, position]) => {
        const [providerIndex, rank] = key.split(":").map(Number);
        return { position, provider: PROVIDERS[providerIndex].name, model: PROVIDERS[providerIndex].models[rank] };
      })
      .slice(0, 6);

    const h = 42;
    const gapY = 10;
    flat.forEach((entry, i) => {
      const alpha = stage(progress, i, flat.length);
      const box: Box = { x: padX + 26, y: 10 + i * (h + gapY), w: width - padX * 2 - 26, h };
      drawNode(
        ctx,
        {
          ...box,
          align: "left",
          title: entry.model,
          subtitle: entry.provider,
          variant: i === 0 ? "brand" : "surface",
          alpha,
          radius: 9,
        },
        colors,
      );
      drawStepMarker(ctx, entry.position, padX + 11, box.y + h / 2, colors, { alpha });
      if (i > 0) {
        drawEdge(ctx, [{ x: box.x + 20, y: box.y - gapY }, { x: box.x + 20, y: box.y }], colors, { alpha, width: 1.4 });
      }
    });
  });

  return (
    <DiagramFrame
      title="LLM fallback chain"
      caption="Each (provider, model) pair is its own quota bucket, tracked locally against published limits and corrected by the API's own 429/413 responses — the API always wins over the local estimate. Ranks are interleaved deliberately: draining one provider's catalogue first would mean every retry after a stall lands on that same provider's smallest, least reliable models."
    >
      <canvas
        ref={ref}
        className="block h-[330px] w-full md:h-[250px]"
        role="img"
        aria-label="LLM fallback chain: four providers (Groq, NVIDIA, OpenRouter, Gemini) each contribute a ranked list of models, and the chain visits every provider's flagship first before descending to any provider's fallback tier."
      />
    </DiagramFrame>
  );
}
