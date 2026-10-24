package domain

import "time"

type Character struct {
	ID              string                    `json:"id"`
	Slug            string                    `json:"slug"`
	DisplayName     string                    `json:"displayName"`
	Status          string                    `json:"status"`
	VoiceProfile    string                    `json:"voiceProfile"`
	EmotionProfiles map[string]EmotionProfile `json:"emotionProfiles"`
}

type EmotionProfile struct {
	Video        string  `json:"video"`
	PlaybackRate float32 `json:"playbackRate"`
}

type Conversation struct {
	ID          string    `json:"id"`
	CharacterID string    `json:"characterId"`
	Title       string    `json:"title"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Session struct {
	ID             string    `json:"sessionId"`
	ConversationID string    `json:"conversationId"`
	CharacterID    string    `json:"characterId"`
	EphemeralToken string    `json:"-"`
	ExpiresAt      time.Time `json:"expiresAt"`
}
