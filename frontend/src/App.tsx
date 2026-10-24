import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatLine,
  ConnectionState,
  ServerEvent,
  Session,
} from "./domain/types";
import { PlatformLayout } from "./components/platform/PlatformLayout";
import { MicrophoneCapture } from "./features/voice/capture";
import { PcmStreamPlayer } from "./features/voice/player";
import { createSession } from "./services/api";
import { RealtimeClient } from "./services/realtime";
import "./App.css";

function App() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [notice, setNotice] = useState(
    "准备与芙宁娜实时通话，请点击下方「接通电话」",
  );
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [emotion, setEmotion] = useState<string>("neutral");
  const [assistantText, setAssistantText] = useState<string>("");

  const client = useMemo(() => new RealtimeClient(), []);
  const microphone = useMemo(() => new MicrophoneCapture(), []);
  const player = useMemo(() => new PcmStreamPlayer(16000), []);

  const turnId = useRef(`call_${crypto.randomUUID()}`);
  const inCallRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    const releaseResources = () => {
      inCallRef.current = false;
      microphone.stop();
      player.close();
      client.close();
    };
    window.addEventListener("pagehide", releaseResources);
    return () => {
      window.removeEventListener("pagehide", releaseResources);
      releaseResources();
    };
  }, [client, microphone, player]);

  useEffect(() => {
    // 监听下行二进制 PCM 语音流
    const unlistenAudio = client.onAudio((chunk) => {
      if (!mutedRef.current) {
        player.feed(chunk);
      }
    });

    const unlistenEvents = client.on((event: ServerEvent) => {
      if (event.type === "session.ready") {
        setState("calling");
        setError(null);
        setNotice("与芙宁娜实时通话中 · 请随时说话...");
      }
      if (event.type === "emotion.changed" && event.emotion) {
        setEmotion(event.emotion);
      }
      if (event.type === "transcript.final" && event.text) {
        setLines((current) => [
          ...current,
          {
            id: `user_${Date.now()}`,
            role: "user",
            text: event.text!,
          },
        ]);
      }
      if (event.type === "response.delta" && event.text) {
        setState("speaking");
        setAssistantText((prev) => prev + event.text!);
        setLines((current) => {
          const last = current.at(-1);
          if (last?.role === "assistant") {
            return [
              ...current.slice(0, -1),
              { ...last, text: `${last.text}${event.text}` },
            ];
          }
          return [
            ...current,
            {
              id: `assistant_${Date.now()}`,
              role: "assistant",
              text: event.text!,
            },
          ];
        });
      }
      if (event.type === "audio.end") {
        // 芙宁娜一段语音播放完毕，恢复为常驻通话倾听状态，麦克风继续工作
        if (inCallRef.current) {
          setState("calling");
          setNotice("与芙宁娜实时通话中 · 请随时说话...");
        }
      }
      if (event.type === "connection.closed") {
        inCallRef.current = false;
        microphone.stop();
        player.stop();
        setState("error");
        setError("通话连接已断开，可点击重新呼叫");
        setNotice("连接已断开");
      }
      if (event.type === "error") {
        inCallRef.current = false;
        microphone.stop();
        player.stop();
        setState("error");
        setError(
          event.code
            ? `实时服务错误（${event.code}），请重试`
            : "实时服务返回错误，请重试",
        );
        setNotice("通话异常");
      }
    });

    return () => {
      unlistenAudio();
      unlistenEvents();
    };
  }, [client, microphone, player]);

  // 接通实时电话
  async function startCall() {
    if (state !== "idle" && state !== "error") return;
    setError(null);
    client.close();
    player.ensureContext();
    setState("connecting");
    setNotice("正在呼叫芙宁娜，建立实时通话...");
    try {
      const nextSession = await createSession();
      setSession(nextSession);
      await client.connect(nextSession.wsUrl, nextSession.ephemeralToken);

      // 发起通话流
      turnId.current = `call_${crypto.randomUUID()}`;
      inCallRef.current = true;
      client.startTurn(turnId.current);

      // 立即开启麦克风全双工持续采集
      await microphone.start((frame) => {
        if (inCallRef.current && !mutedRef.current) {
          client.sendAudio(frame);
        }
      });
    } catch {
      inCallRef.current = false;
      microphone.stop();
      client.close();
      setState("error");
      setError("呼叫失败，请确认服务已启动或检查麦克风权限");
      setNotice("无法接通");
    }
  }

  // 挂断电话
  function endCall() {
    inCallRef.current = false;
    microphone.stop();
    player.stop();
    client.interrupt();
    client.close();
    setSession(null);
    mutedRef.current = false;
    setMuted(false);
    setAssistantText("");
    setState("idle");
    setError(null);
    setNotice("通话已挂断，可随时重新接通电话");
  }

  // 发送文本（打字或触摸彩蛋）
  function sendText(text: string) {
    if (!text) return;
    player.ensureContext();
    player.stop(); // 打断当前播放
    setAssistantText("");

    // 添加到聊天记录
    setLines((current) => [
      ...current,
      {
        id: `user_${Date.now()}`,
        role: "user",
        text,
      },
    ]);

    // 发送给灵矽 AI
    client.sendText(text);
  }

  return (
    <PlatformLayout
      state={state}
      notice={notice}
      error={error}
      sessionId={session?.sessionId}
      lines={lines}
      disabled={state === "connecting"}
      muted={muted}
      emotion={emotion}
      assistantText={assistantText}
      onSessionAction={() => void startCall()}
      onEndSession={endCall}
      onToggleMute={() => {
        mutedRef.current = !mutedRef.current;
        setMuted(mutedRef.current);
        player.setMuted(mutedRef.current);
      }}
      onSendText={sendText}
    />
  );
}

export default App;
