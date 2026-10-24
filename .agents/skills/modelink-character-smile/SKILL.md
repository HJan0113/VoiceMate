---
name: modelink-character-smile
description: >-
  角色情绪微笑微启微动生产管线技能。
  适用于制作 Web 二次元角色与桌面虚拟伴侣的「情绪交互/高兴微笑状态 (Smile / Happy State)」，
  包含可灵首尾闭环、1.0x 原速截取、Gradient Anchor Lock 下半身绝对静止锁定、尾帧余弦平滑闭环与 CAS 锐化压制标准工业流程，
  彻底解决五官融化拉扯、双脚漂移移步以及倍速动作机械急促等工业痛点。
---

# 角色情绪微笑微启微动管线：锁机位 + 原速截取 + 脚部锚定 + 平滑闭环 (modelink-character-smile)

本 Skill 专门固化了制作 Web 二次元角色与桌面虚拟伴侣**情绪微笑微启状态 (Smile / Happy State)** 的工业级全流程生产规范：
* **核心目标**：生成神态自然生动（浅笑 ➔ 轻启微语 ➔ 柔和闭唇）、双脚站立如松绝不移步滑移、原速舒展从容、无限循环无缝顺畅的高清伴侣视频（如 `character_smile.mp4`）；
* **核心方案**：可灵 o3 首尾闭环 + 原速截取前 1.5s~2.0s（不加速） + 下半身双脚梯度锚定（Gradient Anchor Lock） + 尾帧余弦平滑闭环 + FFmpeg CAS 锐化。

---

## 1. 核心端点与凭证规范

* **服务接入点 (BaseURL)**：
  * 中国大陆环境：`https://api.qnaigc.com`
  * 海外/跨境环境：`https://api.modelink.ai`
* **鉴权 Header**：`Authorization: Bearer <YOUR_API_KEY>`
* **推荐选用模型**：`kling-video/o3/standard/image-to-video`（下半身站姿先验最稳，无 v3 版本的剧烈挪步问题）

---

## 2. 生产流程架构

```
[阶段一：立绘输入图与 JPEG 预压缩]
  │ 原画要求：0°正视平视 + 双唇紧闭/微抿 + 纯白底
  │ 预处理：Pillow 压缩为 90% 质量 JPEG (<150KB)，杜绝 Base64 上传超时与 TLS 丢包
  ▼
[阶段二：可灵 o3 首尾闭环与微表情时序控制]
  │ 端点：POST /queue/fal-ai/kling-video/o3/standard/image-to-video
  │ 核心约束：image_url 与 end_image_url 绑定同一张原画，彻底杜绝镜头旋转
  │ 提示词时序：原地静立 + 双脚绝对静止 + 起初浅笑 + 极其自然微微张嘴轻启微语 + 柔和闭拢浅笑
  ▼
[输出原始 5s 视频素材 (960x960)]
  │
  ▼
[阶段三：下半身锚定锁定 + 原速截取 + 尾帧闭环]
  │ 1. 原速截取：切忌盲目倍速加速！截取前 1.5s ~ 2.0s 核心动作，保持 1.0x 真实原速 (24 fps)
  │ 2. 梯度锚定 (Gradient Anchor Lock)：y >= 0.72H 小腿与鞋靴区域 100% 锁定基准第 0 帧，位移差恒为 0
  │ 3. 尾帧平滑闭环：片段最后 5~6 帧余弦平滑过渡回第 0 帧，彻底消除循环顿挫与接缝跳跃
  ▼
[阶段四：FFmpeg 智能 CAS 锐化与高保真压制]
  │ 锐化滤镜：Lanczos 1080P 重采样 + AMD CAS 强自适应锐化 + Unsharp 轮廓增强
  │ 高保真压制：libx264 -crf 14 -preset slow (输出 1080x1080, 码率 6~8+ Mbps)
  ▼
[输出脚下纹丝不动、原速细腻舒展、无缝顺畅循环的微笑伴侣视频]
```

---

## 3. 阶段一：输入图预处理规范

为避免 AI 视频网关在上传大体积 Base64 时报 `ReadTimeout` 或 SSL 解密错误，输入图片提交前**必须**用 Pillow 转为 90% 质量 JPEG（体积压至 100~150KB）：

```python
import io, base64
from PIL import Image

def prepare_image_b64(img_path: str) -> str:
    im = Image.open(img_path).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
```

---

## 4. 阶段二：微表情时序提示词工程

### 4.1 避坑硬性要求
* **严禁词汇**：“大笑、哈哈大笑、大张嘴、咧嘴”等词汇会导致扩散模型剧烈拉扯五官，产生严重的五官融化与恐怖谷效应；
* **下半身强约束**：必须显式声明双脚固定在地面上，禁止动脚。

### 4.2 微笑微张嘴标准提示词模板
```python
SMILE_PROMPT = (
    "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，纯白背景完全静止，禁止镜头旋转与环绕。"
    "角色原地静立，下半身与双脚完全静止固定在地面上，绝对禁止动脚、禁止移步、双脚鞋靴完全静止不动。"
    "仅上半身与面部轻微动作：起初面带温柔优雅浅笑，随后双唇自然轻柔地微微张开（小幅度含笑轻启微语，如同温柔呼应打招呼），"
    "随后双唇柔和闭拢收回浅笑，伴随胸口极微弱呼吸起伏与自然眨眼，发丝极轻微晃动。"
    "动作轻柔从容，严禁大笑，首尾无缝闭环循环。"
)
```

---

## 5. 阶段三：脚部绝对锁定与原速截取闭环（核心工业技术）

### 5.1 为什么不要加速？
分析表明，可灵生成的“浅笑 ➔ 轻启微语 ➔ 柔和闭合”最细腻优美的动作弧线恰好在**前 1.5s ~ 2.0s 内完成**：
* 盲目套用 `setpts` 抽帧加速会导致肌肉抽搐、眨眼如闪烁、动作像踩缝纫机；
* **保持 1.0x 正常原速（24 fps）**，面部神态才能呈现细腻舒展与温润。

### 5.2 Gradient Anchor Lock（下半身梯度锚定技术）
利用静态基准第 0 帧（$f_0$），在垂直方向构建余弦 S 型平滑权重遮罩：
- 上半身（$y < 0.58H$）：维持 100% AI 原生微动（表情、发丝、胸口呼吸）；
- 下半身（$y \ge 0.72H$）：100% 锁定为静态基准第 0 帧；
- 裙摆/腿部（$0.58H \sim 0.72H$）：余弦权重平滑过渡。
- **效果：脚靴相对位移差恒为 0，彻底杜绝滑步与动脚！**

### 5.3 尾帧余弦平滑过渡（无缝循环）
在截取片段的最后 5~6 帧（约 0.25 秒），平滑将画面余弦渐变过渡回第 0 帧，确保在 `<video loop>` 无限循环播放时**完全看不出任何接缝顿挫跳跃**。

---

## 6. 阶段四：FFmpeg 智能 CAS 锐化与高保真压制

```bash
ffmpeg -y -r 24 -i "frames_dir/frame_%03d.png" \
  -filter:v "scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0" \
  -an -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p \
  output_happy.mp4
```

---

## 7. 一键自动化全流程脚本 (Python)

```python
import os, time, subprocess, requests, numpy as np
from pathlib import Path
from PIL import Image
import imageio_ffmpeg

API_KEY = os.getenv("MODELINK_API_KEY", "")
ENDPOINT = "https://api.qnaigc.com/queue/fal-ai/kling-video/o3/standard/image-to-video"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def make_smile_video(image_path: str, output_mp4: str, cut_duration: float = 2.0):
    if not API_KEY:
        raise ValueError("请设置环境变量 MODELINK_API_KEY")

    # 1. 预处理原图至 <150KB JPEG
    from io import BytesIO
    import base64
    im = Image.open(image_path).convert("RGB")
    buf = BytesIO()
    im.save(buf, format="JPEG", quality=90)
    image_uri = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    # 2. 提交任务
    payload = {
        "image_url": image_uri,
        "end_image_url": image_uri,
        "prompt": (
            "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，纯白背景完全静止，禁止镜头旋转与环绕。"
            "角色原地静立，下半身与双脚完全静止固定在地面上，绝对禁止动脚、双脚鞋靴完全静止不动。"
            "仅上半身与面部轻微动作：起初面带温柔优雅浅笑，随后双唇自然轻柔地微微张开（小幅度含笑轻启微语，如同温柔呼应打招呼），"
            "随后双唇柔和闭拢收回浅笑，伴随胸口极微弱呼吸起伏与自然眨眼，发丝极轻微晃动。"
            "动作轻柔从容，严禁大笑，首尾无缝闭环循环。"
        ),
        "duration": "5",
        "generate_audio": False
    }
    resp = requests.post(ENDPOINT, json=payload, headers=HEADERS, timeout=60).json()
    status_url, resp_url = resp["status_url"], resp["response_url"]
    
    # 轮询状态并下载 5s 原片
    while True:
        time.sleep(8)
        st = requests.get(status_url, headers=HEADERS).json()
        if st.get("status") == "COMPLETED":
            video_url = requests.get(resp_url, headers=HEADERS).json()["video"]["url"]
            Path("smile_raw_5s.mp4").write_bytes(requests.get(video_url).content)
            break
        elif st.get("status") == "FAILED":
            raise RuntimeError(f"生成失败: {st}")

    # 3. 截取前 cut_duration 秒 (原速 24fps，不加速)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs("tmp_frames", exist_ok=True)
    subprocess.run([
        ffmpeg_exe, "-y", "-ss", "00:00:00", "-i", "smile_raw_5s.mp4",
        "-t", str(cut_duration), "tmp_frames/f_%03d.png"
    ], check=True, capture_output=True)

    files = sorted([f for f in os.listdir("tmp_frames") if f.endswith(".png")])
    total_f = len(files)
    f0 = np.array(Image.open(f"tmp_frames/{files[0]}").convert("RGB"), dtype=np.float32)
    h, w, _ = f0.shape

    # 4. 下半身双脚绝对锚定锁定
    mask = np.zeros((h, w, 1), dtype=np.float32)
    y_start, y_end = int(h * 0.58), int(h * 0.72)
    for y in range(h):
        if y > y_end:
            mask[y] = 1.0
        elif y > y_start:
            ratio = (y - y_start) / float(y_end - y_start)
            mask[y] = 0.5 * (1.0 - np.cos(ratio * np.pi))

    os.makedirs("proc_frames", exist_ok=True)
    blend_len = 6  # 尾部平滑过渡帧数
    for idx, fn in enumerate(files):
        arr = np.array(Image.open(f"tmp_frames/{fn}").convert("RGB"), dtype=np.float32)
        arr_locked = (1.0 - mask) * arr + mask * f0  # 锁死双脚
        if idx >= total_f - blend_len:
            fade = (idx - (total_f - blend_len) + 1) / float(blend_len + 1)
            smooth_fade = 0.5 * (1.0 - np.cos(fade * np.pi))
            arr_locked = (1.0 - smooth_fade) * arr_locked + smooth_fade * f0  # 平滑闭环
        Image.fromarray(np.clip(arr_locked, 0, 255).astype(np.uint8)).save(f"proc_frames/f_{idx:03d}.png")

    # 5. FFmpeg CAS 锐化与 Lanczos 1080P 高清压制
    vf = "scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0"
    cmd = [
        ffmpeg_exe, "-y", "-r", "24", "-i", "proc_frames/f_%03d.png",
        "-filter:v", vf, "-an", "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
        output_mp4
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"微笑微动视频制作完成: {output_mp4} (脚部静止如松，原速自然顺畅)")
```
