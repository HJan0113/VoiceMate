import { useEffect, useMemo, useRef, useState } from "react";
import type { Character, ServerEvent } from "./domain/types";
import { MicrophoneCapture } from "./features/voice/capture";
import { createSession, getCharacters } from "./services/api";
import { RealtimeClient } from "./services/realtime";
import "./App.css";

type ChatLine = { role: "user" | "assistant"; text: string; turnId?: string };

function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [connection, setConnection] = useState<
    "idle" | "connecting" | "ready" | "listening" | "speaking" | "error"
  >("idle");
  const [emotion, setEmotion] = useState("calm");
  const [notice, setNotice] = useState("正在加载角色配置…");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const client = useMemo(() => new RealtimeClient(), []);
  const microphone = useMemo(() => new MicrophoneCapture(), []);
  const turnId = useRef(`turn_${crypto.randomUUID()}`);
  const pressing = useRef(false);
  const turnActive = useRef(false);

  useEffect(() => {
    async function loadCharacters() {
      try {
        const items = await getCharacters();
        setCharacter(items[0] ?? null);
        setNotice("准备好和你聊天了");
      } catch {
        setNotice("API 未启动，请先运行 pnpm dev:backend");
      }
    }

    void loadCharacters();
    return () => {
      microphone.stop();
      client.close();
    };
  }, [client, microphone]);

  useEffect(
    () =>
      client.on((event: ServerEvent) => {
        if (event.type === "session.ready") {
          setConnection("ready");
          setNotice("连接已建立，按住按钮开始说话");
        }
        if (event.type === "turn.started" && pressing.current) {
          setConnection("listening");
          setNotice("正在聆听…");
        }
        if (event.type === "transcript.final" && event.text)
          setLines((current) => [
            ...current,
            { role: "user", text: event.text!, turnId: event.turnId },
          ]);
        if (event.type === "response.delta" && event.text) {
          setConnection("speaking");
          setLines((current) => {
            const targetTurnId = event.turnId ?? turnId.current;
            const last = current.at(-1);
            if (last?.role === "assistant" && last.turnId === targetTurnId) {
              return [
                ...current.slice(0, -1),
                { ...last, text: `${last.text}${event.text}` },
              ];
            }
            return [
              ...current,
              { role: "assistant", text: event.text!, turnId: targetTurnId },
            ];
          });
        }
        if (event.type === "emotion.changed" && event.emotion)
          setEmotion(event.emotion);
        if (event.type === "turn.completed" || event.type === "audio.end") {
          setConnection("ready");
          setNotice("轮次完成，继续聊聊吧");
        }
        if (event.type === "connection.closed") {
          pressing.current = false;
          turnActive.current = false;
          microphone.stop();
          setConnection("error");
          setNotice("实时连接已断开，请重试");
        }
        if (event.type === "error") {
          pressing.current = false;
          turnActive.current = false;
          microphone.stop();
          setConnection("error");
          setNotice("实时服务返回错误，请重试");
        }
      }),
    [client, microphone],
  );

  async function begin() {
    if (!character || connection === "connecting") return;
    if (connection === "idle" || connection === "error") {
      setConnection("connecting");
      setNotice("正在建立安全连接…");
      try {
        const session = await createSession(character.id);
        await client.connect(session.wsUrl, session.ephemeralToken);
        return;
      } catch {
        setConnection("error");
        setNotice("连接失败，请确认 pnpm dev:backend 已启动");
        return;
      }
    }
    pressing.current = true;
    turnActive.current = true;
    turnId.current = `turn_${crypto.randomUUID()}`;
    setConnection("listening");
    setNotice("正在聆听…");
    client.startTurn(turnId.current);
    try {
      await microphone.start((frame) => {
        if (pressing.current) client.sendAudio(frame);
      });
      if (!pressing.current) {
        microphone.stop();
      }
    } catch {
      if (pressing.current) {
        setNotice("无法访问麦克风，仍可用演示回路继续测试");
      }
    }
  }

  function end() {
    if (
      !pressing.current &&
      !turnActive.current &&
      connection !== "listening"
    ) {
      return;
    }
    pressing.current = false;
    turnActive.current = false;
    microphone.stop();
    client.stopTurn();
    if (connection === "listening") {
      setConnection("ready");
    }
  }

  const statusLabel = {
    idle: "未连接",
    connecting: "连接中",
    ready: "在线",
    listening: "聆听中",
    speaking: "回应中",
    error: "连接异常",
  }[connection];
  const video = character?.emotionProfiles[emotion]?.video;
  const talkLabel = connection === "listening" ? "松开结束" : "连接并开始";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◌</span>
          <span>VOICEMATE</span>
        </div>
        <span className="protocol">REALTIME / v1</span>
        <div className="status">
          <i className={`status-dot ${connection}`} />
          {statusLabel}
        </div>
      </header>
      <section className="hero-grid">
        <div className="intro">
          <p className="eyebrow">A COMPANION THAT LISTENS</p>
          <h1>
            让声音成为
            <br />
            <em>陪伴的入口。</em>
          </h1>
          <p className="lead">
            连接语音、情绪与角色，让每一次对话都留下有温度的回应。
          </p>
          <div className="capabilities">
            <span>16 kHz PCM</span>
            <span>LOW LATENCY</span>
            <span>EMOTION SYNC</span>
          </div>
        </div>
        <div className="companion-card">
          <div className="card-glow" />
          <div className="character-stage">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="character-placeholder">
              <span className="character-sigil">
                {character?.displayName.slice(0, 1) ?? "V"}
              </span>
              <span className="character-name">
                {character?.displayName ?? "VoiceMate"}
              </span>
              {video && <span className="video-hint">{video}</span>}
            </div>
            <div className="emotion-pill">
              <span className="pulse" />
              {emotion.toUpperCase()}
            </div>
          </div>
          <div className="conversation">
            <div className="conversation-label">LIVE TRANSCRIPT</div>
            {lines.length ? (
              lines.slice(-2).map((line) => (
                <p
                  className={`line ${line.role}`}
                  key={`${line.role}-${line.text}`}
                >
                  <b>{line.role === "user" ? "YOU" : "MATE"}</b>
                  {line.text}
                </p>
              ))
            ) : (
              <p className="empty-line">{notice}</p>
            )}
          </div>
        </div>
      </section>
      <section className="control-panel">
        <div>
          <p className="panel-label">VOICE SESSION</p>
          <h2>{notice}</h2>
        </div>
        <button
          type="button"
          className={`talk-button ${connection === "listening" ? "active" : ""}`}
          onPointerDown={begin}
          onPointerUp={end}
          onPointerLeave={end}
          disabled={!character || connection === "connecting"}
        >
          <span className="mic-ring">
            {connection === "listening" ? "■" : "◉"}
          </span>
          <span>{connection === "ready" ? "按住说话" : talkLabel}</span>
        </button>
      </section>
      <footer>
        <span>FakeProvider 已启用 · 可替换为七牛灵矽 AI</span>
        <span>API / WS bridge scaffold</span>
      </footer>
    </main>
  );
}

export default App;
