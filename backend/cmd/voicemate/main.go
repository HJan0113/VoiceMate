package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/HJan0113/VoiceMate/internal/application"
	"github.com/HJan0113/VoiceMate/internal/http/handler"
	"github.com/HJan0113/VoiceMate/internal/http/middleware"
	"github.com/HJan0113/VoiceMate/internal/provider"
	"github.com/HJan0113/VoiceMate/internal/provider/fake"
	"github.com/HJan0113/VoiceMate/internal/provider/linx"
	"github.com/HJan0113/VoiceMate/internal/realtime"
)

func loadEnvFile(path string) {
	data, err := os.ReadFile(path) //nolint:gosec // configuration path is a trusted local filename
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			if os.Getenv(k) == "" {
				_ = os.Setenv(k, v)
			}
		}
	}
}

func main() {
	loadEnvFile(".env")
	loadEnvFile("../.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}

	providerType := os.Getenv("VOICEMATE_PROVIDER")
	var p provider.Provider
	providerName := "fake"

	if providerType == "linx" || (providerType == "" && os.Getenv("LINX_API_KEY") != "") {
		providerName = "linx"
		p = linx.NewProvider(linx.Config{
			LinxAPIKey:  os.Getenv("LINX_API_KEY"),
			FurinaAgent: os.Getenv("FURINA_AGENT_ID"),
			DeviceMAC:   os.Getenv("DEVICE_MAC"),
			ClientID:    os.Getenv("CLIENT_ID"),
			OTAGateway:  os.Getenv("OTA_GATEWAY_URL"),
		})
	} else {
		p = fake.NewProvider()
	}

	app := application.NewService()
	api := handler.New(app)
	rt := realtime.NewServer(app, p, origin)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), middleware.CORS(origin))

	// 静态资源服务（如果存在静态角色视频目录）
	if _, err := os.Stat("assets"); err == nil {
		router.Static("/assets", "assets")
	} else if _, err := os.Stat("../frontend/public/assets"); err == nil {
		router.Static("/assets", "../frontend/public/assets")
	}

	router.GET("/health/live", api.Live)
	router.GET("/health/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready", "provider": providerName})
	})
	router.StaticFile("/openapi.yaml", "openapi.yaml")
	v1 := router.Group("/api/v1")
	v1.POST("/auth/anonymous", api.Anonymous)
	v1.GET("/characters", api.Characters)
	v1.POST("/characters/:id/interact", api.Interact)
	v1.POST("/realtime/sessions", api.CreateSession)
	v1.GET("/conversations", api.Conversations)
	v1.GET("/realtime/connect", rt.Handle)

	log.Printf("VoiceMate API listening on :%s (provider=%s)", port, providerName) //nolint:gosec // port comes from server configuration environment variable
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
