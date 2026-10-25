// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "../domain/types";
import { RealtimeClient } from "./realtime";

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readonly sent: Array<string | ArrayBuffer> = [];
  readyState = 0;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;

  readonly url: string | URL;

  constructor(url: string | URL) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("RealtimeClient", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores callbacks from a replaced socket", async () => {
    const client = new RealtimeClient();
    const events: ServerEvent[] = [];
    client.on((event) => events.push(event));

    const firstConnection = client.connect("ws://localhost/first", "one");
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.open();
    await firstConnection;
    const staleClose = firstSocket.onclose;
    const staleMessage = firstSocket.onmessage;

    const secondConnection = client.connect("ws://localhost/second", "two");
    const secondSocket = MockWebSocket.instances[1];
    staleClose?.();
    staleMessage?.({
      data: JSON.stringify({ type: "connection.closed" }),
    } as MessageEvent);
    secondSocket.open();
    await secondConnection;

    expect(events).toEqual([]);
    expect(secondSocket.sent).toHaveLength(1);
  });

  it("does not emit a disconnect event for an intentional close", async () => {
    const client = new RealtimeClient();
    const events: ServerEvent[] = [];
    client.on((event) => events.push(event));

    const connection = client.connect("ws://localhost/first", "one");
    const socket = MockWebSocket.instances[0];
    socket.open();
    await connection;

    client.close();

    expect(events).toEqual([]);
  });

  it("starts a text turn before sending the text payload", async () => {
    const client = new RealtimeClient();
    const connection = client.connect("ws://localhost/realtime", "token");
    const socket = MockWebSocket.instances[0];
    socket.open();
    await connection;

    const turnId = client.startTextTurn("你好");

    expect(turnId).toMatch(/^turn_/);
    expect(socket.sent.slice(1)).toEqual([
      JSON.stringify({ type: "turn.start", clientTurnId: turnId }),
      JSON.stringify({ type: "chat.text", text: "你好" }),
    ]);
  });

  it("rejects a text turn when the socket is not open", () => {
    const client = new RealtimeClient();

    expect(client.startTextTurn("你好")).toBeNull();
  });
});
