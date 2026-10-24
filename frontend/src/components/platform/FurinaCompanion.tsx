import { useEffect, useRef, useState } from "react";
import type { ConnectionState } from "../../domain/types";

type FurinaCompanionProps = {
  state: ConnectionState;
  emotion?: string;
  assistantText?: string;
  onSendText?: (text: string) => void;
};

const EMOTION_MAP: Record<string, string> = {
  happy: "😊 娇俏得意",
  proud: "✨ 优雅从容",
  embarrassed: "😳 害羞慌乱",
  thinking: "🤔 认真思考",
  angry: "😤 傲娇反驳",
  neutral: "🎭 枫丹名伶",
};

export function FurinaCompanion({
  state,
  emotion,
  assistantText,
  onSendText,
}: FurinaCompanionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [touchText, setTouchText] = useState("");
  const [touchEmotion, setTouchEmotion] = useState("");
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
  let bubbleText =
    "「欧庇克莱大剧院的帷幕永不落空，而你，就是本名伶最忠实的特约观众~」";
  if (assistantText) {
    bubbleText = `「${assistantText}」`;
  } else if (touchText) {
    bubbleText = touchText;
  }

  // 计算当前情绪角标
  let currentEmotion = "🎭 枫丹名伶";
  if (touchEmotion && !assistantText) {
    currentEmotion = touchEmotion;
  } else if (state === "calling" || state === "listening") {
    currentEmotion = "🎙️ 倾听中";
  } else if (state === "speaking") {
    currentEmotion = emotion
      ? EMOTION_MAP[emotion] || `💬 ${emotion}`
      : "💬 正在表达";
  } else if (emotion) {
    currentEmotion = EMOTION_MAP[emotion] || `✨ ${emotion}`;
  }

  // 交互彩蛋触发
  const triggerInteract = async (part: "head" | "body") => {
    const isCalling =
      state === "calling" || state === "speaking" || state === "listening";
    if (isCalling && onSendText) {
      const prompt =
        part === "head"
          ? "（观众轻摸了你的礼帽，称赞你很有魅力）"
          : "（观众轻戳了你的身躯，向你打招呼）";
      onSendText(prompt);
      setTouchEmotion(part === "head" ? "🥰 备受宠溺" : "😳 轻微炸毛");
      return;
    }

    try {
      const res = await fetch("/api/v1/characters/furina/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          code: number;
          data?: { text: string; emotion: string };
        };
        if (data.data?.text) {
          setTouchText(data.data.text);
          setTouchEmotion(part === "head" ? "🥰 备受宠溺" : "😳 轻微炸毛");
        }
      }
    } catch {
      // 离线备用彩蛋
      if (part === "head") {
        setTouchText(
          "「哼哼，怎么了？是折服于本水神的魅力，忍不住想要摸摸我的礼帽了吗？」",
        );
        setTouchEmotion("🥰 备受宠溺");
      } else {
        setTouchText(
          "「喂喂！注意你的举止，凡人！这可是枫丹最顶级的正装，弄皱了你可赔不起！」",
        );
        setTouchEmotion("😳 轻微炸毛");
      }
    }
  };

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
          <span className="emotion-badge">{currentEmotion}</span>
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

        {/* 头部与身体交互透明触控层 */}
        <div
          className="hitbox hitbox-head"
          onClick={() => void triggerInteract("head")}
          title="点击摸摸礼帽"
          role="button"
          tabIndex={0}
          aria-label="摸摸芙宁娜的礼帽"
        />
        <div
          className="hitbox hitbox-body"
          onClick={() => void triggerInteract("body")}
          title="点击戳戳身躯"
          role="button"
          tabIndex={0}
          aria-label="戳戳芙宁娜"
        />

        {/* 动态台词气泡 */}
        <div className="furina-bubble">
          <p className="bubble-content">{bubbleText}</p>
        </div>
      </div>

      <div className="furina-quick-actions">
        <button
          type="button"
          className="quick-action-btn"
          onClick={() => void triggerInteract("head")}
        >
          🎩 摸摸礼帽
        </button>
        <button
          type="button"
          className="quick-action-btn"
          onClick={() => void triggerInteract("body")}
        >
          👉 戳戳水神
        </button>
      </div>
    </section>
  );
}
