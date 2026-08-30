import * as React from "react";

const TOKEN_RE = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;

/** Renders `**bold**` spans and bare URLs as real clickable links; everything
 * else is plain text. The agent is instructed to keep replies to prose
 * (product/order detail is already shown via cards), so this deliberately
 * doesn't handle full Markdown. */
export function FormattedText({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("http://") || part.startsWith("https://")) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline underline-offset-2 hover:text-brand/80"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
