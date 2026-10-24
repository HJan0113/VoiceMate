package handler

import (
	"crypto/rand"
	"errors"
	"io"
	"math/big"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/HJan0113/VoiceMate/internal/application"
)

type Handler struct{ app *application.Service }

func New(app *application.Service) *Handler { return &Handler{app: app} }

// writeError 统一返回基础 API 错误结构，避免把内部错误细节暴露给客户端。
func writeError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}

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

var furinaInteractions = map[string][]string{
	"head": {
		"「哼哼，怎么了？是折服于本水神的魅力，忍不住想要摸摸我的礼帽了吗？」",
		"「哎呀！别突然碰人家的头发啦！等下发型乱了怎么登台亮相嘛……」",
		"「好吧，看在你平时表现还算忠诚的份上，特许你多摸一下下哦！」",
	},
	"body": {
		"「喂喂！注意你的举止，凡人！这可是枫丹最顶级的正装，弄皱了你可赔不起！」",
		"「哇啊！突、突然戳过来干什么！吓我一跳……真是个冒失的家伙！」",
		"「既然你这么有精神，不如现在就去帮本水神买几块枫丹泡芙和小蛋糕来？」",
	},
	"idle": {
		"「下午茶的时间快到了吧？今天的红茶配马卡龙，本水神可是期待已久了呢。」",
		"「欧庇克莱大剧院的帷幕永不落空，而你，就是本名伶最忠实的特约观众~」",
	},
}

func (h *Handler) Interact(c *gin.Context) {
	var req struct {
		Part string `json:"part"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Part = "head"
	}
	lines, ok := furinaInteractions[req.Part]
	if !ok {
		lines = furinaInteractions["idle"]
	}
	idx := 0
	if n := int64(len(lines)); n > 0 {
		if bigN, err := rand.Int(rand.Reader, big.NewInt(n)); err == nil {
			idx = int(bigN.Int64())
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"part":    req.Part,
			"text":    lines[idx],
			"emotion": "happy",
		},
	})
}

type createSessionRequest struct {
	CharacterID    string `json:"characterId"`
	ConversationID string `json:"conversationId"`
}

func (h *Handler) CreateSession(c *gin.Context) {
	var request createSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil && !errors.Is(err, io.EOF) {
		writeError(c, http.StatusBadRequest, "INVALID_BODY", "request body must be valid JSON")
		return
	}
	session, err := h.app.CreateSession(request.CharacterID, request.ConversationID)
	if err != nil {
		writeError(c, http.StatusNotFound, "CHARACTER_NOT_FOUND", "requested resource is unavailable")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"sessionId": session.ID, "conversationId": session.ConversationID, "wsUrl": "/api/v1/realtime/connect?sessionId=" + session.ID, "ephemeralToken": session.EphemeralToken, "expiresAt": session.ExpiresAt, "audio": gin.H{"input": gin.H{"codec": "pcm_s16le", "sampleRate": 16000, "channels": 1}, "output": gin.H{"codec": "pcm_s16le", "sampleRate": 16000, "channels": 1}}})
}

func (h *Handler) Conversations(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": h.app.Conversations()})
}
