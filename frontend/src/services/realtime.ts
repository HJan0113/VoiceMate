import type { ServerEvent } from "../domain/types";

type Listener = (event: ServerEvent) => void;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private sequence = 0;

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  connect(wsUrl: string, token: string): Promise<void> {
    const url = new URL(wsUrl, window.location.origin);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        socket.send(
          JSON.stringify({ type: "auth", token, protocolVersion: 1 }),
        );
        resolve();
      };
      socket.onerror = () => reject(new Error("实时连接失败"));
      socket.onmessage = (message) => {
        if (typeof message.data === "string")
          this.emit(JSON.parse(message.data) as ServerEvent);
      };
      socket.onclose = () => {
        this.socket = null;
        this.emit({ type: "connection.closed" });
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
    this.socket?.close();
    this.socket = null;
  }
  private send(value: object): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(value));
  }
  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
