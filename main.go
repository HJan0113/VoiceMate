package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	LinxAPIKey  = "lx-55eaa768b3acaeea23d4b85231287285c1780ef9d6c5f0d395f32600b7ccfa60"
	FurinaAgent = "3f656131c5334b278b3b3b557c29a869"
	DeviceMAC   = "02:00:00:00:00:F1"
	ClientID    = "550e8400-e29b-41d4-a716-4466554400f1"
	OTAGateway  = "https://xrobo.qiniuapi.com/v1/ota/"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域连接
	},
}

type OTAResponse struct {
	Websocket struct {
		URL   string `json:"url"`
		Token string `json:"token"`
	} `json:"websocket"`
}

// 获取灵矽实时 WebSocket 动态鉴权 Token
func getLinxToken() (string, string, error) {
	payload := map[string]interface{}{
		"version": 0,
		"uuid":    ClientID,
		"mac_address": DeviceMAC,
		"application": map[string]interface{}{
			"name":         "voicemate-web",
			"version":      "1.0.0",
			"compile_time": "2026-10-23 17:00:00",
			"idf_version":  "1.0.0",
			"elf_sha256":   "1234567890abcdef1234567890abcdef1234567890abcdef",
		},
		"board": map[string]interface{}{
			"type":    "voicemate-web",
			"ssid":    "local",
			"rssi":    0,
			"channel": 0,
			"ip":      "127.0.0.1",
			"mac":     DeviceMAC,
		},
	}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", OTAGateway, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Activation-Version", "1")
	req.Header.Set("Accept-Language", "zh-CN")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Device-Id", DeviceMAC)
	req.Header.Set("Client-Id", ClientID)
	req.Header.Set("User-Agent", "voicemate-web/1.0.0")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	var ota OTAResponse
	if err := json.Unmarshal(respData, &ota); err != nil {
		return "", "", err
	}

	if ota.Websocket.Token == "" {
		return "", "", fmt.Errorf("OTA did not return token: %s", string(respData))
	}

	return ota.Websocket.URL, ota.Websocket.Token, nil
}

// 芙宁娜本地互动彩蛋台词库（供离线/即时反馈使用）
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

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// 静态文件与页面路由
	r.Static("/static", "./static")
	r.StaticFile("/", "./static/index.html")

	// API 接口群
	api := r.Group("/api")
	{
		// 伴侣基本状态
		api.GET("/status", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"code": 0,
				"data": gin.H{
					"name":       "芙宁娜 (Furina)",
					"title":      "众水、众方、众民与众律法的女王",
					"agentId":    FurinaAgent,
					"voice":      "芙宁娜 (中文 · 原神原版音色)",
					"model":      "deepseek-v4-flash",
					"motion":     "furina_sharp_hd_2x.mp4",
					"mac":        DeviceMAC,
					"online":     true,
				},
			})
		})

		// 角色列表（预留切人通道）
		api.GET("/characters", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"code": 0,
				"data": []gin.H{
					{"id": "furina", "name": "芙宁娜", "title": "戏剧名伶 / 水神", "active": true, "avatar": "🌊"},
					{"id": "yoimiya", "name": "宵宫", "title": "长野原烟花店长", "active": false, "avatar": "🎆"},
					{"id": "clorinde", "name": "克洛琳德", "title": "决斗代理人", "active": false, "avatar": "⚡"},
				},
			})
		})

		// 点击部位交互彩蛋反馈
		api.POST("/interact", func(c *gin.Context) {
			var req struct {
				Part string `json:"part"` // "head" | "body"
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				req.Part = "head"
			}

			lines, ok := furinaInteractions[req.Part]
			if !ok {
				lines = furinaInteractions["idle"]
			}
			picked := lines[rand.Intn(len(lines))]

			c.JSON(http.StatusOK, gin.H{
				"code": 0,
				"data": gin.H{
					"part":    req.Part,
					"text":    picked,
					"emotion": "happy",
				},
			})
		})

		// 获取 WebSocket 连接凭证
		api.GET("/token", func(c *gin.Context) {
			wsURL, token, err := getLinxToken()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"code": 0,
				"data": gin.H{
					"url":   wsURL,
					"token": token,
					"mac":   DeviceMAC,
				},
			})
		})
	}

	// 浏览器全双工 WebSocket 桥接网关
	r.GET("/ws/companion", func(c *gin.Context) {
		clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS Bridge] Client Upgrade error: %v", err)
			return
		}
		defer clientConn.Close()

		// 向 OTA 动态获取连接凭证
		wsURL, token, err := getLinxToken()
		if err != nil {
			log.Printf("[WS Bridge] Get OTA token error: %v", err)
			clientConn.WriteJSON(gin.H{"type": "error", "message": "Failed to authenticate with Linx OTA"})
			return
		}

		// 建立与七牛云灵矽的 WebSocket 实时连接
		upstreamHeader := http.Header{}
		upstreamHeader.Set("Authorization", "Bearer "+token)
		upstreamHeader.Set("Device-Id", DeviceMAC)
		upstreamHeader.Set("Client-Id", ClientID)
		upstreamHeader.Set("Protocol-Version", "1")

		dialer := websocket.DefaultDialer
		upstreamConn, _, err := dialer.DialContext(context.Background(), wsURL, upstreamHeader)
		if err != nil {
			log.Printf("[WS Bridge] Dial Linx error: %v", err)
			clientConn.WriteJSON(gin.H{"type": "error", "message": "Failed to connect to Linx WebSocket"})
			return
		}
		defer upstreamConn.Close()

		// 发送初始 hello 报文 (指定 PCM 16kHz 以便浏览器原生零延迟播放)
		helloMsg := map[string]interface{}{
			"type":      "hello",
			"version":   1,
			"transport": "websocket",
			"features": map[string]interface{}{
				"mcp": true,
			},
			"audio_params": map[string]interface{}{
				"format":         "pcm",
				"sample_rate":    16000,
				"channels":       1,
				"bit_depth":      16,
				"frame_duration": 20,
			},
		}
		upstreamConn.WriteJSON(helloMsg)

		var once sync.Once
		closeBoth := func() {
			clientConn.Close()
			upstreamConn.Close()
		}

		// 协程 1: Upstream (灵矽) -> Browser (前端)
		go func() {
			defer once.Do(closeBoth)
			for {
				msgType, msg, err := upstreamConn.ReadMessage()
				if err != nil {
					break
				}
				if err := clientConn.WriteMessage(msgType, msg); err != nil {
					break
				}
			}
		}()

		// 协程 2: Browser (前端) -> Upstream (灵矽)
		defer once.Do(closeBoth)
		for {
			msgType, msg, err := clientConn.ReadMessage()
			if err != nil {
				break
			}
			if err := upstreamConn.WriteMessage(msgType, msg); err != nil {
				break
			}
		}
	})

	fmt.Println("==================================================")
	fmt.Println("🌊 VoiceMate 伴侣服务已启动: http://localhost:8080")
	fmt.Println("🎭 当前看板娘: 芙宁娜 (Furina)")
	fmt.Println("🎬 驱动视频: /static/assets/videos/furina_idle.mp4")
	fmt.Println("==================================================")

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server startup failed: %v", err)
	}
}
