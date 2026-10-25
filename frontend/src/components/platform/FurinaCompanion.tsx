import { useEffect, useRef, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import type { ConnectionState } from "../../domain/types";

type FurinaCompanionProps = {
  state: ConnectionState;
  emotion?: string;
  assistantText?: string;
  notice?: string;
  onSendText?: (text: string) => void;
  canHeadPat?: boolean;
  headPatLocked?: boolean;
  onHeadPat?: () => void;
};

export function FurinaCompanion({
  state,
  emotion,
  assistantText,
  notice,
  canHeadPat = false,
  headPatLocked = false,
  onHeadPat,
}: FurinaCompanionProps) {
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const happyVideoRef = useRef<HTMLVideoElement>(null);
  const sadVideoRef = useRef<HTMLVideoElement>(null);
  const angryVideoRef = useRef<HTMLVideoElement>(null);
  const [pipActive, setPipActive] = useState(false);
  const [headPatActive, setHeadPatActive] = useState(false);
  const headPatTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (headPatTimerRef.current !== null) {
        window.clearTimeout(headPatTimerRef.current);
      }
    };
  }, []);

  const isAngry = emotion
    ? [
        "angry",
        "pout",
        "annoyed",
        "furious",
        "rage",
        "mad",
        "displeased",
        "愤怒",
        "生气",
        "发怒",
        "气恼",
        "不满",
        "愠怒",
        "暴怒",
        "恼火",
      ].includes(emotion.toLowerCase())
    : false;

  const isSad =
    !isAngry && emotion
      ? [
          "sad",
          "crying",
          "weeping",
          "tears",
          "sorrow",
          "grief",
          "伤心",
          "难过",
          "哭泣",
          "流泪",
          "委屈",
          "失落",
          "落泪",
        ].includes(emotion.toLowerCase())
      : false;

  const isHappy =
    !isAngry && !isSad && emotion
      ? [
          "happy",
          "loving",
          "laughing",
          "funny",
          "winking",
          "relaxed",
          "delicious",
          "kissy",
          "confident",
          "silly",
          "cool",
          "smile",
          "开心",
          "高兴",
          "快乐",
          "喜欢",
          "得意",
        ].includes(emotion.toLowerCase())
      : false;

  // 根据当前会话状态调节视频倍速
  useEffect(() => {
    const rate = state === "speaking" ? 1.08 : 1.0;
    if (idleVideoRef.current) {
      idleVideoRef.current.playbackRate = rate;
    }
    if (happyVideoRef.current) {
      happyVideoRef.current.playbackRate = rate;
    }
    if (sadVideoRef.current) {
      sadVideoRef.current.playbackRate = rate;
    }
    if (angryVideoRef.current) {
      angryVideoRef.current.playbackRate = rate;
    }
  }, [state]);

  // 当开心触发时，从头开始播放开心动画并确保播放
  useEffect(() => {
    if (isHappy && happyVideoRef.current) {
      happyVideoRef.current.currentTime = 0;
      const playVideo = async () => {
        try {
          await happyVideoRef.current?.play();
        } catch {
          // 忽略非用户手势导致自动播放策略受限
        }
      };
      void playVideo();
    }
  }, [isHappy]);

  // 当伤心/哭泣触发时，从头开始播放伤心落泪动画并确保播放
  useEffect(() => {
    if (isSad && sadVideoRef.current) {
      sadVideoRef.current.currentTime = 0;
      const playVideo = async () => {
        try {
          await sadVideoRef.current?.play();
        } catch {
          // 忽略非用户手势导致自动播放策略受限
        }
      };
      void playVideo();
    }
  }, [isSad]);

  // 当愤怒/气恼触发时，从头开始播放愤怒气恼动画并确保播放
  useEffect(() => {
    if (isAngry && angryVideoRef.current) {
      angryVideoRef.current.currentTime = 0;
      const playVideo = async () => {
        try {
          await angryVideoRef.current?.play();
        } catch {
          // 忽略非用户手势导致自动播放策略受限
        }
      };
      void playVideo();
    }
  }, [isAngry]);

  // 计算当前展示的气泡台词
  const bubbleText = assistantText
    ? `「${assistantText}」`
    : "「欧庇克莱大剧院的帷幕永不落空，而你，就是本名伶最忠实的特约观众~」";

  const triggerHeadPat = () => {
    if (!canHeadPat || headPatLocked || headPatActive) return;
    const accepted = onHeadPat?.() ?? true;
    if (!accepted) return;
    setHeadPatActive(true);
    headPatTimerRef.current = window.setTimeout(() => {
      setHeadPatActive(false);
      headPatTimerRef.current = null;
    }, 700);
  };

  // 画中画模式
  const togglePip = async () => {
    let video = idleVideoRef.current;
    if (isAngry) {
      video = angryVideoRef.current;
    } else if (isSad) {
      video = sadVideoRef.current;
    } else if (isHappy) {
      video = happyVideoRef.current;
    }
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
      <div className="furina-stage">
        <div
          className={`furina-character-frame ${headPatActive ? "head-pat-active" : ""}`}
          data-testid="furina-character-frame"
        >
          {/* 默认站立待机动画 */}
          <video
            ref={idleVideoRef}
            src="/assets/characters/furina/furina_idle.mp4"
            className={`furina-video ${!isHappy && !isSad && !isAngry ? "furina-video-active" : "furina-video-hidden"}`}
            autoPlay
            loop
            muted
            playsInline
            aria-label="芙宁娜站立待机动画"
            data-testid="furina-video-idle"
          />

          {/* 开心微笑动画 */}
          <video
            ref={happyVideoRef}
            src="/assets/characters/furina/furina_happy.mp4"
            className={`furina-video ${isHappy ? "furina-video-active" : "furina-video-hidden"}`}
            autoPlay
            loop
            muted
            playsInline
            aria-label="芙宁娜开心微笑动画"
            data-testid="furina-video-happy"
          />

          {/* 伤心落泪动画 */}
          <video
            ref={sadVideoRef}
            src="/assets/characters/furina/furina_sad.mp4"
            className={`furina-video ${isSad ? "furina-video-active" : "furina-video-hidden"}`}
            autoPlay
            loop
            muted
            playsInline
            aria-label="芙宁娜伤心落泪动画"
            data-testid="furina-video-sad"
          />

          {/* 愤怒气恼动画 */}
          <video
            ref={angryVideoRef}
            src="/assets/characters/furina/furina_angry.mp4"
            className={`furina-video ${isAngry ? "furina-video-active" : "furina-video-hidden"}`}
            autoPlay
            loop
            muted
            playsInline
            aria-label="芙宁娜愤怒气恼动画"
            data-testid="furina-video-angry"
          />

          <button
            type="button"
            className="furina-head-hitbox"
            onClick={triggerHeadPat}
            disabled={!canHeadPat || headPatLocked || headPatActive}
            aria-label="摸摸头"
            title={canHeadPat ? "摸摸头" : "当前暂不可互动"}
            data-testid="furina-head-hitbox"
          />
        </div>

        {/* 右上侧悬浮状态标签与画中画按钮 */}
        <div className="furina-floating-corner">
          {isAngry && (
            <span
              className="furina-emotion-tag angry"
              data-testid="furina-angry-badge"
            >
              😠 愤怒
            </span>
          )}
          {isSad && (
            <span
              className="furina-emotion-tag sad"
              data-testid="furina-sad-badge"
            >
              😢 伤心
            </span>
          )}
          {isHappy && (
            <span
              className="furina-emotion-tag happy"
              data-testid="furina-happy-badge"
            >
              ✨ 开心
            </span>
          )}
          <button
            type="button"
            className={`hud-btn pip-floating-btn ${pipActive ? "active" : ""}`}
            onClick={() => void togglePip()}
            title={pipActive ? "退出画中画" : "开启悬浮画中画"}
            aria-label={pipActive ? "退出悬浮" : "画中画"}
          >
            <PictureInPicture2 className="hud-icon" />
            <span className="hud-btn-label">
              {pipActive ? "退出悬浮" : "画中画"}
            </span>
          </button>
        </div>

        {/* 动态台词与状态气泡 */}
        <div className="furina-overlay-bottom">
          <div className="furina-bubble">
            <p className="bubble-content">{bubbleText}</p>
          </div>
          {notice && (
            <p className="hud-notice-pill" aria-live="polite">
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
