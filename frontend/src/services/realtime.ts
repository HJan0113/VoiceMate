import type { ServerEvent } from "../domain/types";

type Listener = (event: ServerEvent) => void;
type AudioChunkListener = (chunk: ArrayBuffer) => void;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly audioListeners = new Set<AudioChunkListener>();
  private sequence = 0;

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onAudio(listener: AudioChunkListener): () => void {
    this.audioListeners.add(listener);
    return () => this.audioListeners.delete(listener);
  }

  connect(wsUrl: string, token: string): Promise<void> {
    // 连接前关闭旧 socket，确保重试不会留下并行连接。
    this.close();
    const url = new URL(wsUrl, window.location.origin);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      let opened = false;
      socket.onopen = () => {
        if (this.socket !== socket) return;
        socket.send(
          JSON.stringify({ type: "auth", token, protocolVersion: 1 }),
        );
        opened = true;
        resolve();
      };
      socket.onerror = () => {
        if (this.socket !== socket) return;
        if (!opened) reject(new Error("实时连接失败"));
      };
      socket.onmessage = (message) => {
        if (this.socket !== socket) return;
        if (typeof message.data === "string") {
          try {
            this.emit(JSON.parse(message.data) as ServerEvent);
          } catch {
            this.emit({ type: "error", code: "INVALID_SERVER_MESSAGE" });
          }
          return;
        }
        if (message.data instanceof ArrayBuffer) {
          // VoiceMate 二进制下行音频帧包含 16 字节报头
          if (message.data.byteLength > 16) {
            const pcmPayload = message.data.slice(16);
            this.audioListeners.forEach((listener) => listener(pcmPayload));
          }
        }
      };
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        if (opened) this.emit({ type: "connection.closed" });
        else reject(new Error("实时连接失败"));
      };
    });
  }

  startTurn(clientTurnId: string): void {
    this.send({ type: "turn.start", clientTurnId });
  }
  stopTurn(): void {
    this.send({ type: "turn.stop" });
  }
  interrupt(): void {
    this.send({ type: "turn.interrupt" });
  }

  sendAudio(payload: ArrayBuffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const header = new ArrayBuffer(16);
    const view = new DataView(header);
    view.setUint8(0, 1);
    view.setUint8(1, 1);
    view.setUint32(4, 1);
    view.setUint32(8, this.sequence++);
    view.setUint32(12, payload.byteLength);
    const frame = new Uint8Array(16 + payload.byteLength);
    frame.set(new Uint8Array(header));
    frame.set(new Uint8Array(payload), 16);
    this.socket.send(frame);
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    // 清除旧连接的回调，避免关闭和消息事件污染新会话。
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
  }
  private send(value: object): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(value));
  }
  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
