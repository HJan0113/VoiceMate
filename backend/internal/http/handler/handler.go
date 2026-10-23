package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kurodakayn/voicemate/internal/application"
)

type Handler struct{ app *application.Service }

func New(app *application.Service) *Handler { return &Handler{app: app} }

func (h *Handler) Live(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) }
func (h *Handler) Ready(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ready", "provider": "fake"})
}

func (h *Handler) Anonymous(c *gin.Context) {
	//nolint:gosec // placeholder development tokens for scaffolded anonymous auth endpoint
	c.JSON(http.StatusOK, gin.H{"accessToken": "dev-access-token", "refreshToken": "dev-refresh-token", "deviceId": "dev-device"})
}

func (h *Handler) Characters(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": h.app.ListCharacters()})
}

type createSessionRequest struct {
	CharacterID    string `json:"characterId"`
	ConversationID string `json:"conversationId"`
}

func (h *Handler) CreateSession(c *gin.Context) {
	var request createSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "INVALID_BODY", "message": err.Error()}})
		return
	}
	session, err := h.app.CreateSession(request.CharacterID, request.ConversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "CHARACTER_NOT_FOUND", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"sessionId": session.ID, "conversationId": session.ConversationID, "wsUrl": "/api/v1/realtime/connect?sessionId=" + session.ID, "ephemeralToken": session.EphemeralToken, "expiresAt": session.ExpiresAt, "audio": gin.H{"input": gin.H{"codec": "pcm_s16le", "sampleRate": 16000, "channels": 1}, "output": gin.H{"codec": "pcm_s16le", "sampleRate": 24000, "channels": 1}}})
}

func (h *Handler) Conversations(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": h.app.Conversations()})
}
