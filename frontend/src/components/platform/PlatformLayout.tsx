import type { ChatLine, ConnectionState } from "../../domain/types";
import { ControlPanel } from "./ControlPanel";
import { DashboardDialog } from "./DashboardDialog";
import { FurinaCompanion } from "./FurinaCompanion";
import { TopBar } from "./TopBar";

type PlatformLayoutProps = {
  state: ConnectionState;
  notice: string;
  error: string | null;
  sessionId?: string;
  lines: ChatLine[];
  disabled: boolean;
  microphoneMuted: boolean;
  speakerMuted: boolean;
  emotion?: string;
  assistantText?: string;
  canHeadPat?: boolean;
  headPatLocked?: boolean;
  onSessionAction: () => void;
  onEndSession: () => void;
  onToggleMicrophoneMute: () => void;
  onToggleSpeakerMute: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onSendText?: (text: string) => boolean;
  onHeadPat?: () => boolean;
};

export function PlatformLayout({
  state,
  notice,
  error,
  sessionId,
  lines,
  disabled,
  microphoneMuted,
  speakerMuted,
  emotion,
  assistantText,
  canHeadPat,
  headPatLocked,
  onSessionAction,
  onEndSession,
  onToggleMicrophoneMute,
  onToggleSpeakerMute,
  onStartVoice,
  onStopVoice,
  onSendText,
  onHeadPat,
}: PlatformLayoutProps) {
  return (
    <main className="shell" aria-label="实时伴侣主界面">
      {/* 居中全屏 Mate 舞台 */}
      <FurinaCompanion
        state={state}
        emotion={emotion}
        assistantText={assistantText}
        notice={error ?? notice}
        onSendText={onSendText}
        canHeadPat={canHeadPat}
        headPatLocked={headPatLocked}
        onHeadPat={onHeadPat}
      />

      {/* 顶部四周悬浮 HUD 栏（左：品牌与状态；右：复杂仪表盘 Dialog 入口） */}
      <TopBar
        state={state}
        actions={
          <DashboardDialog
            state={state}
            error={error}
            sessionId={sessionId}
            emotion={emotion}
            microphoneMuted={microphoneMuted}
            speakerMuted={speakerMuted}
            lines={lines}
            onSendText={onSendText}
          />
        }
      />

      {/* 底部四周悬浮语音控制坞 */}
      <ControlPanel
        state={state}
        notice={notice}
        disabled={disabled}
        microphoneMuted={microphoneMuted}
        speakerMuted={speakerMuted}
        onSessionAction={onSessionAction}
        onEndSession={onEndSession}
        onToggleMicrophoneMute={onToggleMicrophoneMute}
        onToggleSpeakerMute={onToggleSpeakerMute}
        onStartVoice={onStartVoice}
        onStopVoice={onStopVoice}
        onSendText={onSendText}
      />
    </main>
  );
}
