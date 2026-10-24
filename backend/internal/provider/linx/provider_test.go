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

func TestParseEmotion(t *testing.T) {
	tests := []struct {
		emotion  string
		text     string
		action   string
		expected string
	}{
		// 类似开心的情绪类型，全部归类为 happy
		{emotion: "happy", text: "", action: "", expected: "happy"},
		{emotion: "loving", text: "", action: "", expected: "happy"},
		{emotion: "laughing", text: "", action: "", expected: "happy"},
		{emotion: "funny", text: "", action: "", expected: "happy"},
		{emotion: "winking", text: "", action: "", expected: "happy"},
		{emotion: "relaxed", text: "", action: "", expected: "happy"},
		{emotion: "delicious", text: "", action: "", expected: "happy"},
		{emotion: "kissy", text: "", action: "", expected: "happy"},
		{emotion: "confident", text: "", action: "", expected: "happy"},
		{emotion: "silly", text: "", action: "", expected: "happy"},
		{emotion: "cool", text: "", action: "", expected: "happy"},
		{emotion: "开心", text: "", action: "", expected: "happy"},
		{emotion: "高兴", text: "", action: "", expected: "happy"},

		// 类似开心的常用 emoji 识别
		{emotion: "", text: "🙂", action: "", expected: "happy"},
		{emotion: "", text: "😍", action: "", expected: "happy"},
		{emotion: "", text: "😆", action: "", expected: "happy"},
		{emotion: "", text: "😂", action: "", expected: "happy"},
		{emotion: "", text: "😉", action: "", expected: "happy"},
		{emotion: "", text: "😌", action: "", expected: "happy"},
		{emotion: "", text: "🤤", action: "", expected: "happy"},
		{emotion: "", text: "😘", action: "", expected: "happy"},
		{emotion: "", text: "😏", action: "", expected: "happy"},
		{emotion: "", text: "😜", action: "", expected: "happy"},
		{emotion: "", text: "😎", action: "", expected: "happy"},
		{emotion: "", text: "今天真是太开心了", action: "", expected: "happy"},

		// 动作表情 action 触发
		{emotion: "", text: "", action: "winking_eye", expected: "happy"},
		{emotion: "", text: "", action: "happy_smile", expected: "happy"},

		// 类似伤心/哭泣的常用类型与 emoji 识别
		{emotion: "sad", text: "", action: "", expected: "sad"},
		{emotion: "crying", text: "", action: "", expected: "sad"},
		{emotion: "weeping", text: "", action: "", expected: "sad"},
		{emotion: "tears", text: "", action: "", expected: "sad"},
		{emotion: "伤心", text: "", action: "", expected: "sad"},
		{emotion: "难过", text: "", action: "", expected: "sad"},
		{emotion: "哭泣", text: "", action: "", expected: "sad"},
		{emotion: "", text: "😔", action: "", expected: "sad"},
		{emotion: "", text: "😭", action: "", expected: "sad"},
		{emotion: "", text: "😢", action: "", expected: "sad"},
		{emotion: "", text: "🥺", action: "", expected: "sad"},
		{emotion: "", text: "😿", action: "", expected: "sad"},
		{emotion: "", text: "听到这个消息我好难过", action: "", expected: "sad"},
		{emotion: "", text: "", action: "crying_tears", expected: "sad"},
		{emotion: "", text: "", action: "sad_face", expected: "sad"},

		// 类似愤怒/气恼的常用类型与 emoji 识别
		{emotion: "angry", text: "", action: "", expected: "angry"},
		{emotion: "pout", text: "", action: "", expected: "angry"},
		{emotion: "annoyed", text: "", action: "", expected: "angry"},
		{emotion: "furious", text: "", action: "", expected: "angry"},
		{emotion: "rage", text: "", action: "", expected: "angry"},
		{emotion: "mad", text: "", action: "", expected: "angry"},
		{emotion: "displeased", text: "", action: "", expected: "angry"},
		{emotion: "愤怒", text: "", action: "", expected: "angry"},
		{emotion: "生气", text: "", action: "", expected: "angry"},
		{emotion: "气恼", text: "", action: "", expected: "angry"},
		{emotion: "", text: "😠", action: "", expected: "angry"},
		{emotion: "", text: "😡", action: "", expected: "angry"},
		{emotion: "", text: "🤬", action: "", expected: "angry"},
		{emotion: "", text: "😤", action: "", expected: "angry"},
		{emotion: "", text: "气死我了，太可恶了", action: "", expected: "angry"},
		{emotion: "", text: "", action: "angry_pout", expected: "angry"},

		// 动作指令 (action) 优先：即使 emotion 处于中间流式 thinking 状态，action 明确指定 sad/happy 时必须正确触发
		{emotion: "thinking", text: "🤔", action: "sad", expected: "sad"},
		{emotion: "thinking", text: "🤔", action: "happy", expected: "happy"},
		{emotion: "thinking", text: "🤔", action: "angry", expected: "angry"},
		{emotion: "thinking", text: "🤔", action: "thinking", expected: "thinking"},
		{emotion: "", text: "哎呀，我的首席观众怎么落泪了？本水神的舞台可不允许悲伤的阴云笼罩呢。快说说，是谁惹你不开心了？", action: "sad", expected: "sad"},

		// 核心测试用例：含“不开心”的安慰/主持公道句式，无动作指示时严禁误判为开心 (happy)
		{emotion: "", text: "哼，谁惹我的首席观众不开心了？说出来，本水神替你主持公道，用戏剧的魔力治愈你。", action: "", expected: "idle"},
		{emotion: "neutral", text: "哼，谁惹我的首席观众不开心了？说出来，本水神替你主持公道，用戏剧的魔力治愈你。", action: "", expected: "idle"},
		{emotion: "proud", text: "哼，谁惹我的首席观众不开心了？说出来，本水神替你主持公道，用戏剧的魔力治愈你。", action: "", expected: "proud"},

		// 表达自身沮丧、难过与伤心
		{emotion: "", text: "我不开心", action: "", expected: "sad"},
		{emotion: "", text: "今天好不开心啊，呜呜", action: "", expected: "sad"},
		{emotion: "", text: "开心不起来", action: "", expected: "sad"},
		{emotion: "", text: "我一点都不高兴", action: "", expected: "sad"},

		// 安慰/否定悲伤词，不应判定为伤心 (sad)
		{emotion: "", text: "别难过，有我在呢", action: "", expected: "idle"},
		{emotion: "", text: "别哭啦，摸摸头", action: "", expected: "idle"},
		{emotion: "", text: "不要伤心，一切都会好起来的", action: "", expected: "idle"},

		// 否定愤怒词/安慰，不应判定为愤怒 (angry)
		{emotion: "", text: "别生气了，消消气", action: "", expected: "idle"},
		{emotion: "", text: "不要发火嘛", action: "", expected: "idle"},
		{emotion: "", text: "是谁惹我的观众生气了？", action: "", expected: "idle"},

		// 其余类型表情，保持各自原状态
		{emotion: "neutral", text: "", action: "", expected: "neutral"},
		{emotion: "thinking", text: "", action: "", expected: "thinking"},
		{emotion: "angry", text: "", action: "", expected: "angry"},
		{emotion: "embarrassed", text: "", action: "", expected: "embarrassed"},
		{emotion: "surprised", text: "", action: "", expected: "surprised"},
		{emotion: "shocked", text: "", action: "", expected: "shocked"},
		{emotion: "sleepy", text: "", action: "", expected: "sleepy"},
		{emotion: "confused", text: "", action: "", expected: "confused"},
		{emotion: "", text: "", action: "", expected: "idle"},
	}

	for _, tt := range tests {
		got := parseEmotion(tt.emotion, tt.text, tt.action)
		if got != tt.expected {
			t.Errorf("parseEmotion(%q, %q, %q) = %q, want %q", tt.emotion, tt.text, tt.action, got, tt.expected)
		}
	}
}

func TestIsSadTrigger(t *testing.T) {
	tests := []struct {
		toolName string
		args     map[string]any
		want     bool
	}{
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "crying"}, want: true},
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "sad"}, want: true},
		{toolName: "self.furina.trigger_animation", args: map[string]any{"animation": "crying_tears"}, want: true},
		{toolName: "self.furina.show_expression", args: map[string]any{"name": "流泪"}, want: true},
		{toolName: "self.furina.custom_action", args: map[string]any{"state": "😭"}, want: true},
		{toolName: "furina_crying_animation", args: nil, want: true},
		{toolName: "furina_sad_look", args: nil, want: true},
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "happy"}, want: false},
		{toolName: "self.get_device_status", args: nil, want: false},
	}

	for _, tt := range tests {
		got := isSadTrigger(tt.toolName, tt.args)
		if got != tt.want {
			t.Errorf("isSadTrigger(%q, %v) = %v, want %v", tt.toolName, tt.args, got, tt.want)
		}
	}
}

func TestIsAngryTrigger(t *testing.T) {
	tests := []struct {
		toolName string
		args     map[string]any
		want     bool
	}{
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "angry"}, want: true},
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "pout"}, want: true},
		{toolName: "self.furina.trigger_animation", args: map[string]any{"animation": "angry_pout"}, want: true},
		{toolName: "self.furina.show_expression", args: map[string]any{"name": "愤怒"}, want: true},
		{toolName: "self.furina.custom_action", args: map[string]any{"state": "😠"}, want: true},
		{toolName: "furina_angry_animation", args: nil, want: true},
		{toolName: "furina_pout_look", args: nil, want: true},
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "happy"}, want: false},
		{toolName: "self.furina.set_emotion", args: map[string]any{"emotion": "sad"}, want: false},
		{toolName: "self.get_device_status", args: nil, want: false},
	}

	for _, tt := range tests {
		got := isAngryTrigger(tt.toolName, tt.args)
		if got != tt.want {
			t.Errorf("isAngryTrigger(%q, %v) = %v, want %v", tt.toolName, tt.args, got, tt.want)
		}
	}
}

func TestLinxMCPSupport(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	mcpDone := make(chan struct{})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") == "websocket" {
			c, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				return
			}
			defer func() { _ = c.Close() }()

			// 1. Read hello
			_, _, _ = c.ReadMessage()
			_ = c.WriteJSON(map[string]any{
				"type":       "hello",
				"session_id": "mock_session_mcp",
			})
			// 2. Read listen start
			_, _, _ = c.ReadMessage()

			// 3. Send MCP initialize
			_ = c.WriteJSON(map[string]any{
				"type": "mcp",
				"payload": map[string]any{
					"jsonrpc": "2.0",
					"method":  "initialize",
					"id":      1,
				},
			})

			// Read response to initialize
			_, respInit, err := c.ReadMessage()
			if err != nil {
				t.Errorf("read init resp error: %v", err)
				return
			}
			var initResp struct {
				Type    string `json:"type"`
				Payload struct {
					Result map[string]any `json:"result"`
				} `json:"payload"`
			}
			_ = json.Unmarshal(respInit, &initResp)
			if initResp.Payload.Result == nil {
				t.Errorf("expected result in MCP init response")
			}

			// 4. Send MCP tools/list
			_ = c.WriteJSON(map[string]any{
				"type": "mcp",
				"payload": map[string]any{
					"jsonrpc": "2.0",
					"method":  "tools/list",
					"id":      2,
				},
			})
			_, respTools, err := c.ReadMessage()
			if err != nil {
				t.Errorf("read tools/list resp error: %v", err)
				return
			}
			var toolsResp struct {
				Payload struct {
					Result struct {
						Tools []map[string]any `json:"tools"`
					} `json:"result"`
				} `json:"payload"`
			}
			_ = json.Unmarshal(respTools, &toolsResp)
			if len(toolsResp.Payload.Result.Tools) == 0 {
				t.Errorf("expected tools list to have tools, got empty")
			}

			// 5. Send MCP tools/call to trigger happy animation
			_ = c.WriteJSON(map[string]any{
				"type": "mcp",
				"payload": map[string]any{
					"jsonrpc": "2.0",
					"method":  "tools/call",
					"id":      3,
					"params": map[string]any{
						"name": "self.furina.trigger_animation",
						"arguments": map[string]any{
							"animation": "happy",
						},
					},
				},
			})
			_, _, _ = c.ReadMessage()

			// 6. Send MCP tools/call to trigger sad animation
			_ = c.WriteJSON(map[string]any{
				"type": "mcp",
				"payload": map[string]any{
					"jsonrpc": "2.0",
					"method":  "tools/call",
					"id":      4,
					"params": map[string]any{
						"name": "self.furina.set_emotion",
						"arguments": map[string]any{
							"emotion": "crying",
						},
					},
				},
			})
			_, _, _ = c.ReadMessage()

			// Call 5: trigger angry animation
			_ = c.WriteJSON(map[string]any{
				"type": "mcp",
				"payload": map[string]any{
					"jsonrpc": "2.0",
					"method":  "tools/call",
					"id":      5,
					"params": map[string]any{
						"name": "self.furina.trigger_animation",
						"arguments": map[string]any{
							"animation": "angry",
						},
					},
				},
			})
			_, _, _ = c.ReadMessage()
			close(mcpDone)
			return
		}

		resp := map[string]any{
			"websocket": map[string]string{
				"url":   "ws://" + r.Host + "/ws",
				"token": "mock_token",
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	p := NewProvider(Config{OTAGateway: ts.URL})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	s, err := p.Open(ctx, "furina", "turn_mcp")
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer s.Close()

	var gotHappy, gotSad, gotAngry bool
	done := make(chan struct{})
	go func() {
		for ev := range s.Events() {
			if ev.Type == "emotion.changed" {
				if ev.Emotion == "happy" {
					gotHappy = true
				} else if ev.Emotion == "sad" {
					gotSad = true
				} else if ev.Emotion == "angry" {
					gotAngry = true
				}
				if gotHappy && gotSad && gotAngry {
					close(done)
					return
				}
			}
		}
	}()

	select {
	case <-mcpDone:
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for MCP server interaction")
	}

	select {
	case <-done:
		if !gotHappy || !gotSad || !gotAngry {
			t.Errorf("expected happy, sad, and angry events, got happy=%v, sad=%v, angry=%v", gotHappy, gotSad, gotAngry)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timeout waiting for emotion.changed events: happy=%v, sad=%v, angry=%v", gotHappy, gotSad, gotAngry)
	}
}
