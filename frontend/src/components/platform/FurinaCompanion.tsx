import { useEffect, useRef, useState } from "react";
import type { ConnectionState } from "../../domain/types";

type FurinaCompanionProps = {
  state: ConnectionState;
  emotion?: string;
  assistantText?: string;
  onSendText?: (text: string) => void;
};

export function FurinaCompanion({
  state,
  assistantText,
}: FurinaCompanionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pipActive, setPipActive] = useState(false);

  // 根据当前会话状态调节视频倍速
  useEffect(() => {
    if (!videoRef.current) return;
    if (state === "speaking") {
      videoRef.current.playbackRate = 1.08;
    } else {
      videoRef.current.playbackRate = 1.0;
    }
  }, [state]);

  // 计算当前展示的气泡台词
  const bubbleText = assistantText
    ? `「${assistantText}」`
    : "「欧庇克莱大剧院的帷幕永不落空，而你，就是本名伶最忠实的特约观众~」";

  // 画中画模式
  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
        setPipActive(true);
      }
    } catch {
      // 当前浏览器可能不支持或权限受限
    }
  };

  return (
    <section className="furina-companion-container" aria-label="伴侣展示区">
      <div className="furina-header">
        <div>
          <span className="furina-kicker">COMPANION AVATAR</span>
          <h2 className="furina-name">芙宁娜 (Furina)</h2>
        </div>
        <div className="furina-badge-group">
          <button
            type="button"
            className="pip-button"
            onClick={() => void togglePip()}
            title={pipActive ? "退出画中画" : "开启悬浮画中画"}
          >
            {pipActive ? "✕ 退出悬浮" : "⧉ 画中画"}
          </button>
        </div>
      </div>

      <div className="furina-stage">
        <video
          ref={videoRef}
          src="/assets/characters/furina/furina_idle.mp4"
          className="furina-video"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* 动态台词气泡 */}
        <div className="furina-bubble">
          <p className="bubble-content">{bubbleText}</p>
        </div>
      </div>
    </section>
  );
}
