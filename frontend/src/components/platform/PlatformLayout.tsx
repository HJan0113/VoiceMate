import type { ChatLine, ConnectionState } from "../../domain/types";
import { ControlPanel } from "./ControlPanel";
import { ErrorNotice } from "./ErrorNotice";
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
  onSessionAction: () => void;
  onEndSession: () => void;
  onInputAction: () => void;
  onToggleMute: () => void;
};

export function PlatformLayout({
  state,
  notice,
  error,
  sessionId,
  lines,
  disabled,
  muted,
  onSessionAction,
  onEndSession,
  onInputAction,
  onToggleMute,
}: PlatformLayoutProps) {
  return (
    <main className="shell">
      <TopBar state={state} />
      <section className="workspace" aria-label="实时会话工作区">
        <section className="visual-placeholder" aria-label="人物形象占位区">
          <div className="wireframe-title">人物形象区域</div>
          <div className="wireframe-box">
            <span>待接入人物形象</span>
          </div>
        </section>
        <section className="console" aria-label="会话控制区">
          <div className="console-heading">
            <div>
              <p className="section-kicker">SESSION CONSOLE</p>
              <h1>实时会话</h1>
            </div>
            <span className="console-version">基础平台</span>
          </div>
          <SessionInfo state={state} sessionId={sessionId} />
          <ErrorNotice message={error} />
          <TranscriptPanel
            lines={lines}
            emptyMessage="建立会话后，文本记录会显示在这里。"
          />
          <ControlPanel
            state={state}
            notice={notice}
            disabled={disabled}
            muted={muted}
            onSessionAction={onSessionAction}
            onEndSession={onEndSession}
            onInputAction={onInputAction}
            onToggleMute={onToggleMute}
          />
        </section>
      </section>
      <footer>
        <span>通用实时会话底座</span>
        <span>HTTP / WebSocket</span>
      </footer>
    </main>
  );
}
