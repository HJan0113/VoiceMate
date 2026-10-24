package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/HJan0113/VoiceMate/internal/application"
	"github.com/HJan0113/VoiceMate/internal/http/handler"
	"github.com/HJan0113/VoiceMate/internal/http/middleware"
	"github.com/HJan0113/VoiceMate/internal/provider/fake"
	"github.com/HJan0113/VoiceMate/internal/realtime"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	app := application.NewService()
	api := handler.New(app)
	rt := realtime.NewServer(app, fake.NewProvider(), origin)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), middleware.CORS(origin))
	router.GET("/health/live", api.Live)
	router.GET("/health/ready", api.Ready)
	router.StaticFile("/openapi.yaml", "openapi.yaml")
	v1 := router.Group("/api/v1")
	v1.POST("/auth/anonymous", api.Anonymous)
	v1.GET("/characters", api.Characters)
	v1.POST("/realtime/sessions", api.CreateSession)
	v1.GET("/conversations", api.Conversations)
	v1.GET("/realtime/connect", rt.Handle)
	log.Printf("VoiceMate API listening on :%s (provider=fake)", port) //nolint:gosec // port comes from server configuration environment variable
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
