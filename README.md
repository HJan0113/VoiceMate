# VoiceMate

VoiceMate 是一个基于七牛灵矽 AI 的实时语音聊天伙伴脚手架。

项目只保留两个部分：

- `frontend/`：React，负责界面、麦克风 PCM 采集、WebSocket 客户端和 Node 依赖。
- `backend/`：Go + Gin，负责 REST API、WebSocket 实时桥接和 AI Provider 适配接口。

## 本地启动

前端：

```bash
cd frontend
pnpm install
pnpm dev   # http://localhost:5173
```

后端：

```bash
cd backend
go run ./cmd/voicemate   # http://localhost:8080
```

HTTP 与 WebSocket contract：[`backend/openapi.yaml`](backend/openapi.yaml)。后端启动后也可访问 `http://localhost:8080/openapi.yaml`。
