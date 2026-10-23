package fake

import (
	"context"
	"encoding/binary"
	"math"
	"sync"

	"github.com/kurodakayn/voicemate/internal/provider"
)

type Provider struct{}

func NewProvider() *Provider { return &Provider{} }

func (*Provider) Open(_ context.Context, _ string, turnID string) (provider.Stream, error) {
	return newStream(turnID), nil
}

type stream struct {
	turnID  string
	events  chan provider.Event
	cancel  chan struct{}
	trigger chan struct{}
	stop    sync.Once
	close   sync.Once
}

func newStream(turnID string) *stream {
	s := &stream{
		turnID:  turnID,
		events:  make(chan provider.Event, 16),
		cancel:  make(chan struct{}),
		trigger: make(chan struct{}),
	}
	go s.run()
	return s
}

func (s *stream) SendAudio(_ []byte) error      { return nil }
func (s *stream) Events() <-chan provider.Event { return s.events }
func (s *stream) Interrupt()                    { s.close.Do(func() { close(s.cancel) }) }
func (s *stream) Close()                        { s.Interrupt() }

func (s *stream) Stop() {
	s.stop.Do(func() { close(s.trigger) })
}

func (s *stream) run() {
	defer close(s.events)
	select {
	case <-s.cancel:
		return
	case <-s.trigger:
		s.respond()
	}
}

func (s *stream) respond() {
	select {
	case <-s.cancel:
		return
	default:
		s.emit(provider.Event{Type: "transcript.final", TurnID: s.turnID, Text: "（演示）你好，今天想和我聊点什么？"})
		s.emit(provider.Event{Type: "response.delta", TurnID: s.turnID, Text: "（演示）你好，今天想和我聊点什么？"})
		s.emit(provider.Event{Type: "emotion.changed", TurnID: s.turnID, Emotion: "proud", Intensity: 0.72})
		s.emit(provider.Event{Type: "audio.meta", TurnID: s.turnID, StreamID: 1, Codec: "pcm_s16le", SampleRate: 24000})
		for seq := range uint32(12) {
			s.emit(provider.Event{Type: "audio.chunk", TurnID: s.turnID, StreamID: 1, Sequence: seq, Audio: tone(seq)})
		}
		s.emit(provider.Event{Type: "audio.end", TurnID: s.turnID, StreamID: 1})
		s.emit(provider.Event{Type: "turn.completed", TurnID: s.turnID})
	}
}

func (s *stream) emit(event provider.Event) {
	select {
	case s.events <- event:
	case <-s.cancel:
	}
}

func tone(chunk uint32) []byte {
	const samples = 480
	data := make([]byte, samples*2)
	for i := range uint32(samples) {
		value := int16(math.Sin(float64(chunk*samples+i)*2*math.Pi*440/24000) * 5000)
		binary.LittleEndian.PutUint16(data[i*2:], uint16(value)) //nolint:gosec // intentional int16 to uint16 bit pattern conversion for PCM s16le
	}
	return data
}
