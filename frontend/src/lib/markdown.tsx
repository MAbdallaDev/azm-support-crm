import * as React from "react";

/**
 * A minimal, safe Markdown renderer for knowledge-base bodies.
 *
 * "Plain renderer, rich text is explicitly out of scope" — this is not a
 * general Markdown implementation. It covers exactly what the seeded content
 * and the editor's own placeholder text use: paragraphs separated by a blank
 * line, `## heading` lines, `*italic*`, and inline `` `code` ``. Anything else
 * passes through as plain text.
 *
 * **No `dangerouslySetInnerHTML` anywhere.** Article bodies are agent-authored
 * and rendered to every reader including customers in story 09's portal; a
 * string-to-HTML renderer would make every article a stored-XSS vector. This
 * builds React elements from tokens instead, so there is no HTML for a
 * `<script>` to hide inside — the same reasoning as the backend's own
 * `sanitise_filename` for uploaded attachment names.
 */

/** One line of `*italic*` / `` `code` `` / plain text, as React children. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-${index}`} className="mono-ltr rounded bg-surface-3 px-1 py-0.5 text-[12px]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={`${keyPrefix}-${index}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = pattern.lastIndex;
    index += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function MarkdownBody({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim() !== "");

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        const heading = /^#{1,3}\s+(.*)$/.exec(block.trim());
        if (heading) {
          return (
            <h3 key={blockIndex} className="mt-4 text-[13.5px] font-bold first:mt-0">
              {renderInline(heading[1], `h-${blockIndex}`)}
            </h3>
          );
        }
        return (
          <p key={blockIndex} className="mt-3.5 first:mt-0">
            {block.split("\n").map((line, lineIndex, lines) => (
              <React.Fragment key={lineIndex}>
                {renderInline(line, `p-${blockIndex}-${lineIndex}`)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
