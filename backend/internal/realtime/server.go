package realtime

import (
	"encoding/binary"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/kurodakayn/voicemate/internal/application"
	"github.com/kurodakayn/voicemate/internal/provider"
)

type Server struct {
	app      *application.Service
	provider provider.Provider
	upgrader websocket.Upgrader
}

func NewServer(app *application.Service, p provider.Provider) *Server {
	return &Server{app: app, provider: p, upgrader: websocket.Upgrader{ReadBufferSize: 4096, WriteBufferSize: 4096, CheckOrigin: func(*http.Request) bool { return true }}}
}

type control struct {
	Type            string `json:"type"`
	Token           string `json:"token,omitempty"`
	ProtocolVersion int    `json:"protocolVersion,omitempty"`
	TurnID          string `json:"turnId,omitempty"`
	ClientTurnID    string `json:"clientTurnId,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

const maxMessageBytes = 64 * 1024

func (s *Server) Handle(c *gin.Context) {
	connection, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer func() { _ = connection.Close() }()
	connection.SetReadLimit(maxMessageBytes)
	_ = connection.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, raw, err := connection.ReadMessage()
	if err != nil {
		return
	}
	var auth control
	if json.Unmarshal(raw, &auth) != nil || auth.Type != "auth" {
		_ = connection.WriteJSON(gin.H{"type": "error", "code": "AUTH_REQUIRED"})
		return
	}
	if auth.ProtocolVersion != 1 {
		_ = connection.WriteJSON(gin.H{"type": "error", "code": "UNSUPPORTED_PROTOCOL_VERSION"})
		return
	}
	session, err := s.app.VerifySession(c.Query("sessionId"), auth.Token)
	if err != nil {
		_ = connection.WriteJSON(gin.H{"type": "error", "code": "SESSION_UNAUTHORIZED"})
		return
	}
	_ = connection.SetReadDeadline(time.Time{})
	var writeMu sync.Mutex
	writeJSON := func(value any) error { writeMu.Lock(); defer writeMu.Unlock(); return connection.WriteJSON(value) }
	if err := writeJSON(gin.H{"type": "session.ready", "sessionId": session.ID, "serverTime": time.Now().UTC()}); err != nil {
		return
	}

	var stream provider.Stream
	var streamMu sync.Mutex
	for {
		messageType, data, readErr := connection.ReadMessage()
		if readErr != nil {
			streamMu.Lock()
			active := stream
			streamMu.Unlock()
			if active != nil {
				active.Close()
			}
			return
		}
		if messageType == websocket.BinaryMessage {
			payload, ok := parseUplinkAudioFrame(data)
			if !ok {
				_ = writeJSON(gin.H{"type": "error", "code": "INVALID_AUDIO_FRAME"})
				continue
			}
			streamMu.Lock()
			active := stream
			streamMu.Unlock()
			if active != nil {
				if err := active.SendAudio(payload); err != nil {
					active.Close()
					streamMu.Lock()
					if stream == active {
						stream = nil
					}
					streamMu.Unlock()
					_ = writeJSON(gin.H{"type": "error", "code": "UPSTREAM_UNAVAILABLE", "retryable": true})
				}
			}
			continue
		}
		var message control
		if json.Unmarshal(data, &message) != nil {
			_ = writeJSON(gin.H{"type": "error", "code": "INVALID_MESSAGE"})
			continue
		}
		switch message.Type {
		case "session.start":
			if message.ProtocolVersion != 1 {
				_ = writeJSON(gin.H{"type": "error", "code": "UNSUPPORTED_PROTOCOL_VERSION"})
			}
		case "turn.start":
			streamMu.Lock()
			if stream != nil {
				stream.Close()
			}
			stream, err = s.provider.Open(c, session.CharacterID, message.ClientTurnID)
			streamMu.Unlock()
			if err != nil {
				_ = writeJSON(gin.H{"type": "error", "code": "UPSTREAM_UNAVAILABLE", "retryable": true})
				continue
			}
			_ = writeJSON(gin.H{"type": "turn.started", "clientTurnId": message.ClientTurnID, "turnId": message.ClientTurnID, "streamId": 1})
			go s.forwardEvents(connection, &writeMu, stream)
		case "turn.stop":
			if stream != nil {
				stream.Stop()
			}
		case "turn.interrupt":
			if stream != nil {
				stream.Interrupt()
				_ = writeJSON(gin.H{"type": "turn.interrupted", "turnId": message.TurnID})
			}
		case "ping":
			_ = writeJSON(gin.H{"type": "pong", "ts": time.Now().UnixMilli()})
		default:
			_ = writeJSON(gin.H{"type": "error", "code": "UNKNOWN_MESSAGE"})
		}
	}
}

func (s *Server) forwardEvents(connection *websocket.Conn, writeMu *sync.Mutex, stream provider.Stream) {
	for event := range stream.Events() {
		writeMu.Lock()
		switch event.Type {
		case "audio.chunk":
			header := make([]byte, 16)
			header[0] = 1
			header[1] = 2
			binary.BigEndian.PutUint32(header[4:8], event.StreamID)
			binary.BigEndian.PutUint32(header[8:12], event.Sequence)
			binary.BigEndian.PutUint32(header[12:16], uint32(len(event.Audio))) //nolint:gosec // audio chunk payload length fits in uint32
			_ = connection.WriteMessage(websocket.BinaryMessage, append(header, event.Audio...))
		case "audio.meta":
			_ = connection.WriteJSON(gin.H{"type": event.Type, "turnId": event.TurnID, "streamId": event.StreamID, "codec": event.Codec, "sampleRate": event.SampleRate})
		case "audio.end":
			_ = connection.WriteJSON(gin.H{"type": event.Type, "turnId": event.TurnID, "streamId": event.StreamID})
		default:
			payload := gin.H{"type": event.Type, "turnId": event.TurnID}
			if event.Text != "" {
				payload["text"] = event.Text
			}
			if event.Emotion != "" {
				payload["emotion"] = event.Emotion
				payload["intensity"] = event.Intensity
			}
			_ = connection.WriteJSON(payload)
		}
		writeMu.Unlock()
	}
}

func parseUplinkAudioFrame(data []byte) ([]byte, bool) {
	if len(data) < 16 || data[0] != 1 || data[1] != 1 {
		return nil, false
	}
	payloadBytes := int(binary.BigEndian.Uint32(data[12:16]))
	payload := data[16:]
	if len(payload) != payloadBytes {
		return nil, false
	}
	return payload, true
}
