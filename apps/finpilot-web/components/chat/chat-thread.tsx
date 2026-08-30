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
  // Within a single buyer turn, the agent sometimes calls search_catalog more
  // than once — e.g. it guesses the wrong category, gets an irrelevant
  // result, and retries with a better one. Its final reply is written
  // against that last, corrected call, but without this, every intermediate
  // (wrong) search still rendered its own product grid — showing exercise
  // equipment as if it were a real answer to "fitness tracker" right above
  // the correct smartwatch result. Only the *last* search_catalog call
  // before the next user message reflects what the agent actually meant.
  const superseded = new Set<string>();
  let lastSearchId: string | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      lastSearchId = null;
      continue;
    }
    if (m.role === "tool" && m.tool_call?.name === "search_catalog") {
      if (lastSearchId) superseded.add(lastSearchId);
      lastSearchId = m.id;
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
                  <p className="max-w-[65ch] px-3 text-[0.925rem] leading-relaxed whitespace-pre-wrap">
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
          if (superseded.has(m.id)) return null; // a later search this same turn replaced it
          const results =
            (m.tool_call?.result as { results?: SearchCatalogResultItem[] } | undefined)?.results ?? [];
          if (results.length === 0) return null;
          return (
            <MessageScrollerItem key={m.id}>
              <Message align="start">
                <MessageContent>
                  <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
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
