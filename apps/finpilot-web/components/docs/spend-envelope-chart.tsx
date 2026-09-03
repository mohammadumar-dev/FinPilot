"use client";

import * as React from "react";
import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

const CAP_PAISE = 500000; // ₹5,000 illustrative monthly envelope
const SPENT_PAISE = 185000; // ₹1,850 illustrative spend so far

const data = [{ name: "spent", value: SPENT_PAISE, fill: "var(--brand)" }];
const pct = Math.round((SPENT_PAISE / CAP_PAISE) * 100);

/** A single illustrative gauge — not live data, the copy says so — that
 * makes "spend envelope" a concrete number instead of an abstract phrase:
 * a merchant/agent-client is issued a cap, every order checks remaining
 * headroom before it's allowed to proceed. */
export function SpendEnvelopeChart() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-40 w-40">
        <RadialBarChart
          width={160}
          height={160}
          innerRadius="72%"
          outerRadius="100%"
          barSize={14}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, CAP_PAISE]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={7} background={{ fill: "var(--muted)" }} />
        </RadialBarChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="numeric text-xl font-semibold text-foreground">{pct}%</span>
          <span className="text-[10px] text-muted-foreground">of cap used</span>
        </div>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        <span className="numeric text-foreground">₹{(SPENT_PAISE / 100).toLocaleString("en-IN")}</span> spent of a{" "}
        <span className="numeric text-foreground">₹{(CAP_PAISE / 100).toLocaleString("en-IN")}</span> envelope
        <span className="block">(illustrative — the cap is set per agent-client / buyer)</span>
      </div>
    </div>
  );
}
