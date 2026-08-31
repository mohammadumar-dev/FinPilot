"use client";

import * as React from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { ProductResultCard } from "@/components/chat/product-card";
import { OrderResultCard } from "@/components/chat/order-card";
import { OrdersListCard } from "@/components/chat/orders-list-card";
import { FormattedText } from "@/components/chat/formatted-text";
import type { CreateOrderToolResult, ListOrdersItem, MessageRow, SearchCatalogResultItem } from "@/lib/types";

function supersededSearchIds(messages: MessageRow[]): Set<string> {
  // A search_catalog call is superseded only when a LATER call in the same
  // turn re-searches the *same* query — that's the agent correcting itself
  // (e.g. got "Car Phone Mount" for "mobile phone" with no category, then
  // retried the identical query with category="smartphones" and got the
  // actual phones) — only the corrected result should show, not both.
  //
  // A later call with a DIFFERENT query is a different item in a multi-item
  // request ("shoes, laptop, shirt, mobile, coffee") and must render
  // alongside the others, not replace them — keying on the query text
  // (rather than "just the last call this turn", the previous approach)
  // is what tells these two situations apart.
  const superseded = new Set<string>();
  const lastIdByQuery = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "user") {
      lastIdByQuery.clear();
      continue;
    }
    if (m.role === "tool" && m.tool_call?.name === "search_catalog") {
      const query = String(m.tool_call?.arguments?.query ?? "").trim().toLowerCase();
      const prevId = lastIdByQuery.get(query);
      if (prevId) superseded.add(prevId);
      lastIdByQuery.set(query, m.id);
    }
  }
  return superseded;
}

export function ChatThread({
  messages,
  onQuickReply,
}: {
  messages: MessageRow[];
  onQuickReply: (text: string) => void;
}) {
  const superseded = React.useMemo(() => supersededSearchIds(messages), [messages]);

  return (
    <>
      {messages.map((m) => {
        if (m.role === "user") {
          return (
            <MessageScrollerItem key={m.id}>
              <Message align="end">
                <MessageContent>
                  <Bubble align="end">
                    <BubbleContent>{m.content}</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          );
        }

        if (m.role === "agent") {
          if (!m.content) return null; // a tool-call-only turn — nothing conversational to show
          return (
            <MessageScrollerItem key={m.id}>
              <Message align="start">
                <MessageContent>
                  <p className="max-w-[65ch] px-1 text-[0.9375rem] leading-[1.7] whitespace-pre-wrap text-pretty">
                    <FormattedText text={m.content} />
                  </p>
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          );
        }

        // role === "tool"
        const name = m.tool_call?.name;

        if (name === "search_catalog") {
          if (superseded.has(m.id)) return null; // a later same-query search this turn corrected it
          const results =
            (m.tool_call?.result as { results?: SearchCatalogResultItem[] } | undefined)?.results ?? [];
          if (results.length === 0) return null;
          return (
            <MessageScrollerItem key={m.id}>
              <Message align="start">
                <MessageContent>
                  {/* A lone result shouldn't be stranded at half width in a
                      two-column track — narrow the container instead. */}
                  <div
                    className={
                      results.length === 1
                        ? "grid w-full max-w-xs items-stretch gap-3"
                        : "grid w-full max-w-2xl items-stretch gap-3 sm:grid-cols-2"
                    }
                  >
                    {results.map((p) => (
                      <ProductResultCard
                        key={p.product_id}
                        product={p}
                        onBuy={() => onQuickReply(`Yes, I'll take the ${p.name}.`)}
                      />
                    ))}
                  </div>
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          );
        }

        if (name === "create_order") {
          const result = m.tool_call?.result as CreateOrderToolResult | undefined;
          // Genuine errors with nothing actionable (e.g. product_not_found) are
          // skipped — the agent's next text message explains those. duplicate_order
          // / already_purchased carry a real order_id, so still show the card.
          if (!result || (result.error && !result.order_id)) return null;
          return (
            <MessageScrollerItem key={m.id}>
              <Message align="start">
                <MessageContent>
                  <OrderResultCard result={result} />
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          );
        }

        if (name === "list_orders") {
          const orders = (m.tool_call?.result as { orders?: ListOrdersItem[] } | undefined)?.orders ?? [];
          return (
            <MessageScrollerItem key={m.id}>
              <Message align="start">
                <MessageContent>
                  <OrdersListCard orders={orders} />
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          );
        }

        return null; // get_product_detail / check_payment_status rows: the agent narrates these in text
      })}
    </>
  );
}
