export type ConnectionState =
  | "idle"
  | "connecting"
  | "ready"
  | "calling"
  | "speaking"
  | "listening"
  | "processing"
  | "error";

export type ChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
  turnId?: string;
};

export type Session = {
  sessionId: string;
  conversationId: string;
  wsUrl: string;
  ephemeralToken: string;
  expiresAt: string;
  audio: { input: AudioFormat; output: AudioFormat };
};

export type AudioFormat = {
  codec: string;
  sampleRate: number;
  channels: number;
};

export type ServerEvent = {
  type: string;
  code?: string;
  retryable?: boolean;
  sessionId?: string;
  turnId?: string;
  streamId?: number;
  text?: string;
  emotion?: string;
  intensity?: number;
  codec?: string;
  sampleRate?: number;
};
