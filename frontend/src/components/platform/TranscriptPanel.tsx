import type { ChatLine } from "../../domain/types";
import { EmptyState } from "./EmptyState";

type TranscriptPanelProps = {
  lines: ChatLine[];
  emptyMessage: string;
};

export function TranscriptPanel({ lines, emptyMessage }: TranscriptPanelProps) {
  return (
    <section className="conversation" aria-label="文本记录">
      <div className="conversation-header">
        <span className="conversation-label">TEXT LOG</span>
        <span className="conversation-count">{lines.length} 条对话</span>
      </div>
      {lines.length ? (
        <div className="transcript-list">
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
