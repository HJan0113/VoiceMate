package linx

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestNewProviderDefaults(t *testing.T) {
	p := NewProvider(Config{})
	if p.cfg.FurinaAgent == "" {
		t.Errorf("expected default FurinaAgent, got empty")
	}
	if p.cfg.OTAGateway == "" {
		t.Errorf("expected default OTAGateway, got empty")
	}
}

func TestLinxProviderOpenWithoutValidNetwork(t *testing.T) {
	p := NewProvider(Config{
		OTAGateway: "http://127.0.0.1:9999/invalid",
	})
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	_, err := p.Open(ctx, "furina", "turn_test")
	if err == nil {
		t.Errorf("expected error connecting with canceled context, got nil")
	}
}

func TestReadLoopDisconnectDoesNotDeadlock(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	connClosed := make(chan struct{})
	var connCount atomic.Int32

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") == "websocket" {
			count := connCount.Add(1)
			c, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				return
			}
			defer func() { _ = c.Close() }()

			// Read hello
			_, _, err = c.ReadMessage()
			if err != nil {
				return
			}
			// Reply hello
			_ = c.WriteJSON(map[string]any{
				"type":       "hello",
				"session_id": "mock_session_123",
			})
			// Read listen start
			_, _, _ = c.ReadMessage()

			if count == 1 {
				// Wait until test signals disconnection on first connection
				<-connClosed
				return
			}

			// Keep second connection alive until client closes
			for {
				if _, _, err := c.ReadMessage(); err != nil {
					return
				}
			}
		}

		// OTA Gateway endpoint
		resp := map[string]any{
			"websocket": map[string]string{
				"url":   "ws://" + r.Host + "/ws",
				"token": "mock_token",
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	p := NewProvider(Config{
		OTAGateway: ts.URL,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	s1, err := p.Open(ctx, "furina", "turn-1")
	if err != nil {
		t.Fatalf("First Open failed: %v", err)
	}

	// Trigger server-side disconnect to simulate network drop on turn-1
	close(connClosed)

	done := make(chan struct{})
	go func() {
		// Drain events until stream 1 is closed
		for range s1.Events() {
		}

		// Subsequent turn.start calls p.Open; verify it does not hang and can reconnect
		s2, err := p.Open(ctx, "furina", "turn-2")
		if err != nil {
			t.Errorf("Subsequent Open failed: %v", err)
			close(done)
			return
		}
		defer s2.Close()

		if err := s2.SendAudio([]byte{0x00, 0x01}); err != nil {
			t.Errorf("SendAudio on reconnected stream failed: %v", err)
		}

		close(done)
	}()

	select {
	case <-done:
		// Passed without deadlock and successfully recovered on new turn
	case <-time.After(3 * time.Second):
		t.Fatal("deadlock detected: readLoop cleanup blocked on mutex, preventing subsequent turn.start")
	}
}
