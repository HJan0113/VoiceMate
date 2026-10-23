# VoiceMate Web

React + TypeScript + Vite 前端。默认从 `http://localhost:8080` 读取 API，可通过 `VITE_API_BASE` 覆盖。

```bash
pnpm dev
```

当前页面使用后端 `FakeProvider` 验证会话、WebSocket 控制帧、PCM 音频帧和情绪事件；七牛接入由 Go 服务端适配器负责。
