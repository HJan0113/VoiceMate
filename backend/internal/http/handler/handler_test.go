package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kurodakayn/voicemate/internal/application"
)

func TestCreateSessionRejectsInvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/sessions", New(application.NewService()).CreateSession)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/sessions", strings.NewReader("{"))
	request.Header.Set("Content-Type", "application/json")

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "INVALID_BODY") {
		t.Fatalf("expected stable error code, got %s", recorder.Body.String())
	}
}

func TestCreateSessionAcceptsEmptyBodyForCompatibility(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/sessions", New(application.NewService()).CreateSession)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/sessions", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", recorder.Code)
	}
}
