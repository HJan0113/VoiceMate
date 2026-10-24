---
name: modelink-character-angry
description: >-
  角色情绪愤怒/气恼微动生产管线技能。
  适用于制作 Web 二次元角色与桌面虚拟伴侣的「情绪交互/愤怒气恼状态 (Angry / Pout State)」，
  包含立绘输入预处理、可灵 o3 首尾闭环锁机位图生视频、无脸红薄怒微表情时序控制与 FFmpeg AMD CAS 自适应锐化压制标准工业流程，
  输出神态冷峻带嗔怒、秀眉微蹙抗议、面色自然白皙不脸红、发丝眼睫纤毫毕现的高清愤怒气恼视频。
---

# 角色情绪愤怒气恼微动管线：立绘输入 + 锁机位图生视频 + 无脸红微表情工程 + CAS 锐化压制 (modelink-character-angry)

本 Skill 专门固化了制作 Web 二次元角色与桌面虚拟伴侣**情绪愤怒气恼状态 (Angry / Pout State)** 的全流程生产规范与工业级参数：
* **核心目标**：生成神态灵动薄怒（神色微敛 ➔ 双眉微蹙 ➔ 美眸轻凝带嗔怒 ➔ 小嘴微抿轻撇嘴角表达抗议 ➔ 面色自然白皙严禁脸红 ➔ 情绪收敛平复）、双脚站立如松不移步、无限闭环循环的角色愤怒视频（如 `character_angry.mp4`）；
* **核心方案**：利用图生视频首尾帧同图绑定闭环彻底锁死机位旋转与镜头位移，配合显式无脸红薄怒微表情时序提示词工程，结合 Lanczos 1080P 重采样 + AMD CAS 自适应锐化与高码率 CRF 14 压制。

---

## 1. 核心端点与凭证规范

* **服务接入点 (BaseURL)**：
  * 中国大陆环境：`https://api.qnaigc.com`
  * 海外/跨境环境：`https://api.modelink.ai`
* **鉴权 Header**：`Authorization: Bearer <YOUR_API_KEY>`
* **推荐选用模型**：`kling-video/o3/standard/image-to-video`（下半身站姿先验最稳，无挪步晃移问题）

---

## 2. 生产流程架构

```
[阶段一：立绘输入图与 JPEG 预压缩]
  │ 原画要求：0°正视平视 + 双唇紧闭/微抿 + 纯白底
  │ 预处理：Pillow 压缩为 90% 质量 JPEG (<150KB)，杜绝 Base64 上传超时与 TLS 握手异常
  ▼
[阶段二：可灵 o3 首尾闭环与无脸红嗔怒微表情时序控制]
  │ 端点：POST /queue/fal-ai/kling-video/o3/standard/image-to-video
  │ 核心约束：image_url 与 end_image_url 绑定完全同一张底图，彻底锁死摄像机视角
  │ 提示词时序：
  │   - 绝对固定机位 + 纯白背景完全静止 + 双脚鞋靴完全静止不移步
  │   - 神情自然平静 ➔ 双眉微蹙敛起，美眸轻凝流露薄怒与不满气恼
  │   - 小嘴微抿轻撇嘴角表达抗议与不满，伴随轻度生气的胸口微幅起伏呼吸，发丝微颤
  │   - 面色保持自然清爽白皙，绝对严禁脸红，严禁两颊泛红与任何腮红，面部肤色纯净白皙与初始立绘完全一致
  │   - 神态端正精致、傲娇冷峻薄怒带威严，唯美二次元端庄精致，严禁面容崩坏扭曲变形，首尾平滑闭环
  ▼
[阶段三：输出原始 5s 愤怒气恼视频素材 (960x960)]
  │
  ▼
[阶段四：FFmpeg 智能 CAS 自适应锐化与高保真压制]
  │ 智能锐化：Lanczos 1080P 重采样 + AMD CAS (strength=0.85) + Unsharp 轮廓增强
  │ 高保真压制：libx264 -crf 14 -preset slow (输出 1080x1080, 码率 6~8+ Mbps)
  ▼
[输出冷峻带嗔、神态生动、肤色自然白皙的高清愤怒伴侣视频]
```

---

## 3. 阶段一：输入图预处理规范

为避免 AI 视频网关在上传大体积 Base64 时报 `ReadTimeout` 或 SSL 错误，输入图片提交前**必须**用 Pillow 转为 90% 质量 JPEG（体积压至 100~150KB）：

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

## 4. 阶段二：嗔怒微表情时序提示词工程

### 4.1 避坑硬性要求
* **严禁极端暴戾词汇**：“暴怒、狰狞、面容扭曲、张牙舞爪、咆哮、青筋暴起”等词汇会导致扩散模型严重撕裂二次元五官，使二次元角色丑化变形；
* **严禁两颊泛红与腮红**：二次元扩散模型在生成生气/傲娇时容易自动添加大面积红晕甚至面瘫式圆斑腮红，破坏角色原本纯净高贵的面部质感；必须显式强约束：“面色保持自然清爽白皙，绝对严禁脸红、严禁两颊泛红、严禁任何面部腮红与红晕，面部肤色纯净白皙与初始立绘完全一致”；
* **偏向傲娇/冷峻薄怒/抗议微表情**：通过眉头紧蹙、眼眸清冷微睁、小嘴微抿轻撇嘴角表达傲娇抗议；
* **下半身强约束**：必须显式声明下半身与双脚完全静止在地面上，禁止动脚、禁止迈步；
* **精致端庄**：强调“唯美二次元精致面容，神态冷峻薄怒带威严，端庄优雅严禁崩坏变形，首尾平滑闭环”。

### 4.2 愤怒气恼标准提示词模板
```python
ANGRY_PROMPT = (
    "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，纯白背景完全静止，禁止镜头旋转与环绕。"
    "角色原地静立，下半身与双脚完全静止固定在地面上，绝对禁止动脚、禁止移步、双脚鞋靴完全静止不动。"
    "仅上半身与面部轻微动作：起初神色自然平静，随后双眉微蹙敛起，美眸轻凝带着薄怒与严厉不悦神色，"
    "小嘴微抿轻撇嘴角表达不满与抗议，伴随轻度生气的胸口微幅起伏呼吸，发丝微颤。"
    "面色保持自然清爽白皙，绝对严禁脸红、绝对严禁两颊泛红、严禁任何面部腮红与红晕，面部肤色纯净白皙与初始立绘完全一致。"
    "神态端正精致、傲娇冷峻薄怒带威严，唯美二次元精致端正，严禁面容崩坏扭曲变形，随后情绪稍敛平复，首尾平滑闭环。"
)
```

---

## 5. 阶段三：FFmpeg 智能 CAS 锐化与高保真压制规范

### 5.1 锐化滤镜链
```bash
ffmpeg -y -i "raw_angry_5s.mp4" \
  -filter:v "scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0" \
  -an -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p \
  "character_angry.mp4"
```

* `scale=1080:1080:flags=lanczos`：从原生 960x960 无损超采样至 1080x1080；
* `cas=strength=0.85`：AMD 对比度自适应锐化，强化眼眸亮斑、发丝纹理与微表情细节，不产生过度边缘白边；
* `unsharp=5:5:0.6:5:5:0.0`：提升二次元线稿轮廓边缘的清晰度；
* `-crf 14 -preset slow`：高保真压制，码率达 6+ Mbps，杜绝任何色带和暗部噪点。

---

## 6. 一键自动化全流程脚本 (Python)

```python
import os, time, subprocess, requests
from pathlib import Path
from PIL import Image
import io, base64
import imageio_ffmpeg

API_KEY = os.getenv("MODELINK_API_KEY", "")
ENDPOINT = "https://api.modelink.ai/queue/fal-ai/kling-video/o3/standard/image-to-video"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def make_angry_video(image_path: str, output_mp4: str):
    if not API_KEY:
        raise ValueError("请设置环境变量 MODELINK_API_KEY")

    # 1. 预处理原图至 <150KB JPEG
    im = Image.open(image_path).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    image_uri = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    # 2. 提交任务
    payload = {
        "image_url": image_uri,
        "end_image_url": image_uri,  # 首尾闭环绑定完全同一张图
        "prompt": (
            "绝对固定机位，定焦镜头无任何运镜，正视平视画面完全静止，纯白背景完全静止，禁止镜头旋转与环绕。"
            "角色原地静立，下半身与双脚完全静止固定在地面上，绝对禁止动脚、双脚鞋靴完全静止不动。"
            "仅上半身与面部轻微动作：起初神色自然平静，随后双眉微蹙敛起，美眸轻凝带着薄怒与严厉不悦神色，"
            "小嘴微抿轻撇嘴角表达不满与抗议，伴随轻度生气的胸口微幅起伏呼吸，发丝微颤。"
            "面色保持自然清爽白皙，绝对严禁脸红、绝对严禁两颊泛红、严禁任何面部腮红与红晕，面部肤色纯净白皙与初始立绘完全一致。"
            "神态端正精致、傲娇冷峻薄怒带威严，唯美二次元精致端正，严禁面容崩坏扭曲变形，随后情绪稍敛平复，首尾平滑闭环。"
        ),
        "duration": "5",
        "generate_audio": False
    }
    
    resp = requests.post(ENDPOINT, json=payload, headers=HEADERS, timeout=60).json()
    status_url, resp_url = resp["status_url"], resp["response_url"]
    print(f"任务已提交，Request ID: {resp.get('request_id')}，等待渲染...")

    raw_tmp = "tmp_angry_raw_5s.mp4"
    while True:
        time.sleep(8)
        st = requests.get(status_url, headers=HEADERS).json()
        if st.get("status") == "COMPLETED":
            video_url = requests.get(resp_url, headers=HEADERS).json()["video"]["url"]
            Path(raw_tmp).write_bytes(requests.get(video_url).content)
            break
        elif st.get("status") == "FAILED":
            raise RuntimeError(f"生成失败: {st}")

    # 3. Lanczos 1080P 重采样 + AMD CAS 自适应锐化
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    vf = "scale=1080:1080:flags=lanczos,cas=strength=0.85,unsharp=5:5:0.6:5:5:0.0"
    cmd = [
        ffmpeg_exe, "-y", "-i", raw_tmp,
        "-filter:v", vf,
        "-an", "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
        output_mp4
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(raw_tmp):
        os.remove(raw_tmp)
    print(f"高清无脸红愤怒气恼微动视频制作完成: {output_mp4}")
```
