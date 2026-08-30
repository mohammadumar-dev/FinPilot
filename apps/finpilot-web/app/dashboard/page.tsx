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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <h1 className="text-sm font-medium text-muted-foreground">New chat</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <SparkleIcon className="size-5" />
          </span>
          <h2 className="font-heading text-3xl italic">
            Hey <span className="capitalize">{greetingName}</span>, what are you after?
          </h2>
          <p className="max-w-md text-sm text-balance text-muted-foreground">
            One chat, every store — tell me what you want and your budget, and I&apos;ll find the best-rated
            option across the whole marketplace and buy it for you.
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <ChatComposer onSend={handleSend} disabled={sending} />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending}
                onClick={() => handleSend(s)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
