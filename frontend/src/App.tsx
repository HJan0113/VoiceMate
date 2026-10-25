import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [state, setState] = useState<ConnectionState>("connecting");
  const [notice, setNotice] = useState("正在连接灵矽服务...");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [emotion, setEmotion] = useState<string>("neutral");
  const [assistantText, setAssistantText] = useState<string>("");

  const client = useMemo(() => new RealtimeClient(), []);
  const microphone = useMemo(() => new MicrophoneCapture(), []);
  const player = useMemo(() => new PcmStreamPlayer(16000), []);

  const turnId = useRef(`turn_${crypto.randomUUID()}`);
  const isRecordingRef = useRef(false);
  const mutedRef = useRef(false);
  const processingTimerRef = useRef<number | null>(null);
  const emotionResetTimerRef = useRef<number | null>(null);

  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current !== null) {
      window.clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);

  const clearEmotionResetTimer = useCallback(() => {
    if (emotionResetTimerRef.current !== null) {
      window.clearTimeout(emotionResetTimerRef.current);
      emotionResetTimerRef.current = null;
    }
  }, []);

  const startProcessingWatchdog = useCallback(() => {
    clearProcessingTimer();
    processingTimerRef.current = window.setTimeout(() => {
      if (!isRecordingRef.current) {
        client.interrupt();
        setState("ready");
        setNotice("未识别到有效语音或响应超时，按住按钮可重新说话");
      }
    }, 7000);
  }, [clearProcessingTimer, client]);

  // 页面加载时自动连接服务
  useEffect(() => {
    let canceled = false;
    const init = async () => {
      try {
        const nextSession = await createSession();
        if (canceled) return;
        setSession(nextSession);
        await client.connect(nextSession.wsUrl, nextSession.ephemeralToken);
      } catch {
        if (canceled) return;
        setState("error");
        setError("连接失败，请确认后端已启动（端口 8080）");
        setNotice("服务未连接");
      }
    };
    void init();
    return () => {
      canceled = true;
    };
  }, [client]);

  useEffect(() => {
    const releaseResources = () => {
      clearProcessingTimer();
      clearEmotionResetTimer();
      isRecordingRef.current = false;
      microphone.stop();
      player.close();
      client.close();
    };
    window.addEventListener("pagehide", releaseResources);
    return () => {
      window.removeEventListener("pagehide", releaseResources);
      releaseResources();
    };
  }, [
    clearEmotionResetTimer,
    clearProcessingTimer,
    client,
    microphone,
    player,
  ]);

  useEffect(() => {
    // 监听下行二进制 PCM 音频流
    const unlistenAudio = client.onAudio((chunk) => {
      if (!mutedRef.current) {
        player.feed(chunk);
      }
    });

    const unlistenEvents = client.on((event: ServerEvent) => {
      if (event.type === "session.ready") {
        clearProcessingTimer();
        setState("ready");
        setError(null);
        setNotice("服务已就绪 · 按住下方按钮开始说话");
      }
      if (event.type === "turn.started" && isRecordingRef.current) {
        clearProcessingTimer();
        clearEmotionResetTimer();
        setState("listening");
        setNotice("正在倾听你的声音... 松开发送");
      }
      if (event.type === "emotion.changed" && event.emotion) {
        clearEmotionResetTimer();
        setEmotion(event.emotion);
      }
      if (event.type === "transcript.final" && event.text) {
        setLines((current) => {
          if (
            event.turnId &&
            current.some(
              (line) => line.role === "user" && line.turnId === event.turnId,
            )
          ) {
            return current;
          }
          return [
            ...current,
            {
              id: `user_${event.turnId ?? Date.now()}`,
              role: "user" as const,
              text: event.text!,
              turnId: event.turnId,
            },
          ];
        });
        setState("processing");
        setNotice("正在思考回复...");
        startProcessingWatchdog();
      }
      if (event.type === "response.delta" && event.text) {
        clearProcessingTimer();
        setState("speaking");
        setAssistantText((prev) => prev + event.text!);
        setLines((current) => {
          const last = current.at(-1);
          if (last?.role === "assistant" && last.turnId === event.turnId) {
            return [
              ...current.slice(0, -1),
              { ...last, text: `${last.text}${event.text}` },
            ];
          }
          return [
            ...current,
            {
              id: `assistant_${event.turnId ?? Date.now()}`,
              role: "assistant",
              text: event.text!,
              turnId: event.turnId,
            },
          ];
        });
      }
      if (event.type === "turn.completed" || event.type === "audio.end") {
        clearProcessingTimer();
        if (!isRecordingRef.current) {
          setState("ready");
          setNotice("按住下方按钮开始说话");
        }
        clearEmotionResetTimer();
        emotionResetTimerRef.current = window.setTimeout(() => {
          setEmotion("neutral");
        }, 3500);
      }
      if (event.type === "connection.closed") {
        clearProcessingTimer();
        isRecordingRef.current = false;
        microphone.stop();
        player.stop();
        setState("error");
        setError("实时连接已断开，请重试连接");
        setNotice("连接断开");
      }
      if (event.type === "error") {
        clearProcessingTimer();
        isRecordingRef.current = false;
        microphone.stop();
        player.stop();
        setState("error");
        setError(
          event.code
            ? `实时服务错误（${event.code}），请重试`
            : "实时服务返回错误，请重试",
        );
        setNotice("连接异常");
      }
    });

    return () => {
      unlistenAudio();
      unlistenEvents();
    };
  }, [
    clearEmotionResetTimer,
    clearProcessingTimer,
    client,
    microphone,
    player,
    startProcessingWatchdog,
  ]);

  // 连接服务（用于重试或手动开始）
  async function startSession() {
    setError(null);
    client.close();
    player.ensureContext();
    setState("connecting");
    setNotice("正在连接灵矽AI伴侣服务...");
    try {
      const nextSession = await createSession();
      setSession(nextSession);
      await client.connect(nextSession.wsUrl, nextSession.ephemeralToken);
    } catch {
      setState("error");
      setError("连接失败，请确认后端已启动（端口 8080）");
      setNotice("服务未连接");
    }
  }

  // 按住说话：按下开始录音采集并推流
  async function startVoice() {
    if (state !== "ready" && state !== "speaking" && state !== "processing")
      return;
    clearProcessingTimer();
    setError(null);
    player.ensureContext();
    player.stop(); // 打断当前正在播放的声音
    if (state === "processing" || state === "speaking") {
      client.interrupt();
    }
    setAssistantText("");
    isRecordingRef.current = true;
    turnId.current = `turn_${crypto.randomUUID()}`;
    setState("listening");
    setNotice("正在倾听你的声音... 松开发送");
    client.startTurn(turnId.current);

    try {
      await microphone.start((frame) => {
        if (isRecordingRef.current && !mutedRef.current) {
          client.sendAudio(frame);
        }
      });
      if (!isRecordingRef.current) {
        microphone.stop();
      }
    } catch {
      if (isRecordingRef.current) {
        clearProcessingTimer();
        isRecordingRef.current = false;
        microphone.stop();
        client.interrupt();
        setState("ready");
        setError("无法访问麦克风，请在浏览器地址栏检查麦克风权限！");
        setNotice("麦克风未授权");
      }
    }
  }

  // 松开手指/鼠标：停止录音采集，通知服务端生成回答
  function stopVoice() {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    microphone.stop();
    client.stopTurn();
    setState("processing");
    setNotice("正在思考与回复中...");
    startProcessingWatchdog();
  }

  // 结束/重置会话
  function endSession() {
    clearProcessingTimer();
    isRecordingRef.current = false;
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
    setNotice("会话已断开，点击重新连接");
  }

  // 发送文本
  function sendText(text: string): boolean {
    if (!text || state !== "ready") return false;
    const clientTurnId = client.startTextTurn(text);
    if (!clientTurnId) return false;
    clearProcessingTimer();
    player.ensureContext();
    player.stop();
    setAssistantText("");

    setLines((current) => [
      ...current,
      {
        id: `user_${clientTurnId}`,
        role: "user",
        text,
        turnId: clientTurnId,
      },
    ]);

    setState("processing");
    setNotice("正在思考与回复中...");
    startProcessingWatchdog();
    return true;
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
      onSessionAction={() => void startSession()}
      onEndSession={endSession}
      onToggleMute={() => {
        mutedRef.current = !mutedRef.current;
        setMuted(mutedRef.current);
        player.setMuted(mutedRef.current);
      }}
      onStartVoice={() => void startVoice()}
      onStopVoice={stopVoice}
      onSendText={sendText}
    />
  );
}

export default App;
