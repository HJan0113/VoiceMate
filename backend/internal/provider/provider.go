package provider

import "context"

type Event struct {
	Type       string
	TurnID     string
	StreamID   uint32
	Text       string
	Emotion    string
	Intensity  float32
	Codec      string
	SampleRate int
	Sequence   uint32
	Audio      []byte
}

type Stream interface {
	SendAudio([]byte) error
	Stop()
	Interrupt()
	Events() <-chan Event
	Close()
}

type Provider interface {
	Open(context.Context, string, string) (Stream, error)
}
