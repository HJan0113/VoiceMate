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
	payload := map[string]interface{}{
		"version":     0,
		"uuid":        p.cfg.ClientID,
		"mac_address": p.cfg.DeviceMAC,
		"application": map[string]interface{}{
			"name":         "voicemate-web",
			"version":      "1.0.0",
			"compile_time": "2026-10-23 17:00:00",
			"idf_version":  "1.0.0",
			"elf_sha256":   "1234567890abcdef1234567890abcdef1234567890abcdef",
		},
		"board": map[string]interface{}{
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

	req, err := http.NewRequest("POST", p.cfg.OTAGateway, bytes.NewBuffer(bodyBytes))
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
	defer resp.Body.Close()

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
	conn, _, err := dialer.DialContext(ctx, wsURL, header)
	if err != nil {
		return fmt.Errorf("linx dial error: %w", err)
	}

	helloMsg := map[string]interface{}{
		"type":      "hello",
		"version":   1,
		"transport": "websocket",
		"features": map[string]interface{}{
			"mcp": true,
		},
		"audio_params": map[string]interface{}{
			"format":         "pcm",
			"sample_rate":    16000,
			"channels":       1,
			"bit_depth":      16,
			"frame_duration": 20,
		},
	}
	if err := conn.WriteJSON(helloMsg); err != nil {
		conn.Close()
		return fmt.Errorf("linx send hello error: %w", err)
	}

	// 同步等待并读取 Linx AI 的 hello 握手响应，必须先提取真正的 session_id
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, respData, err := conn.ReadMessage()
	_ = conn.SetReadDeadline(time.Time{})
	if err != nil {
		conn.Close()
		return fmt.Errorf("linx read hello response error: %w", err)
	}

	var helloResp struct {
		Type      string `json:"type"`
		SessionID string `json:"session_id"`
	}
	if err := json.Unmarshal(respData, &helloResp); err != nil || helloResp.SessionID == "" {
		conn.Close()
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
		p.mu.Lock()
		if p.conn == conn {
			p.conn = nil
			if p.stream != nil {
				p.stream.Close()
			}
		}
		p.mu.Unlock()
		_ = conn.Close()
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
			}
		case "llm":
			emotion := event.Emotion
			if emotion == "" {
				emotion = "happy"
			}
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

	// 发送 listen: start
	startMsg := map[string]interface{}{
		"session_id": p.sessionID,
		"type":       "listen",
		"state":      "start",
		"mode":       "auto",
	}
	p.writeMu.Lock()
	err := p.conn.WriteJSON(startMsg)
	p.writeMu.Unlock()
	if err != nil {
		p.conn.Close()
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
		msg := map[string]interface{}{
			"session_id": s.provider.sessionID,
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
		stopMsg := map[string]interface{}{
			"session_id": s.provider.sessionID,
			"type":       "listen",
			"state":      "stop",
		}
		_ = s.provider.writeJSON(stopMsg)
	})
}

func (s *stream) Interrupt() {
	s.close.Do(func() {
		// 向灵矽 AI 下发 abort 终止指令
		abortMsg := map[string]interface{}{
			"session_id": s.provider.sessionID,
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
