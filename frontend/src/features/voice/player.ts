export class PcmStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private scheduledTime = 0;
  private muted = false;
  private readonly sampleRate: number;
  private readonly activeSources = new Set<AudioBufferSourceNode>();
  private readonly idleListeners = new Set<() => void>();

  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
  }

  ensureContext(): void {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: this.sampleRate });
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
  }

  feed(arrayBuffer: ArrayBuffer): void {
    if (this.muted) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    const int16 = new Int16Array(arrayBuffer);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = this.audioCtx.createBuffer(
      1,
      float32.length,
      this.sampleRate,
    );
    audioBuffer.copyToChannel(float32, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioCtx.destination);
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) this.notifyIdle();
    };

    const now = this.audioCtx.currentTime;
    const startTime = Math.max(now, this.scheduledTime);
    source.start(startTime);
    this.scheduledTime = startTime + audioBuffer.duration;
  }

  stop(): void {
    if (this.audioCtx) {
      this.scheduledTime = this.audioCtx.currentTime;
    }
    for (const source of this.activeSources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.activeSources.clear();
    this.notifyIdle();
  }

  isPlaying(): boolean {
    return this.activeSources.size > 0;
  }

  onIdle(listener: () => void): () => void {
    this.idleListeners.add(listener);
    return () => this.idleListeners.delete(listener);
  }

  close(): void {
    this.stop();
    void this.audioCtx?.close();
    this.audioCtx = null;
  }

  private notifyIdle(): void {
    if (this.activeSources.size > 0) return;
    this.idleListeners.forEach((listener) => listener());
  }
}
