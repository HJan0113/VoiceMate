package fake

import (
	"context"
	"testing"
	"time"
)

func TestSendTextTriggersOneResponse(t *testing.T) {
	stream, err := NewProvider().Open(context.Background(), "furina", "turn-text")
	if err != nil {
		t.Fatalf("open fake stream: %v", err)
	}

	if err := stream.SendText("你好"); err != nil {
		t.Fatalf("send text: %v", err)
	}
	stream.Stop()

	responseCount := 0
	done := make(chan struct{})
	go func() {
		defer close(done)
		for event := range stream.Events() {
			if event.Type == "response.delta" {
				responseCount++
			}
		}
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for fake response")
	}

	if responseCount != 1 {
		t.Fatalf("expected one response, got %d", responseCount)
	}
}
