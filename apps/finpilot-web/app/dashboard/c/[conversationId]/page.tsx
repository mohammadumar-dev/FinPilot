"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { SparkleIcon } from "lucide-react";

import { getChatHistory, sendChatMessage, ApiError } from "@/lib/api";
import { useConversations } from "@/lib/conversations-context";
import { pendingMessageKey } from "@/lib/pending-message";
import type { MessageRow } from "@/lib/types";
import { ChatThread } from "@/components/chat/chat-thread";
import { ChatComposer } from "@/components/chat/chat-composer";
import { PageBar } from "@/components/page-shell";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { conversations, refresh } = useConversations();

  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    const history = await getChatHistory(conversationId);
    setMessages(history);
  }, [conversationId]);

  async function handleSend(message: string) {
    setSending(true);
    try {
      await sendChatMessage({ conversation_id: conversationId, message });
      await loadHistory();
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError ? err.code : undefined;
      toast.error(detail ?? "Couldn't send that message. Try again.");
    } finally {
      setSending(false);
    }
  }

  const handledConversationRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // React Strict Mode runs this effect twice on mount in dev. A second run
    // for the same conversationId must be a no-op — otherwise it re-reads
    // sessionStorage (already cleared by the first run), falls through to
    // loadHistory(), and overwrites the optimistic pending bubble below with
    // the still-empty server history (the agent turn from the first run is
    // still in flight).
    if (handledConversationRef.current === conversationId) return;
    handledConversationRef.current = conversationId;

    // A message typed on the "New chat" page is handed off here (see
    // app/dashboard/page.tsx) instead of being sent before navigating, so
    // the buyer lands on this conversation — and can find it in the sidebar
    // — immediately instead of waiting on a blank page for the full reply.
    const key = pendingMessageKey(conversationId);
    const pending = sessionStorage.getItem(key);
    if (pending) {
      sessionStorage.removeItem(key);
      setLoading(false);
      // Show the buyer's own message right away instead of a blank thread
      // while the agent turn is in flight — loadHistory() replaces this
      // with the real persisted row once the reply comes back.
      setMessages([
        { id: "pending", role: "user", content: pending, tool_call: null, created_at: new Date().toISOString() },
      ]);
      handleSend(pending);
      return;
    }

    setLoading(true);
    loadHistory()
      .catch(() => toast.error("Couldn't load this conversation."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, loadHistory]);

  const conversation = conversations.find((c) => c.id === conversationId);

  return (
    <div className="flex h-svh flex-col">
      <PageBar label={conversation?.title ?? "New chat"} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Spinner className="size-5" />
        </div>
      ) : (
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
                <ChatThread messages={messages} onQuickReply={handleSend} />
                {sending && (
                  <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                    <SparkleIcon className="size-3.5 animate-pulse text-brand" />
                    <span className="animate-pulse">Thinking…</span>
                  </div>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      {/* The composer sits on a fade so long threads scroll under it cleanly
          instead of colliding with the input's edge. */}
      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-4">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <ChatComposer onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </div>
  );
}
