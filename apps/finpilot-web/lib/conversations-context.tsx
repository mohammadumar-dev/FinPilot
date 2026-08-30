"use client";

import * as React from "react";

import { listConversations } from "@/lib/api";
import type { Conversation } from "@/lib/types";

interface ConversationsContextValue {
  conversations: Conversation[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ConversationsContext = React.createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch {
      // Sidebar just shows an empty list if this fails — not worth a toast.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const value = React.useMemo(() => ({ conversations, loading, refresh }), [conversations, loading, refresh]);

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
  const ctx = React.useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within a ConversationsProvider");
  return ctx;
}
