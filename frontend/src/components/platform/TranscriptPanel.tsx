import type { ChatLine } from "../../domain/types";
import { EmptyState } from "./EmptyState";

type TranscriptPanelProps = {
  lines: ChatLine[];
  emptyMessage: string;
};

export function TranscriptPanel({ lines, emptyMessage }: TranscriptPanelProps) {
  return (
    <section className="conversation" aria-label="文本记录">
      <div className="conversation-label">TEXT LOG</div>
      {lines.length ? (
        <div className="transcript-list">
          {lines.slice(-6).map((line) => (
            <p className={`line ${line.role}`} key={line.id}>
              <b>{line.role === "user" ? "YOU" : "SYSTEM"}</b>
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
