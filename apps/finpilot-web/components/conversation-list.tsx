"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { MessageCircleIcon } from "lucide-react";

import { useConversations } from "@/lib/conversations-context";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

function groupLabelFor(dateStr: string): (typeof GROUP_ORDER)[number] {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), date) <= 7) return "Previous 7 days";
  return "Older";
}

export function ConversationList() {
  const { conversations, loading } = useConversations();
  const params = useParams<{ conversationId?: string }>();
  const activeId = params?.conversationId;

  const grouped = React.useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
    const map = new Map<string, typeof sorted>();
    for (const conv of sorted) {
      const key = groupLabelFor(conv.started_at);
      map.set(key, [...(map.get(key) ?? []), conv]);
    }
    return map;
  }, [conversations]);

  if (loading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {Array.from({ length: 4 }).map((_, i) => (
              <SidebarMenuSkeleton key={i} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (conversations.length === 0) {
    return null;
  }

  return (
    <>
      {GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => (
        <SidebarGroup key={group}>
          <SidebarGroupLabel>{group}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {grouped.get(group)!.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    isActive={activeId === conv.id}
                    render={<Link href={`/dashboard/c/${conv.id}`} />}
                  >
                    <MessageCircleIcon />
                    <span className="truncate">{conv.title ?? "New chat"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
