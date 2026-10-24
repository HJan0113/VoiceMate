---
name: modelink-character-idle
description: >-
  角色基准常驻静立微动生产管线技能。
  适用于制作 Web 二次元角色与桌面虚拟伴侣的「默认常驻待机状态 (Idle State)」，
  包含高保真立绘预处理、可灵首尾闭环锁机位图生视频、2x 倍速紧凑化与 AMD CAS 自适应锐化压制标准工业流程，
  输出无缝平视定焦的自然呼吸眨眼循环视频。
---

# 角色基准常驻静立微动管线：立绘预处理 + 锁机位图生视频 + 2x 锐化加速 (modelink-character-idle)

本 Skill 专门固化了制作 Web 二次元角色与桌面虚拟伴侣**常驻静立待机状态 (Idle State)** 的工业级全流程生产规范：
* **核心目标**：生成动作节奏自然、机位完全静止、呼吸眨眼舒展、无限无缝循环的角色待机微动视频（如 `character_idle.mp4`）；
* **核心方案**：利用图生视频首尾帧同图绑定闭环，结合 FFmpeg AMD CAS 锐化与 2x 紧凑倍速重编码。

---

## 1. 核心端点与凭证规范

* **服务接入点 (BaseURL)**：
  * 中国大陆环境：`https://api.qnaigc.com`
  * 海外/跨境环境：`https://api.modelink.ai`
* **鉴权 Header**：`Authorization: Bearer <YOUR_API_KEY>`
* **推荐选用模型**：`kling-video/o3/standard/image-to-video`（站姿最稳，下半身先验扎实，生成速度快）

---

## 2. 生产流程架构

```
[阶段一：高保真原画底图 & JPEG 预压缩]
  │ 规范：纯白底 + 0°正视平视 + 双唇紧闭微抿 + A-pose
  │ 预处理：Pillow 压缩为 90% 质量 JPEG (<150KB)，杜绝 Base64 上传超时与 TLS 握手错误
  ▼
[阶段二：可灵 o3 首尾闭环锁机位图生视频]
  │ 端点：POST /queue/fal-ai/kling-video/o3/standard/image-to-video
  │ 核心约束：image_url 与 end_image_url 绑定完全同一张底图
  │ 提示词：绝对固定机位 + 纯白背景完全静止 + 原地轻呼吸与自然眨眼 + 发丝轻晃
  ▼
[输出原始 5s 循环视频素材 (960x960)]
  │
  ▼
[阶段三：FFmpeg 2x 倍速加速与 AMD CAS 自适应锐化]
  │ 倍速调整：setpts=0.5*PTS (将原本拖沓的 5s 呼吸眨眼加速为 2.5s 轻快微动循环)
  │ 智能锐化：Lanczos 1080P 重采样 + AMD CAS (strength=0.85) + Unsharp 轮廓增强
  │ 高保真压制：libx264 -crf 14 -preset slow (输出 1080x1080, 码率 6~8+ Mbps)
  ▼
[输出超清、高帧率、节奏紧凑的角色常驻待机视频]
```

---

## 3. 阶段一：立绘底图与预处理规范

### 3.1 提示词硬性规范
1. **视角与构图**：`strict front-facing orthographic 0-degree view, no head tilt, perfectly centered`
2. **神态与嘴唇**：`subtle calm closed mouth, sealed lips`（严禁张嘴或露齿，保持自然从容中性神态）
3. **身躯与四肢**：`A-pose standing, hands naturally rested at sides, feet firmly on ground`
4. **背景**：`solid pure blank white background, clean margins`

### 3.2 图片上传预压缩规范
AI 视频网关在接收超过 500KB 的 Base64 请求体时容易出现 `ReadTimeout` 或 SSL 错误。提交前**必须**使用 Pillow 转为 90% 质量 JPEG（体积压至 100~150KB）：

```python
import io, base64
from PIL import Image

def get_image_base64_uri(image_path: str) -> str:
    im = Image.open(image_path).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"
```

---

## 4. 阶段二：首尾闭环锁机位规范

### 4.1 锁机位物理原理
视频大模型面对单张立绘时，默认具备强烈的“3D 环绕展示台（Turntable Orbit）”旋转先验。
**唯一能够 100% 杜绝镜头旋转的方法**是首尾闭环：
- `image_url`（第 0 秒）与 `end_image_url`（第 5 秒）绑定**完全同一张立绘图片**；
- 模型在时间线上无法单向旋转，摄像机与几何视角在物理层面被彻底定死。

### 4.2 常驻待机标准提示词模板
```python
IDLE_PROMPT = (
    "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，禁止镜头旋转与环绕。"
    "角色原地静立，仅有极其微小的胸口呼吸起伏和自然眨眼，发丝极轻微晃动，"
    "纯白背景完全静止，无死角锁死机位，无缝循环。"
)
```

---

## 5. 阶段三：FFmpeg 2x 锐化加速与重编码

### 5.1 为什么常驻待机需要 2x 倍速？
原生 5 秒的呼吸和眨眼动作节奏偏慢，若作为网页或桌面常驻伴侣时会显得迟缓呆滞。
经过工业验证，**2.5 秒（即 2x 加速）** 是最舒适自然的角色待机微动周期：
* 胸口与衣物起伏节奏轻快且真实；
* 发丝与眨眼自然流畅；
* 配合首尾闭环，形成无限平滑微动。

### 5.2 生产级压制命令
```bash
ffmpeg -y -i "raw_kling_5s.mp4" \
  -filter:v "setpts=0.5*PTS,scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0" \
  -an -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p \
  "character_idle.mp4"
```

---

## 6. 一键自动化全流程脚本 (Python)

```python
import os, time, subprocess, requests
from pathlib import Path
from PIL import Image
import imageio_ffmpeg

API_KEY = os.getenv("MODELINK_API_KEY", "")
ENDPOINT = "https://api.qnaigc.com/queue/fal-ai/kling-video/o3/standard/image-to-video"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def make_idle_video(image_path: str, output_mp4: str):
    if not API_KEY:
        raise ValueError("请设置环境变量 MODELINK_API_KEY")

    # 1. 预压缩底图
    from io import BytesIO
    import base64
    im = Image.open(image_path).convert("RGB")
    buf = BytesIO()
    im.save(buf, format="JPEG", quality=90)
    image_uri = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    # 2. 提交首尾闭环锁机位任务
    payload = {
        "image_url": image_uri,
        "end_image_url": image_uri,  # 首尾闭环绑定完全同一张图
        "prompt": (
            "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，禁止镜头旋转与环绕。"
            "角色原地静立，仅有极其微小的胸口呼吸起伏和自然眨眼，发丝极轻微晃动，"
            "纯白背景完全静止，无死角锁死机位，无缝循环。"
        ),
        "duration": "5",
        "generate_audio": False
    }
    resp = requests.post(ENDPOINT, json=payload, headers=HEADERS, timeout=60).json()
    status_url, resp_url = resp["status_url"], resp["response_url"]
    
    # 轮询下载 5s 原片素材
    while True:
        time.sleep(8)
        st = requests.get(status_url, headers=HEADERS).json()
        if st.get("status") == "COMPLETED":
            video_url = requests.get(resp_url, headers=HEADERS).json()["video"]["url"]
            Path("idle_raw_5s.mp4").write_bytes(requests.get(video_url).content)
            break
        elif st.get("status") == "FAILED":
            raise RuntimeError(f"生成失败: {st}")

    # 3. 2x 倍速加速 + CAS 自适应锐化
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    vf = "setpts=0.5*PTS,scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0"
    cmd = [
        ffmpeg_exe, "-y", "-i", "idle_raw_5s.mp4",
        "-filter:v", vf, "-an", "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
        output_mp4
    ]
    subprocess.run(cmd, check=True)
    print(f"常驻待机视频制作完成: {output_mp4} (2.5秒无缝微动循环)")
```
