import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatLine,
  ConnectionState,
  ServerEvent,
  Session,
} from "./domain/types";
import { PlatformLayout } from "./components/platform/PlatformLayout";
import { MicrophoneCapture } from "./features/voice/capture";
import { createSession } from "./services/api";
import { RealtimeClient } from "./services/realtime";
import "./App.css";

function App() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [notice, setNotice] = useState("准备建立实时会话");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const client = useMemo(() => new RealtimeClient(), []);
  const microphone = useMemo(() => new MicrophoneCapture(), []);
  const turnId = useRef(`turn_${crypto.randomUUID()}`);
  const pressing = useRef(false);
  const turnActive = useRef(false);

  useEffect(() => {
    return () => {
      pressing.current = false;
      turnActive.current = false;
      microphone.stop();
      client.close();
    };
  }, [client, microphone]);

  useEffect(
    () =>
      client.on((event: ServerEvent) => {
        if (event.type === "session.ready") {
          setState("ready");
          setError(null);
          setNotice("连接已建立，按住按钮开始输入");
        }
        if (event.type === "turn.started" && pressing.current) {
          setState("listening");
          setNotice("正在接收输入…");
        }
        if (event.type === "transcript.final" && event.text) {
          setLines((current) => [
            ...current,
            {
              id: `${event.turnId ?? turnId.current}-user`,
              role: "user",
              text: event.text!,
              turnId: event.turnId,
            },
          ]);
          setState("processing");
        }
        if (event.type === "response.delta" && event.text) {
          setState("speaking");
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
              {
                id: `${targetTurnId}-assistant`,
                role: "assistant",
                text: event.text!,
                turnId: targetTurnId,
              },
            ];
          });
        }
        if (event.type === "turn.completed" || event.type === "audio.end") {
          turnActive.current = false;
          setState("ready");
          setNotice("本轮完成，可以继续输入");
        }
        if (event.type === "connection.closed") {
          pressing.current = false;
          turnActive.current = false;
          microphone.stop();
          setState("error");
          setError("实时连接已断开，请重试");
          setNotice("连接异常");
        }
        if (event.type === "error") {
          pressing.current = false;
          turnActive.current = false;
          microphone.stop();
          setState("error");
          setError("实时服务返回错误，请重试");
          setNotice("连接异常");
        }
      }),
    [client, microphone],
  );

  async function begin() {
    if (state === "connecting") return;
    setError(null);
    if (state === "idle" || state === "error") {
      setState("connecting");
      setNotice("正在建立实时会话…");
      try {
        const nextSession = await createSession();
        setSession(nextSession);
        await client.connect(nextSession.wsUrl, nextSession.ephemeralToken);
        return;
      } catch {
        setState("error");
        setError("连接失败，请确认服务已启动后重试");
        setNotice("无法建立会话");
        return;
      }
    }
    pressing.current = true;
    turnActive.current = true;
    turnId.current = `turn_${crypto.randomUUID()}`;
    setState("listening");
    setNotice("正在接收输入…");
    client.startTurn(turnId.current);
    try {
      await microphone.start((frame) => {
        if (pressing.current) client.sendAudio(frame);
      });
    } catch {
      if (pressing.current) {
        setError("无法访问麦克风，请检查浏览器权限");
        setNotice("麦克风不可用");
      }
    }
  }

  function end() {
    if (!pressing.current && !turnActive.current) return;
    pressing.current = false;
    turnActive.current = false;
    microphone.stop();
    client.stopTurn();
    if (state === "listening") {
      setState("processing");
      setNotice("正在处理输入…");
    }
  }

  return (
    <PlatformLayout
      state={state}
      notice={notice}
      error={error}
      sessionId={session?.sessionId}
      lines={lines}
      disabled={state === "connecting"}
      onPointerDown={() => void begin()}
      onPointerUp={end}
      onPointerLeave={end}
    />
  );
}

export default App;
