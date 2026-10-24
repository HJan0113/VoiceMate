import type { ChatLine, ConnectionState } from "../../domain/types";
import { ControlPanel } from "./ControlPanel";
import { ErrorNotice } from "./ErrorNotice";
import { FurinaCompanion } from "./FurinaCompanion";
import { SessionInfo } from "./SessionInfo";
import { TopBar } from "./TopBar";
import { TranscriptPanel } from "./TranscriptPanel";

type PlatformLayoutProps = {
  state: ConnectionState;
  notice: string;
  error: string | null;
  sessionId?: string;
  lines: ChatLine[];
  disabled: boolean;
  muted: boolean;
  emotion?: string;
  assistantText?: string;
  onSessionAction: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
  onSendText?: (text: string) => void;
};

export function PlatformLayout({
  state,
  notice,
  error,
  sessionId,
  lines,
  disabled,
  muted,
  emotion,
  assistantText,
  onSessionAction,
  onEndSession,
  onToggleMute,
  onSendText,
}: PlatformLayoutProps) {
  return (
    <main className="shell">
      <TopBar state={state} />
      <section className="workspace" aria-label="实时会话工作区">
        <FurinaCompanion
          state={state}
          emotion={emotion}
          assistantText={assistantText}
          onSendText={onSendText}
        />
        <section className="console" aria-label="会话控制区">
          <div className="console-heading">
            <div>
              <p className="section-kicker">SESSION CONSOLE</p>
              <h1>实时会话</h1>
            </div>
            <span className="console-version">灵矽AI · 实时通话</span>
          </div>
          <SessionInfo state={state} sessionId={sessionId} />
          <ErrorNotice message={error} />
          <TranscriptPanel
            lines={lines}
            emptyMessage="接通电话后，双方的语音与对话记录将实时呈现在这里。"
          />
          <ControlPanel
            state={state}
            notice={notice}
            disabled={disabled}
            muted={muted}
            onSessionAction={onSessionAction}
            onEndSession={onEndSession}
            onToggleMute={onToggleMute}
            onSendText={onSendText}
          />
        </section>
      </section>
      <footer>
        <span>VoiceMate 灵矽AI 伴侣系统</span>
        <span>全双工实时通话 · Qiniu Linx AI</span>
      </footer>
    </main>
  );
}
