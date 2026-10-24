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
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
};

export function PlatformLayout({
  state,
  notice,
  error,
  sessionId,
  lines,
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: PlatformLayoutProps) {
  return (
    <main className="shell">
      <TopBar state={state} />
      <section className="hero-grid">
        <div className="intro">
          <p className="eyebrow">REALTIME PLATFORM</p>
          <h1>
            让声音成为
            <br />
            <em>交流的入口。</em>
          </h1>
          <p className="lead">提供可运行、可扩展、可测试的实时会话基础能力。</p>
          <div className="capabilities" aria-label="平台能力">
            <span>SESSION</span>
            <span>TEXT LOG</span>
            <span>REALTIME</span>
          </div>
        </div>
        <div className="companion-card">
          <div className="card-glow" />
          <div className="character-stage platform-stage">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="platform-mark" aria-hidden="true">
              <span className="platform-sigil">V</span>
              <span className="platform-name">VOICE PLATFORM</span>
            </div>
            <div className="stage-state">{state.toUpperCase()}</div>
          </div>
          <TranscriptPanel
            lines={lines}
            emptyMessage="建立会话后，文本记录会显示在这里。"
          />
        </div>
      </section>
      <ErrorNotice message={error} />
      <SessionInfo state={state} sessionId={sessionId} />
      <ControlPanel
        state={state}
        notice={notice}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
      <footer>
        <span>通用实时会话底座</span>
        <span>HTTP / WebSocket</span>
      </footer>
    </main>
  );
}
