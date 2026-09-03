import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs · FinPilot",
  description: "Architecture, data model, and agent workflows behind FinPilot's AI shopping agent and merchant-growth agents.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-background">{children}</div>;
}
