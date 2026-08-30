// Handoff for a message typed on the "New chat" landing page: the
// conversation is created and navigated to immediately (see
// app/dashboard/page.tsx), and the conversation page picks up the pending
// text from here to actually send it — see app/dashboard/c/[conversationId]/page.tsx.
export function pendingMessageKey(conversationId: string): string {
  return `finpilot_pending_msg_${conversationId}`;
}
