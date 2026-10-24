package linx

import (
	"context"
	"testing"
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
