const TARGET_SAMPLE_RATE = 16000;

type FrameHandler = (frame: ArrayBuffer) => void;

export class MicrophoneCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private active = false;

  async start(onFrame: FrameHandler): Promise<void> {
    // 新一轮采集开始前先清理旧上下文，处理快速重试造成的竞态。
    this.stop();
    this.active = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (error) {
      this.active = false;
      throw error;
    }
    if (!this.active) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    await this.context.resume();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(1024, 1, 1);
    this.processor.onaudioprocess = (event) => {
      if (!this.active) return;
      const samples = resampleTo16k(
        event.inputBuffer.getChannelData(0),
        event.inputBuffer.sampleRate,
      );
      onFrame(toPcm16(samples));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop(): void {
    this.active = false;
    this.source?.disconnect();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}

function resampleTo16k(
  samples: Float32Array,
  inputSampleRate: number,
): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return samples;
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const nextIndex = Math.min(index + 1, samples.length - 1);
    const fraction = position - index;
    result[i] =
      samples[index] + (samples[nextIndex] - samples[index]) * fraction;
  }
  return result;
}

function toPcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  });
  return buffer;
}
