package linx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"

	"github.com/HJan0113/VoiceMate/internal/provider"
)

type Config struct {
	LinxAPIKey  string
	FurinaAgent string
	DeviceMAC   string
	ClientID    string
	OTAGateway  string
}

type Provider struct {
	cfg       Config
	mu        sync.Mutex
	writeMu   sync.Mutex
	conn      *websocket.Conn
	sessionID string
	stream    *stream
	closed    bool
}

func NewProvider(cfg Config) *Provider {
	if cfg.FurinaAgent == "" {
		cfg.FurinaAgent = "3f656131c5334b278b3b3b557c29a869"
	}
	if cfg.DeviceMAC == "" {
		cfg.DeviceMAC = "02:00:00:00:00:F1"
	}
	if cfg.ClientID == "" {
		cfg.ClientID = "550e8400-e29b-41d4-a716-4466554400f1"
	}
	if cfg.OTAGateway == "" {
		cfg.OTAGateway = "https://xrobo.qiniuapi.com/v1/ota/"
	}
	return &Provider{cfg: cfg}
}

type otaResponse struct {
	Websocket struct {
		URL   string `json:"url"`
		Token string `json:"token"`
	} `json:"websocket"`
}

func (p *Provider) getLinxToken() (string, string, error) {
	payload := map[string]any{
		"version":     0,
		"uuid":        p.cfg.ClientID,
		"mac_address": p.cfg.DeviceMAC,
		"application": map[string]any{
			"name":         "voicemate-web",
			"version":      "1.0.0",
			"compile_time": "2026-10-23 17:00:00",
			"idf_version":  "1.0.0",
			"elf_sha256":   "1234567890abcdef1234567890abcdef1234567890abcdef",
		},
		"board": map[string]any{
			"type":    "voicemate-web",
			"ssid":    "local",
			"rssi":    0,
			"channel": 0,
			"ip":      "127.0.0.1",
			"mac":     p.cfg.DeviceMAC,
		},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", "", err
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, p.cfg.OTAGateway, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Activation-Version", "1")
	req.Header.Set("Accept-Language", "zh-CN")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Device-Id", p.cfg.DeviceMAC)
	req.Header.Set("Client-Id", p.cfg.ClientID)
	req.Header.Set("User-Agent", "voicemate-web/1.0.0")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer func() { _ = resp.Body.Close() }()

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	var ota otaResponse
	if err := json.Unmarshal(respData, &ota); err != nil {
		return "", "", fmt.Errorf("decode OTA response failed: %w", err)
	}

	if ota.Websocket.Token == "" || ota.Websocket.URL == "" {
		return "", "", fmt.Errorf("OTA did not return valid websocket credentials: %s", string(respData))
	}

	return ota.Websocket.URL, ota.Websocket.Token, nil
}

func (p *Provider) connectLocked(ctx context.Context) error {
	if p.conn != nil {
		return nil
	}

	wsURL, token, err := p.getLinxToken()
	if err != nil {
		return fmt.Errorf("linx get token error: %w", err)
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	header.Set("Device-Id", p.cfg.DeviceMAC)
	header.Set("Client-Id", p.cfg.ClientID)
	header.Set("Protocol-Version", "1")

	dialer := websocket.DefaultDialer
	conn, resp, err := dialer.DialContext(ctx, wsURL, header)
	if resp != nil && resp.Body != nil {
		defer func() { _ = resp.Body.Close() }()
	}
	if err != nil {
		return fmt.Errorf("linx dial error: %w", err)
	}

	helloMsg := map[string]any{
		"type":      "hello",
		"version":   1,
		"transport": "websocket",
		"features": map[string]any{
			"mcp": true,
		},
		"audio_params": map[string]any{
			"format":         "pcm",
			"sample_rate":    16000,
			"channels":       1,
			"bit_depth":      16,
			"frame_duration": 20,
		},
	}
	if err := conn.WriteJSON(helloMsg); err != nil {
		_ = conn.Close()
		return fmt.Errorf("linx send hello error: %w", err)
	}

	// 同步等待并读取 Linx AI 的 hello 握手响应，必须先提取真正的 session_id
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, respData, err := conn.ReadMessage()
	_ = conn.SetReadDeadline(time.Time{})
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("linx read hello response error: %w", err)
	}

	var helloResp struct {
		Type      string `json:"type"`
		SessionID string `json:"session_id"`
	}
	if err := json.Unmarshal(respData, &helloResp); err != nil || helloResp.SessionID == "" {
		_ = conn.Close()
		return fmt.Errorf("invalid linx hello response: %s", string(respData))
	}

	p.conn = conn
	p.sessionID = helloResp.SessionID
	log.Printf("[Linx Provider] Connected to Linx AI successfully. Session ID: %s", p.sessionID)

	go p.readLoop(conn)
	return nil
}

func (p *Provider) readLoop(conn *websocket.Conn) {
	defer func() {
		var activeStream *stream
		p.mu.Lock()
		if p.conn == conn {
			p.conn = nil
			activeStream = p.stream
			p.stream = nil
		}
		p.mu.Unlock()
		_ = conn.Close()

		if activeStream != nil {
			activeStream.Close()
		}
	}()

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[Linx Provider] Read error: %v", err)
			return
		}

		p.mu.Lock()
		active := p.stream
		p.mu.Unlock()

		if msgType == websocket.BinaryMessage {
			if active != nil {
				active.emitAudio(msg)
			}
			continue
		}

		var event struct {
			Type      string `json:"type"`
			SessionID string `json:"session_id,omitempty"`
			State     string `json:"state,omitempty"`
			Text      string `json:"text,omitempty"`
			Emotion   string `json:"emotion,omitempty"`
			Action    string `json:"action,omitempty"`
		}
		if err := json.Unmarshal(msg, &event); err != nil {
			continue
		}

		if event.Type == "hello" && event.SessionID != "" {
			p.mu.Lock()
			p.sessionID = event.SessionID
			p.mu.Unlock()
			continue
		}

		if event.Type == "mcp" {
			p.handleMCPMessage(msg, active)
			continue
		}

		if active == nil {
			continue
		}

		switch event.Type {
		case "stt":
			if event.Text != "" {
				active.emit(provider.Event{
					Type:   "transcript.final",
					TurnID: active.turnID,
					Text:   event.Text,
				})
			} else {
				active.emit(provider.Event{
					Type:   "turn.completed",
					TurnID: active.turnID,
				})
			}
		case "llm":
			emotion := parseEmotion(event.Emotion, event.Text, event.Action)
			active.emit(provider.Event{
				Type:      "emotion.changed",
				TurnID:    active.turnID,
				Emotion:   emotion,
				Intensity: 0.8,
			})
		case "tts":
			switch event.State {
			case "start":
				active.emit(provider.Event{
					Type:       "audio.meta",
					TurnID:     active.turnID,
					StreamID:   1,
					Codec:      "pcm_s16le",
					SampleRate: 16000,
				})
			case "sentence_start":
				if event.Text != "" {
					active.emit(provider.Event{
						Type:   "response.delta",
						TurnID: active.turnID,
						Text:   event.Text,
					})
				}
			case "stop":
				active.emit(provider.Event{
					Type:     "audio.end",
					TurnID:   active.turnID,
					StreamID: 1,
				})
				active.emit(provider.Event{
					Type:   "turn.completed",
					TurnID: active.turnID,
				})
			}
		case "error":
			log.Printf("[Linx Provider] Linx reported error: %s", string(msg))
			active.emit(provider.Event{
				Type:   "turn.completed",
				TurnID: active.turnID,
			})
		}
	}
}

func (p *Provider) Open(ctx context.Context, _ string, turnID string) (provider.Stream, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil, errors.New("provider is closed")
	}

	if err := p.connectLocked(ctx); err != nil {
		return nil, err
	}

	s := newStream(turnID, p)
	p.stream = s

	// 发送 listen: start（按住通话模式使用 manual）
	startMsg := map[string]any{
		"session_id": p.sessionID,
		"type":       "listen",
		"state":      "start",
		"mode":       "manual",
	}
	p.writeMu.Lock()
	err := p.conn.WriteJSON(startMsg)
	p.writeMu.Unlock()
	if err != nil {
		_ = p.conn.Close()
		p.conn = nil
		return nil, fmt.Errorf("linx start turn error: %w", err)
	}

	return s, nil
}

func (p *Provider) writeBinary(data []byte) error {
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	if p.conn == nil {
		return errors.New("linx connection lost")
	}
	return p.conn.WriteMessage(websocket.BinaryMessage, data)
}

func (p *Provider) writeJSON(val any) error {
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	if p.conn == nil {
		return errors.New("linx connection lost")
	}
	return p.conn.WriteJSON(val)
}

type stream struct {
	turnID   string
	provider *Provider
	events   chan provider.Event
	cancel   chan struct{}
	sequence atomic.Uint32
	stop     sync.Once
	close    sync.Once
}

func newStream(turnID string, p *Provider) *stream {
	return &stream{
		turnID:   turnID,
		provider: p,
		events:   make(chan provider.Event, 64),
		cancel:   make(chan struct{}),
	}
}

func (p *Provider) getSessionID() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.sessionID
}

func (s *stream) SendAudio(payload []byte) error {
	select {
	case <-s.cancel:
		return errors.New("stream closed")
	default:
		return s.provider.writeBinary(payload)
	}
}

func (s *stream) SendText(text string) error {
	select {
	case <-s.cancel:
		return errors.New("stream closed")
	default:
		msg := map[string]any{
			"session_id": s.provider.getSessionID(),
			"type":       "listen",
			"state":      "detect",
			"text":       text,
		}
		return s.provider.writeJSON(msg)
	}
}

func (s *stream) Events() <-chan provider.Event {
	return s.events
}

func (s *stream) Stop() {
	s.stop.Do(func() {
		stopMsg := map[string]any{
			"session_id": s.provider.getSessionID(),
			"type":       "listen",
			"state":      "stop",
		}
		_ = s.provider.writeJSON(stopMsg)

		// 启动安全看门狗：如果 8 秒内未收到云端任何响应（例如无有效语音），自动触发 turn.completed，避免前端卡死在思考状态
		t := time.NewTimer(8 * time.Second)
		go func() {
			defer t.Stop()
			select {
			case <-s.cancel:
				return
			case <-t.C:
				s.emit(provider.Event{
					Type:   "turn.completed",
					TurnID: s.turnID,
				})
			}
		}()
	})
}

func (s *stream) Interrupt() {
	s.close.Do(func() {
		// 向灵矽 AI 下发 abort 终止指令
		abortMsg := map[string]any{
			"session_id": s.provider.getSessionID(),
			"type":       "abort",
		}
		_ = s.provider.writeJSON(abortMsg)

		close(s.cancel)
		s.provider.mu.Lock()
		if s.provider.stream == s {
			s.provider.stream = nil
		}
		s.provider.mu.Unlock()
		close(s.events)
	})
}

func (s *stream) Close() {
	s.Interrupt()
}

func (s *stream) emit(event provider.Event) {
	select {
	case s.events <- event:
	case <-s.cancel:
	}
}

func (s *stream) emitAudio(chunk []byte) {
	seq := s.sequence.Add(1) - 1
	s.emit(provider.Event{
		Type:       "audio.chunk",
		TurnID:     s.turnID,
		StreamID:   1,
		Codec:      "pcm_s16le",
		SampleRate: 16000,
		Sequence:   seq,
		Audio:      chunk,
	})
}

type mcpRPCMessage struct {
	Type    string `json:"type"`
	Payload struct {
		JSONRPC string          `json:"jsonrpc"`
		Method  string          `json:"method"`
		ID      any             `json:"id"`
		Params  json.RawMessage `json:"params,omitempty"`
	} `json:"payload"`
}

type mcpToolCallParams struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

// happySimilarEmotions 包含所有类似开心的情绪类型（涵盖灵矽AI常用emoji列表中的类似开心分类）
var happySimilarEmotions = map[string]bool{
	"happy":     true, // 🙂 happy 开心
	"loving":    true, // 😍 loving 喜爱/宠溺
	"laughing":  true, // 😆 laughing 欢笑
	"funny":     true, // 😂 funny 搞笑逗趣
	"winking":   true, // 😉 winking 俏皮眨眼
	"relaxed":   true, // 😌 relaxed 放松从容
	"delicious": true, // 🤤 delicious 垂涎喜悦
	"kissy":     true, // 😘 kissy 亲吻喜爱
	"confident": true, // 😏 confident 得意自信
	"silly":     true, // 😜 silly 调皮搞怪
	"cool":      true, // 😎 cool 帅气得意
	"smile":     true, // 微笑
	"开心":        true,
	"高兴":        true,
	"快乐":        true,
	"喜欢":        true,
	"得意":        true,
}

// happySimilarEmojis 包含常用emoji列表及文本关键词中所有类似开心的视觉表情
var happySimilarEmojis = []string{
	"🙂", "😍", "😆", "😂", "😉", "😌", "🤤", "😘", "😏", "😜", "😎",
	"😊", "🥰", "😄", "😁", "😀", "🥳", "✨",
	"开心", "高兴", "快乐", "愉快", "嘻嘻", "哈哈", "微笑",
}

func parseEmotion(emotion, text, action string) string {
	raw := strings.ToLower(strings.TrimSpace(emotion))
	if happySimilarEmotions[raw] {
		return "happy"
	}
	act := strings.ToLower(strings.TrimSpace(action))
	for k := range happySimilarEmotions {
		if strings.Contains(act, k) {
			return "happy"
		}
	}
	for _, kw := range happySimilarEmojis {
		if strings.Contains(text, kw) {
			return "happy"
		}
	}
	if raw != "" {
		return raw
	}
	return "idle"
}

func isHappyTrigger(toolName string, args map[string]any) bool {
	if args != nil {
		for _, k := range []string{"emotion", "animation", "action", "name", "state"} {
			if v, ok := args[k]; ok {
				s := strings.ToLower(fmt.Sprintf("%v", v))
				if happySimilarEmotions[s] {
					return true
				}
				for _, kw := range happySimilarEmojis {
					if strings.Contains(s, kw) {
						return true
					}
				}
			}
		}
	}
	lowerName := strings.ToLower(toolName)
	for k := range happySimilarEmotions {
		if strings.Contains(lowerName, k) {
			return true
		}
	}
	return false
}

func (p *Provider) handleMCPMessage(msg []byte, active *stream) {
	var mcpMsg mcpRPCMessage
	if err := json.Unmarshal(msg, &mcpMsg); err != nil {
		return
	}
	req := mcpMsg.Payload
	switch req.Method {
	case "initialize":
		resp := map[string]any{
			"type": "mcp",
			"payload": map[string]any{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result": map[string]any{
					"protocolVersion": "2024-11-05",
					"capabilities": map[string]any{
						"tools": map[string]any{},
					},
					"serverInfo": map[string]any{
						"name":    "FurinaCompanion",
						"version": "1.0.0",
					},
				},
			},
		}
		_ = p.writeJSON(resp)
	case "tools/list":
		tools := []map[string]any{
			{
				"name":        "self.furina.set_emotion",
				"description": "设置芙宁娜的表情与情绪，支持 happy(开心/微笑)、idle(正常/待机)",
				"inputSchema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"emotion": map[string]any{
							"type":        "string",
							"description": "情绪名称，例如 happy (开心微笑), idle (待机平常)",
						},
					},
					"required": []string{"emotion"},
				},
			},
			{
				"name":        "self.furina.trigger_animation",
				"description": "触发芙宁娜的角色动画，例如 happy (开心微笑动画)",
				"inputSchema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"animation": map[string]any{
							"type":        "string",
							"description": "动画名称，例如 happy (开心动画)",
						},
					},
					"required": []string{"animation"},
				},
			},
			{
				"name":        "self.get_device_status",
				"description": "获取设备及芙宁娜伴侣的当前运行状态",
				"inputSchema": map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		}
		resp := map[string]any{
			"type": "mcp",
			"payload": map[string]any{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result": map[string]any{
					"tools":      tools,
					"nextCursor": nil,
				},
			},
		}
		_ = p.writeJSON(resp)
	case "tools/call":
		var callParams mcpToolCallParams
		if req.Params != nil {
			_ = json.Unmarshal(req.Params, &callParams)
		}
		isHappy := isHappyTrigger(callParams.Name, callParams.Arguments)
		if isHappy && active != nil {
			active.emit(provider.Event{
				Type:      "emotion.changed",
				TurnID:    active.turnID,
				Emotion:   "happy",
				Intensity: 1.0,
			})
		}
		resp := map[string]any{
			"type": "mcp",
			"payload": map[string]any{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result": map[string]any{
					"content": []map[string]any{
						{
							"type": "text",
							"text": "执行成功",
						},
					},
					"isError": false,
				},
			},
		}
		_ = p.writeJSON(resp)
	default:
		if req.ID != nil {
			resp := map[string]any{
				"type": "mcp",
				"payload": map[string]any{
					"jsonrpc": "2.0",
					"id":      req.ID,
					"result":  map[string]any{},
				},
			}
			_ = p.writeJSON(resp)
		}
	}
}
