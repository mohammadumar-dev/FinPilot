"use client";

import * as React from "react";
import { ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";

export function ChatComposer({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = React.useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <InputGroup className="min-h-12 items-end rounded-3xl border-border bg-background p-1 shadow-sm ring-1 ring-foreground/5">
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
        className="max-h-40 px-3 py-2.5"
      />
      <InputGroupAddon align="block-end" className="w-full justify-end pr-1.5 pb-1.5">
        <Button
          size="icon-sm"
          disabled={disabled || !value.trim()}
          onClick={submit}
          className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:bg-muted disabled:text-muted-foreground"
        >
          <ArrowUpIcon />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
