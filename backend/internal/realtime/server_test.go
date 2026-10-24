package realtime

import (
	"encoding/binary"
	"testing"
)

func TestParseUplinkAudioFrame(t *testing.T) {
	frame := make([]byte, 18)
	frame[0] = 1
	frame[1] = 1
	binary.BigEndian.PutUint32(frame[12:16], 2)
	frame[16] = 0x01
	frame[17] = 0x02

	payload, ok := parseUplinkAudioFrame(frame)
	if !ok || len(payload) != 2 {
		t.Fatalf("expected valid two-byte payload, got ok=%t length=%d", ok, len(payload))
	}

	frame[1] = 2
	if _, ok := parseUplinkAudioFrame(frame); ok {
		t.Fatal("expected downlink frame to be rejected as uplink")
	}
}

func TestParseUplinkAudioFrameRejectsLengthMismatch(t *testing.T) {
	frame := make([]byte, 17)
	frame[0] = 1
	frame[1] = 1
	binary.BigEndian.PutUint32(frame[12:16], 2)

	if _, ok := parseUplinkAudioFrame(frame); ok {
		t.Fatal("expected payload length mismatch to be rejected")
	}
}
