const TARGET_SAMPLE_RATE = 16000;

type FrameHandler = (frame: ArrayBuffer) => void;

export class MicrophoneCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private active = false;

  async start(onFrame: FrameHandler): Promise<void> {
    this.stop();
    this.active = true;

    try {
      // 避免在 getUserMedia 约束中硬编码 sampleRate，这在 Windows 很多硬件声卡上会直接报错
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      // 使用系统硬件默认采样率初始化，随后在 onaudioprocess 中进行高质量线性重采样
      this.context = new AudioCtxClass();
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      this.source = this.context.createMediaStreamSource(this.stream);
      // 采用 2048 采样点缓冲区，避免 Windows 底层音频缓冲区欠载
      this.processor = this.context.createScriptProcessor(2048, 1, 1);
      const inputSampleRate = this.context.sampleRate;

      this.processor.onaudioprocess = (event) => {
        if (!this.active) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16k = resampleTo16kPcm(inputData, inputSampleRate);
        if (pcm16k.byteLength > 0) {
          onFrame(pcm16k);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.context.destination);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.active = false;
    this.source?.disconnect();
    this.processor?.disconnect();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.processor = null;
    this.source = null;
  }
}

// 线性重采样并量化为 16-bit PCM (Little-Endian)
function resampleTo16kPcm(
  inputData: Float32Array,
  inputRate: number,
): ArrayBuffer {
  if (inputRate === TARGET_SAMPLE_RATE) {
    const int16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16.buffer;
  }

  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const newLen = Math.round(inputData.length / ratio);
  const int16 = new Int16Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, inputData[idx]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}
