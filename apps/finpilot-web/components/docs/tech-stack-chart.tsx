"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DATA = [
  { layer: "Frontend", count: 6, detail: "Next.js, React, TypeScript, Tailwind v4, shadcn/ui, Recharts" },
  { layer: "Backend", count: 4, detail: "FastAPI, SQLAlchemy, Alembic, MCP Python SDK" },
  { layer: "Data", count: 1, detail: "PostgreSQL" },
  { layer: "Integrations", count: 2, detail: "Groq (LLM), Razorpay (payments)" },
];

function StackTooltip({ active, payload }: { active?: boolean; payload?: { payload: (typeof DATA)[number] }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="surface max-w-56 px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{row.layer}</div>
      <div className="mt-0.5 text-muted-foreground">{row.detail}</div>
    </div>
  );
}

/** One measure (how many named technologies sit in each layer) across a
 * fixed small set of categories — a single-hue horizontal bar, brand color,
 * with the count direct-labeled so the axis stays uncluttered. */
export function TechStackChart() {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DATA} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 4 }} barCategoryGap={18}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis type="number" hide domain={[0, "dataMax + 2"]} />
          <YAxis
            type="category"
            dataKey="layer"
            width={92}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<StackTooltip />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="count" fill="var(--brand)" radius={[0, 4, 4, 0]} maxBarSize={22}>
            <LabelList
              dataKey="count"
              position="right"
              className="fill-foreground"
              style={{ fontSize: 12, fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
