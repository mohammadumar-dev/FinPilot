"use client";

import * as React from "react";
import { ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";

export function ChatComposer({
  onSend,
  disabled,
  placeholder,
  autoFocus,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = React.useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <InputGroup className="min-h-13 items-end rounded-3xl border-transparent bg-card p-1 shadow-sm ring-1 ring-border/70 transition-shadow focus-within:ring-2 focus-within:ring-brand/25">
      <InputGroupTextarea
        placeholder={placeholder ?? "Message FinPilot…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        autoFocus={autoFocus}
        className="max-h-40 px-3.5 py-3 text-sm"
      />
      <InputGroupAddon align="block-end" className="w-full justify-end pr-1.5 pb-1.5">
        <Button
          size="icon-sm"
          variant="brand"
          className="rounded-full"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label="Send message"
        >
          <ArrowUpIcon />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
