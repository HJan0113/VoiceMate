// 浏览器原生实时 PCM 音频流播放器 (16kHz 16-bit 单声道)
class PcmStreamPlayer {
  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
    this.audioCtx = null;
    this.scheduledTime = 0;
    this.isPlaying = false;
  }

  ensureContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // 接收服务端推送的 16kHz PCM 二进制帧并无缝排队播放
  feed(arrayBuffer) {
    this.ensureContext();
    const int16 = new Int16Array(arrayBuffer);
    if (int16.length === 0) return;

    // 转换 signed int16 (-32768 ~ 32767) 为 float32 (-1.0 ~ 1.0)
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = this.audioCtx.createBuffer(1, float32.length, this.sampleRate);
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
      if (this.audioCtx.currentTime >= this.scheduledTime - 0.05) {
        this.isPlaying = false;
      }
    };
  }

  stop() {
    if (this.audioCtx) {
      this.scheduledTime = this.audioCtx.currentTime;
      this.isPlaying = false;
    }
  }
}

// 麦克风录音与重采样器 (重采样为 16kHz 16-bit 单声道 PCM 流)
class MicStreamer {
  constructor(onPcmChunk) {
    this.onPcmChunk = onPcmChunk;
    this.stream = null;
    this.audioCtx = null;
    this.processor = null;
    this.isRecording = false;
  }

  async start() {
    if (this.isRecording) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.stream);

      // 创建 2048 采样点缓冲区处理节点
      this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);
      const inputSampleRate = this.audioCtx.sampleRate;

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16k = this.resampleTo16k(inputData, inputSampleRate);
        if (pcm16k.byteLength > 0 && this.onPcmChunk) {
          this.onPcmChunk(pcm16k);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);
      this.isRecording = true;
      console.log(`[Mic] 麦克风已开启，采集率: ${inputSampleRate}Hz -> 16000Hz PCM`);
    } catch (err) {
      console.error("[Mic Error] 无法访问麦克风:", err);
      alert("无法访问麦克风，请在浏览器地址栏检查麦克风权限！");
      throw err;
    }
  }

  // 线性重采样并量化为 16-bit PCM (Little-Endian)
  resampleTo16k(inputData, inputRate) {
    const targetRate = 16000;
    if (inputRate === targetRate) {
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16.buffer;
    }

    const ratio = inputRate / targetRate;
    const newLen = Math.round(inputData.length / ratio);
    const int16 = new Int16Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const idx = Math.floor(i * ratio);
      const s = Math.max(-1, Math.min(1, inputData[idx]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16.buffer;
  }

  stop() {
    this.isRecording = false;
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    console.log("[Mic] 麦克风录音已停止");
  }
}

// 枫丹水神伴侣全流程调度
class FurinaCompanion {
  constructor() {
    this.video = document.getElementById('furina-video');
    this.bubbleText = document.getElementById('bubble-text');
    this.emotionTag = document.getElementById('emotion-tag');
    this.statusText = document.querySelector('.status-text');
    this.statusDot = document.querySelector('.status-dot');
    this.chatInput = document.getElementById('chat-input');
    this.btnSend = document.getElementById('btn-send');
    this.btnMic = document.getElementById('btn-mic');
    this.micText = this.btnMic ? this.btnMic.querySelector('.mic-text') : null;
    this.btnPip = document.getElementById('btn-pip');
    this.btnMute = document.getElementById('btn-mute');
    this.muteIcon = document.getElementById('mute-icon');

    this.ws = null;
    this.sessionId = null;
    this.isMuted = false;
    this.typingTimer = null;
    this.pcmPlayer = new PcmStreamPlayer(16000);
    this.isRecording = false;

    // 初始化麦克风流式传输器：采集一帧直接向灵矽推送一帧二进制 PCM
    this.micStreamer = new MicStreamer((pcmBuffer) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isRecording) {
        this.ws.send(pcmBuffer);
      }
    });

    this.bindEvents();
    this.connectWebSocket();
    this.ensureVideoPlaying();
  }

  ensureVideoPlaying() {
    this.video.play().catch(() => {
      const wakeUp = () => {
        this.video.play();
        this.pcmPlayer.ensureContext();
        window.removeEventListener('click', wakeUp);
      };
      window.addEventListener('click', wakeUp);
    });
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/companion`;

    this.statusText.innerText = "灵矽AI 正在连接...";
    this.statusDot.style.backgroundColor = "#f59e0b";

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log("[WS] 已连接灵矽代理网关");
        this.statusText.innerText = "灵矽AI 实时通话中 · 芙宁娜";
        this.statusDot.style.backgroundColor = "#10b981";
      };

      this.ws.onmessage = (event) => {
        // 二进制帧：芙宁娜原神原版音色 PCM 语音流
        if (event.data instanceof ArrayBuffer) {
          if (!this.isMuted) {
            this.pcmPlayer.feed(event.data);
          }
          return;
        }

        // 文本帧：JSON 控制信令
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.warn("[WS Parse Error]", e, event.data);
        }
      };

      this.ws.onclose = () => {
        this.statusText.innerText = "连接断开，重连中...";
        this.statusDot.style.backgroundColor = "#ef4444";
        setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn("[WS Error]", err);
      };
    } catch (e) {
      console.warn("[WS Init Failed]", e);
    }
  }

  handleServerMessage(msg) {
    console.log("[Linx Event]", msg);

    // 1. 握手确认
    if (msg.type === 'hello' && msg.session_id) {
      this.sessionId = msg.session_id;
      console.log("[Linx Ready] Session ID:", this.sessionId);
    }

    // 2. 语音识别 (STT) 结果：用户说话转文本
    if (msg.type === 'stt' && msg.text) {
      this.bubbleText.innerText = `你：「${msg.text}」`;
      this.emotionTag.innerText = "👂 倾听完毕";
    }

    // 3. LLM 情感与表情信令
    if (msg.type === 'llm') {
      const emotionMap = {
        'happy': '😊 娇俏得意',
        'proud': '✨ 优雅从容',
        'embarrassed': '😳 害羞慌乱',
        'thinking': '🤔 认真思考',
        'angry': '😤 傲娇反驳',
        'neutral': '🎭 舞台名伶'
      };
      this.emotionTag.innerText = emotionMap[msg.emotion] || (msg.text ? `${msg.text} 灵动` : '✨ 枫丹名伶');
    }

    // 4. TTS 语音合成事件
    if (msg.type === 'tts') {
      if (msg.state === 'sentence_start' && msg.text) {
        this.typeWriter(msg.text);
      }
      if (msg.state === 'start') {
        this.video.playbackRate = 1.08;
      }
      if (msg.state === 'stop') {
        this.video.playbackRate = 1.0;
      }
    }
  }

  typeWriter(text) {
    if (this.typingTimer) clearInterval(this.typingTimer);
    this.bubbleText.innerText = "";
    let i = 0;
    this.typingTimer = setInterval(() => {
      if (i < text.length) {
        this.bubbleText.innerText += text.charAt(i);
        i++;
      } else {
        clearInterval(this.typingTimer);
      }
    }, 28);
  }

  // 开始语音说话（按住/点击说话）
  async startVoiceRecording() {
    this.pcmPlayer.ensureContext();
    this.pcmPlayer.stop(); // 打断当前正在播报的语音

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      alert("尚未连上灵矽服务，请稍候再试");
      return;
    }

    try {
      await this.micStreamer.start();
      this.isRecording = true;

      // 通知服务器：开始录音监听
      this.ws.send(JSON.stringify({
        session_id: this.sessionId,
        type: "listen",
        state: "start",
        mode: "auto"
      }));

      // 更新 UI 状态
      this.btnMic.classList.add('recording');
      this.micText.innerText = "松开发送";
      this.bubbleText.innerText = "「正在聆听你的声音……请对我说话吧！」";
      this.emotionTag.innerText = "🎙️ 正在倾听";
    } catch (e) {
      console.warn("Start voice recording failed", e);
    }
  }

  // 结束语音说话并触发识别与回答
  stopVoiceRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    // 停止麦克风采集
    this.micStreamer.stop();

    // 通知服务器：结束录音监听，触发 ASR 与 LLM 回复
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        session_id: this.sessionId,
        type: "listen",
        state: "stop"
      }));
    }

    // 恢复 UI 状态
    this.btnMic.classList.remove('recording');
    this.micText.innerText = "按住说话";
    this.emotionTag.innerText = "🤔 正在理解";
  }

  // 文本交互发送
  sendChat() {
    this.pcmPlayer.ensureContext();
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.chatInput.value = "";
    this.bubbleText.innerText = `你：「${text}」……`;
    this.emotionTag.innerText = "🤔 倾听中";

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        session_id: this.sessionId,
        type: "listen",
        state: "detect",
        text: text
      }));
    }
  }

  // 点击部位交互
  async triggerInteract(part) {
    this.pcmPlayer.ensureContext();
    try {
      const res = await fetch('/api/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part: part })
      });
      const data = await res.json();
      if (data.code === 0 && data.data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionId) {
          const prompt = part === 'head' 
            ? '（观众轻摸了你的礼帽，称赞你很有魅力）' 
            : '（观众轻戳了你的身躯，向你打招呼）';
          
          this.ws.send(JSON.stringify({
            session_id: this.sessionId,
            type: "listen",
            state: "detect",
            text: prompt
          }));
        } else {
          this.typeWriter(data.data.text);
        }

        this.emotionTag.innerText = part === 'head' ? "🥰 备受宠溺" : "😳 轻微炸毛";
      }
    } catch (e) {
      console.warn("Interact error", e);
    }
  }

  bindEvents() {
    // 语音录音交互：支持鼠标按住说话 / 松开发送
    if (this.btnMic) {
      // 鼠标按下：开始说话
      this.btnMic.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.startVoiceRecording();
      });

      // 鼠标松开或移出：结束说话并发送
      this.btnMic.addEventListener('mouseup', (e) => {
        e.preventDefault();
        this.stopVoiceRecording();
      });
      this.btnMic.addEventListener('mouseleave', () => {
        if (this.isRecording) {
          this.stopVoiceRecording();
        }
      });

      // 移动端/触屏支持：touchstart / touchend
      this.btnMic.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.startVoiceRecording();
      });
      this.btnMic.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.stopVoiceRecording();
      });
    }

    // 触摸部位
    document.getElementById('hitbox-head').addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerInteract('head');
    });
    document.getElementById('btn-touch-head').addEventListener('click', () => {
      this.triggerInteract('head');
    });

    document.getElementById('hitbox-body').addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerInteract('body');
    });
    document.getElementById('btn-poke').addEventListener('click', () => {
      this.triggerInteract('body');
    });

    // 文本发送
    this.btnSend.addEventListener('click', () => this.sendChat());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendChat();
      }
    });

    // 悬浮画中画
    this.btnPip.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (this.video.requestPictureInPicture) {
          await this.video.requestPictureInPicture();
        }
      } catch (err) {
        alert("当前浏览器暂不支持画中画");
      }
    });

    // 静音
    this.btnMute.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        this.pcmPlayer.stop();
        this.muteIcon.innerText = '🔇';
      } else {
        this.pcmPlayer.ensureContext();
        this.muteIcon.innerText = '🔊';
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new FurinaCompanion();
});
