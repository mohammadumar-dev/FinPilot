"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HistoryIcon, MessageCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useConversations } from "@/lib/conversations-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";

const RECENT_LIMIT = 5;

export function RecentChatsDialog() {
  const { conversations, loading } = useConversations();
  const params = useParams<{ conversationId?: string }>();
  const activeId = params?.conversationId;
  const [open, setOpen] = React.useState(false);

  const recent = React.useMemo(
    () =>
      [...conversations]
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, RECENT_LIMIT),
    [conversations]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<SidebarMenuButton tooltip="Recent chats" />}>
        <HistoryIcon />
        <span>Recent chats</span>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={12} className="w-64 gap-1 p-2">
        <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Recents</p>
        {loading ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          recent.map((conv) => (
            <Link
              key={conv.id}
              href={`/dashboard/c/${conv.id}`}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm hover:bg-muted",
                activeId === conv.id && "bg-muted font-medium"
              )}
            >
              <MessageCircleIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-left">{conv.title ?? "New chat"}</span>
            </Link>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
