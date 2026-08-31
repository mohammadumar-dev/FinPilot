"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SparkleIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { useConversations } from "@/lib/conversations-context";
import { createConversation, ApiError } from "@/lib/api";
import { pendingMessageKey } from "@/lib/pending-message";
import { ChatComposer } from "@/components/chat/chat-composer";
import { PageBar } from "@/components/page-shell";

/** Openers that show the agent's actual range: a multi-item budgeted list,
 * an open-ended gift ask, and a single capped purchase. Each one is a real
 * sentence a buyer would type, not a feature label. */
const SUGGESTIONS = [
  "Running shoes under ₹2,000, wireless earbuds under ₹2,500, and a book on habits under ₹500",
  "What's a good gift under ₹1,000?",
  "I need something under ₹1,500 — what do you recommend?",
];

export default function NewChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useConversations();
  const [sending, setSending] = React.useState(false);

  async function handleSend(message: string) {
    setSending(true);
    try {
      // Create the conversation and navigate to it immediately — the
      // conversation page sends the actual message (and shows the
      // "Thinking…" state) so the buyer isn't stuck on a blank page for the
      // full agent turn, and the sidebar can list/continue it right away.
      const conversation = await createConversation();
      sessionStorage.setItem(pendingMessageKey(conversation.id), message);
      refresh();
      router.push(`/dashboard/c/${conversation.id}`);
    } catch (err) {
      const detail = err instanceof ApiError ? err.code : undefined;
      toast.error(detail ?? "Couldn't send that message. Try again.");
      setSending(false);
    }
  }

  const greetingName = user?.email.split("@")[0] ?? "there";

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="New chat" />

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm ring-1 ring-brand/20">
              <SparkleIcon className="size-6" />
            </span>
            <h1 className="font-heading text-[2rem] leading-tight tracking-tight text-balance italic">
              Hey <span className="capitalize">{greetingName}</span>, what are you after?
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-balance text-muted-foreground">
              One chat, every store. Tell me what you want and your budget — I&apos;ll find the
              best-rated option across the marketplace and buy it for you.
            </p>
          </div>

          <div className="flex w-full flex-col gap-4">
            <ChatComposer onSend={handleSend} disabled={sending} autoFocus />

            <div className="flex flex-col gap-2.5">
              <span className="section-label text-center">Try one of these</span>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSend(s)}
                    className="max-w-full truncate rounded-full border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground shadow-sm transition-all hover:-translate-y-px hover:border-brand/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
