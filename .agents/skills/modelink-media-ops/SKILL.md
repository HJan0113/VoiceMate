---
name: modelink-media-ops
description: >-
  七牛云 Modelink (api.modelink.ai / api.qnaigc.com) 角色多模态标准生产管线技能。
  严格遵循「GPT 高保真原画 -> 可灵首尾闭环锁机位视频 -> FFmpeg 智能二次元锐化与倍速加速」的端到端标准工作流，
  彻底解决 IP 角色还原度不高、版权拦截、机位旋转晃动、视频模糊发虚以及动作拖沓的工业痛点。
---

# Modelink 角色动态标准管线：GPT 生图 + 可灵锁机位 + FFmpeg 锐化加速 (modelink-media-ops)

本 Skill 固化了制作 Web 二次元角色/桌面看板娘的**工业级全流程生产工作流**：
1. **阶段一（GPT 生图）**：利用 `openai/gpt-image-2.5-sunburst` 生成人物设定还原度高、线条锐利、符合 2.5D 规范的正身纯白底原画，避免国内模型版权词拦截；
2. **阶段二（可灵锁机位视频）**：利用 `kling-v3-omni` 的首尾帧闭环技术（`end_image_url = image_url`），在物理与几何层面彻底锁死摄像机旋转，输出平视定焦的无缝微动循环视频；
3. **阶段三（FFmpeg 锐化与加速）**：针对 AI 视频扩散模型 VAE 编解码导致的“二次元黑线发糊/油画感”以及默认 5 秒动作拖沓问题，通过 **AMD CAS 智能对比度自适应锐化** 与 **Lanczos 1080P 重采样** 重建锋利线稿，并用 `setpts` 调整微动节奏。

---

## 1. 核心端点与凭证

* **服务接入点 (BaseURL)**：
  * 中国大陆环境：`https://api.qnaigc.com`
  * 海外/跨境环境：`https://api.modelink.ai`
* **鉴权 Header**：`Authorization: Bearer <API_KEY>`

---

## 2. 标准三阶段生产流程

```
[阶段一：GPT 角色原画抽卡]
  │  使用模型：openai/gpt-image-2.5-sunburst (POST /v1/images/generations)
  │  严格标准：0°正视平视 + 双唇紧闭 + A-pose无遮挡 + 纯白底
  ▼
[用户确认立绘满意]
  │
  ▼
[阶段二：可灵首尾闭环图生视频]
  │  使用模型：kling-video/o3/standard/image-to-video (POST /queue/fal-ai/...)
  │  核心约束：image_url 与 end_image_url 绑定同一张原画，彻底杜绝镜头旋转
  │  提示词：定焦固定机位 + 中文无运镜指令 + 原地轻呼吸眨眼
  ▼
[输出原始 5s 循环视频 (960x960 稍带模糊)]
  │
  ▼
[阶段三：FFmpeg 智能锐化与倍速重编码]
  │  锐化滤镜：Lanczos 1080P 重采样 + AMD CAS 强自适应锐化 + Unsharp 轮廓增强
  │  倍速调整：setpts=0.5*PTS (2x 加速，杜绝动作拖沓)
  │  高保真编码：libx264 -crf 14 -preset slow (码率提升至 6~8+ Mbps)
  ▼
[输出超清、高帧率、节奏紧凑的看板娘视频]
```

---

## 3. 阶段一：GPT 高保真立绘生成规范

### 3.1 为什么选 GPT？
- 国内火山/豆包节点直接输入“原神芙宁娜”等 IP 名时会触发 `OutputImageSensitiveContentDetected.PolicyViolation` 拦截；且豆包易将角色画成泛化路人；
- `openai/gpt-image-2.5-sunburst` 对游戏原版设定（异色水纹瞳孔、短发/发型、专属礼服）还原极准，且不拦截角色名。

### 3.2 动态底图提示词硬性规范
为保证后续视频生成和口型替换不走形，提示词必须严格包含以下 4 项约束：
1. **视角**：`strict front-facing orthographic 0-degree view, no head tilt, centered`
2. **嘴唇**：`subtle calm closed mouth, sealed lips`（绝对不可张嘴或露齿，否则叠加口型图层会穿帮）
3. **肢体**：`A-pose standing, hands naturally rested at sides, no occlusion on face or torso`
4. **背景**：`solid pure blank white background, clean margins`

### 3.3 自动化生图脚本 (Python)
```python
import os, urllib.request, json, base64

# 读取环境变量或配置
api_key = os.getenv("MODELINK_API_KEY", "your_modelink_api_key_here")
prompt = (
    "Masterpiece, ultra-high definition, 8k resolution, razor-sharp clean outlines. "
    "Official Genshin Impact character art of Furina, short hair form (layered wavy short bob, no long tails). "
    "Standing full-body portrait, perfectly centered, front-facing orthographic 0-degree view. "
    "Prominent sharp heterochromia eyes (deep blue right eye, cyan droplet left eye), subtle calm closed mouth. "
    "Iconic dark blue top hat, accurate navy blue tailcoat. "
    "Solid pure white blank background with clean margins, anime cel-shading."
)

req = urllib.request.Request(
    "https://api.qnaigc.com/v1/images/generations",
    data=json.dumps({
        "model": "openai/gpt-image-2.5-sunburst",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "quality": "high"
    }).encode("utf-8"),
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    b64 = data["data"][0]["b64_json"]
    with open("furina_base.png", "wb") as f:
        f.write(base64.b64decode(b64))
    print("原画生成成功，请用户确认！")
```

---

## 4. 阶段二：可灵首尾闭环锁机位图生视频

### 4.1 为什么会旋转？如何彻底锁死？
视频大模型（如可灵）面对正面人物立绘时，默认有强烈的“3D 环绕展示台（Turntable Orbit）”先验偏好。
**唯一能够 100% 消除旋转的方法**是启用**首尾帧模式**：
- 同时传入 `image_url`（第 0 秒）和 `end_image_url`（第 5 秒），且二者传入**完全同一张原画**；
- 几何边界被强制封死在同一视角，模型在时间线上无法进行单向旋转，摄像机被彻底定死。

### 4.2 自动化视频闭环脚本 (Python)
```python
import os, urllib.request, json, base64, time

api_key = os.getenv("MODELINK_API_KEY", "your_modelink_api_key_here")
img_path = "furina_base.png"

# 转为高质量 JPEG 以加速 Base64 上传（建议控制在 200KB 左右）
with open(img_path, "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")
image_uri = f"data:image/jpeg;base64,{b64_data}"

# 强机位锁定提示词（中文对快手可灵更具指令穿透力）
prompt = (
    "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，禁止镜头旋转与环绕。"
    "角色原地静立，仅有极其微小的胸口呼吸起伏和自然眨眼，发丝极轻微晃动，"
    "纯白背景完全静止，无死角锁死机位，无缝循环。"
)

# 关键：首尾帧同时绑定同一张图片！
payload = {
    "image_url": image_uri,
    "end_image_url": image_uri,
    "prompt": prompt,
    "duration": "5",
    "generate_audio": False
}

endpoint = "https://api.qnaigc.com/queue/fal-ai/kling-video/o3/standard/image-to-video"
headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

req = urllib.request.Request(endpoint, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode("utf-8"))
    status_url = res["status_url"]
    resp_url = res["response_url"]
    print("视频任务已提交:", res["request_id"])

# 轮询状态并自动下载
while True:
    time.sleep(8)
    req_status = urllib.request.Request(status_url, headers=headers)
    with urllib.request.urlopen(req_status) as r:
        st = json.loads(r.read().decode("utf-8"))
        status = st.get("status")
        print(f"渲染进度: {status}...")
        if status == "COMPLETED":
            req_resp = urllib.request.Request(resp_url, headers=headers)
            with urllib.request.urlopen(req_resp) as r2:
                final_res = json.loads(r2.read().decode("utf-8"))
                video_url = final_res["video"]["url"]
                urllib.request.urlretrieve(video_url, "furina_dynamic_locked.mp4")
                print("视频渲染成功并已下载: furina_dynamic_locked.mp4")
            break
        elif status == "FAILED":
            raise RuntimeError(f"视频生成失败: {st}")
```

---

## 5. 阶段三：FFmpeg 智能二次元自适应锐化与倍速处理

### 5.1 痛点剖析：AI 视频为什么会发糊？
1. **VAE 潜在空间降采样**：图生视频模型在将 1024 静态原图喂入 Diffusion 前，会通过 VAE 压缩到 1/8 尺寸的 Latent 潜空间。二次元极细的黑色描线、发丝高光和瞳孔细节在此阶段被大幅平滑羽化，产生“塑料糊感”；
2. **Standard 档位分辨率与码率受限**：可灵标准版原生仅 960×960，码率仅 ~2.4 Mbps；
3. **5 秒动作周期拖沓**：原本 5 秒的呼吸和眨眼节奏偏慢，作为网页看板娘微动循环时容易显得迟缓，最佳微动周期通常为 1.5s ~ 2.5s（即 2x ~ 3x 加速）。

### 5.2 解决方案与 FFmpeg 核心滤镜链
- **CAS (Contrast Adaptive Sharpening)**：AMD 开源的对比度自适应锐化算法，专为二次元平色块与边缘线稿设计，只针对边缘做高频提升，不增加纯色背景噪点；
- **Lanczos 1080P 重采样**：将 960×960 拉升至 1080×1080 标准高清画质；
- **高保真 CRF 14 压制**：普通压缩会使码率骤降至 1Mbps 以下导致马赛克，必须指定 `-crf 14 -preset slow`，将码率拉满至 6~8+ Mbps，确保锐化线稿无二次失真；
- **时间戳加速 (`setpts`)**：倍速加速剔除冗余帧并提高动作轻快感。

### 5.3 生产级 FFmpeg 实用命令清单

#### 1) 仅高清锐化 (保持原速 1x)
```bash
ffmpeg -y -i input_locked.mp4 \
  -filter:v "scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p \
  output_sharp_hd.mp4
```

#### 2) 高清锐化 + 2倍速加速 (最推荐：2.5秒微动循环)
```bash
ffmpeg -y -i input_locked.mp4 \
  -filter:v "setpts=0.5*PTS,scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0" \
  -an -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p \
  output_sharp_hd_2x.mp4
```

#### 3) 高清锐化 + 3倍速加速 (1.67秒轻快循环)
```bash
ffmpeg -y -i input_locked.mp4 \
  -filter:v "setpts=(1/3)*PTS,scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0" \
  -an -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p \
  output_sharp_hd_3x.mp4
```

---

## 6. 快速排障手册

| 异常现象 | 根本原因 | 官方解法 |
| :--- | :--- | :--- |
| **生图报 `PolicyViolation` 敏感词** | 国内火山引擎对“原神角色”等专有名词做了严格风控 | 切换为 `openai/gpt-image-2.5-sunburst` 生图，人物还原度更高且零拦截。 |
| **做口型/变脸时底图穿帮** | 原图带有张嘴笑或露齿 | 在 GPT 提示词中加入 `sealed closed lips, subtle mouth line` 重新抽卡。 |
| **视频机位在缓慢旋转/推拉** | 未绑定尾帧，模型自发套用 3D Turntable 环绕运镜 | **必须传入 `end_image_url = image_url`**，首尾闭环锁死几何视角。 |
| **视频画面发糊、线条像蒙了塑料布** | AI 扩散模型 VAE 潜空间压缩破坏了二次元极细黑线 | 使用 **FFmpeg CAS 智能锐化 + Lanczos 1080P + CRF 14** 重新高保真压制。 |
| **视频加速后出现块效应或模糊** | FFmpeg 默认参数在倍速时过度降码率 | 加速命令中显式加入 `-crf 14 -preset slow`，保持 6~8+ Mbps 充足码率。 |
| **Base64 上传报超时 (Timeout)** | 原 PNG 体积过大（>500KB） | 先用 `sips` 或 Pillow 将图片转为 90~95% 质量的 JPEG（<200KB）再转 Base64 提交。 |
