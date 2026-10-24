package application

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/HJan0113/VoiceMate/internal/domain"
)

var ErrSessionNotFound = errors.New("session not found")

type Service struct {
	mu            sync.RWMutex
	characters    []domain.Character
	sessions      map[string]domain.Session
	conversations map[string]domain.Conversation
}

func NewService() *Service {
	return &Service{
		characters: []domain.Character{{
			ID: "furina", Slug: "furina", DisplayName: "芙宁娜", Status: "active", VoiceProfile: "furina-qiniu-linx",
			EmotionProfiles: map[string]domain.EmotionProfile{
				"idle":     {Video: "/assets/characters/furina/furina_idle.mp4", PlaybackRate: 1.0},
				"happy":    {Video: "/assets/characters/furina/furina_happy.mp4", PlaybackRate: 1.0},
				"sad":      {Video: "/assets/characters/furina/furina_sad.mp4", PlaybackRate: 1.0},
				"crying":   {Video: "/assets/characters/furina/furina_sad.mp4", PlaybackRate: 1.0},
				"angry":    {Video: "/assets/characters/furina/furina_angry.mp4", PlaybackRate: 1.0},
				"speaking": {Video: "/assets/characters/furina/furina_idle.mp4", PlaybackRate: 1.08},
				"proud":    {Video: "/assets/characters/furina/furina_idle.mp4", PlaybackRate: 1.08},
				"thinking": {Video: "/assets/characters/furina/furina_idle.mp4", PlaybackRate: 1.0},
			},
		}}, sessions: map[string]domain.Session{}, conversations: map[string]domain.Conversation{},
	}
}

func (s *Service) ListCharacters() []domain.Character {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]domain.Character, len(s.characters))
	copy(result, s.characters)
	return result
}

func (s *Service) CreateSession(characterID, conversationID string) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if characterID == "" {
		characterID = "furina"
	}
	found := false
	for _, character := range s.characters {
		if character.ID == characterID && character.Status == "active" {
			found = true
		}
	}
	if !found {
		return domain.Session{}, errors.New("character not found")
	}
	if conversationID == "" {
		conversationID = "conv_" + randomID()
	}
	if _, ok := s.conversations[conversationID]; !ok {
		s.conversations[conversationID] = domain.Conversation{ID: conversationID, CharacterID: characterID, Title: "新的对话", CreatedAt: time.Now().UTC()}
	}
	now := time.Now().UTC()
	for id, existing := range s.sessions {
		if now.After(existing.ExpiresAt) {
			delete(s.sessions, id)
		}
	}
	session := domain.Session{ID: "sess_" + randomID(), ConversationID: conversationID, CharacterID: characterID, EphemeralToken: "et_" + randomID(), ExpiresAt: now.Add(5 * time.Minute)}
	s.sessions[session.ID] = session
	return session, nil
}

func (s *Service) VerifySession(id, token string) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return domain.Session{}, ErrSessionNotFound
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		delete(s.sessions, id)
		return domain.Session{}, ErrSessionNotFound
	}
	if session.EphemeralToken != token {
		return domain.Session{}, ErrSessionNotFound
	}
	return session, nil
}

func (s *Service) Conversations() []domain.Conversation {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]domain.Conversation, 0, len(s.conversations))
	for _, item := range s.conversations {
		result = append(result, item)
	}
	return result
}

func randomID() string { var b [8]byte; _, _ = rand.Read(b[:]); return hex.EncodeToString(b[:]) }
