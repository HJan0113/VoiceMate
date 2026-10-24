export class PcmStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private scheduledTime = 0;
  private isPlaying = false;
  private muted = false;

  constructor(private readonly sampleRate = 16000) {}

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

    const now = this.audioCtx.currentTime;
    const startTime = Math.max(now, this.scheduledTime);
    source.start(startTime);
    this.scheduledTime = startTime + audioBuffer.duration;
    this.isPlaying = true;

    source.onended = () => {
      if (
        this.audioCtx &&
        this.audioCtx.currentTime >= this.scheduledTime - 0.05
      ) {
        this.isPlaying = false;
      }
    };
  }

  stop(): void {
    if (this.audioCtx) {
      this.scheduledTime = this.audioCtx.currentTime;
      this.isPlaying = false;
    }
  }

  close(): void {
    this.stop();
    void this.audioCtx?.close();
    this.audioCtx = null;
  }
}
