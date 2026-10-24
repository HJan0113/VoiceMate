import { useLayoutEffect, useRef } from "react";
import type { ChatLine } from "../../domain/types";
import { EmptyState } from "./EmptyState";

type TranscriptPanelProps = {
  lines: ChatLine[];
  emptyMessage: string;
};

const BOTTOM_THRESHOLD_PX = 24;

export function TranscriptPanel({ lines, emptyMessage }: TranscriptPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <section className="conversation" aria-label="文本记录">
      <div className="conversation-header">
        <span className="conversation-label">TEXT LOG</span>
        <span className="conversation-count">{lines.length} 条对话</span>
      </div>
      {lines.length ? (
        <div ref={listRef} className="transcript-list" onScroll={handleScroll}>
          {lines.map((line) => (
            <p className={`line ${line.role}`} key={line.id}>
              <b>{line.role === "user" ? "YOU" : "FURINA"}</b>
              <span>{line.text}</span>
            </p>
          ))}
        </div>
      ) : (
        <EmptyState>{emptyMessage}</EmptyState>
      )}
    </section>
  );
}
