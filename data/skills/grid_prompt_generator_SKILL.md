---
name: grid-image-generator
description: 图片提示词生成指南 — 角色、场景、宫格图三类提示词规范
---

# 宫格提示词生成专家 — 专业技能指南

本 SKILL 对应 `grid_prompt_generator` Agent，支持生成三类图片提示词：

1. **角色图片提示词** — 角色外貌与气质的肖像图
2. **场景图片提示词** — 场景氛围与光线的背景图
3. **宫格图提示词** — 多镜头网格拼图（首帧/首尾帧/多参考）

## 核心工作流程

1. **读取数据**：
   - 调用 `read_characters` 获取角色信息
   - 调用 `read_scenes` 获取场景信息
   - 调用 `read_shots` 获取分镜信息
2. **生成提示词**：
   - 为每个角色生成肖像提示词 → `generate_character_prompt`
   - 为每个场景生成背景提示词 → `generate_scene_prompt`
   - 为每个分镜生成宫格图提示词 → `generate_grid_prompt`
3. **保存结果**：每个提示词生成后立即保存

---

## 一、角色图片提示词

### 模板结构

```
A [gender] [age] character, [name], [body type], [facial features].
[Hair description]. [Clothing details].
[Pose and expression]. [Background: simple/gradient].
Style: [art style], high quality, detailed, character concept art.
```

### 生成规则

- 以 `appearance`（外貌描述）为核心，这是最重要的部分
- `personality` 决定气质基调（内敛→沉静表情 / 张扬→自信姿态 / 神秘→半侧脸）
- `role` 决定服装和道具风格（霸道总裁→西装 / 武侠→汉服剑客）
- 必须包含 `character concept art` + `consistent art style`
- 避免出现文字、签名、水印
- 背景保持简洁（纯色渐变），不要抢主体

### 完整示例

```
A young woman in her early 20s, Li Mei, slender build, delicate oval face with bright almond eyes.
Long black hair flowing over shoulders with subtle waves. Wearing a vintage blue qipao with floral embroidery, jade bracelet on left wrist.
Standing confidently with a slight smile, one hand on hip, chin slightly raised. Background: soft warm gradient.
Style: cinematic anime, high quality, detailed, character concept art, consistent art style.
```

### 反面示例

❌ `A pretty Chinese girl, beautiful, nice clothes, standing there.`
→ 太抽象，没有具体视觉信息，AI 无法生成准确图像

---

## 二、场景图片提示词

### 模板结构

```
A cinematic [style] pure background scene depicting [location] at [time].
The scene shows [environment details, architecture, objects, lighting].
No characters, no people, no figures.
Style: [art style], rich details, high quality, atmospheric lighting.
Mood: [mood description].
```

### 生成规则

- 以 `location`（地点）为基础
- `time` 决定光线色调（白天→明亮暖色 / 夜晚→深蓝冷色 / 黄昏→橙金暖色）
- 场景氛围词：atmospheric, moody, warm, cold, serene, ominous 等
- 必须包含 `pure background scene` + `No characters`（确保纯背景）
- 必须包含 `consistent art style` 保持全片风格统一
- 避免出现文字、签名、水印

### 完整示例

```
A cinematic anime-style pure background scene depicting a traditional Chinese courtyard at dusk.
The scene shows wooden corridors surrounding a zen garden with raked white gravel,
a single cherry blossom tree with petals falling, stone lanterns casting warm light,
sliding wooden doors partially open, tea set on stone table. No characters, no people, no figures.
Style: ghibli-inspired, rich details, high quality, warm golden hour lighting, atmospheric.
Mood: peaceful, nostalgic, serene.
```

---

## 三、宫格图提示词

### 三种模式

#### 首帧模式 (first_frame)

每个格子 = 一个镜头的起始画面。必须严格生成用户指定的 `rows x cols` 总格数。

```
[rows x cols grid layout], exactly [rows*cols] visible panels, consistent art style, [style description],
格1: [shot 1 opening scene — character standing in doorway, dramatic backlight],
格2: [shot 2 opening scene — close-up of hands gripping a letter],
格3: [shot 3 opening scene — wide shot of empty hallway],
...
格N: [shot N opening scene],
high quality, cinematic lighting, no merged panels, no missing panels, no text, no watermark
```

#### 首尾帧模式 (first_last)

每个镜头用两个格子：一个首帧（起始状态）、一个尾帧（结束状态）。仍然必须严格生成用户指定的 `rows x cols` 总格数，不允许偷偷改成 `Nx2`。

```
[rows x cols grid layout], exactly [rows*cols] visible panels, consistent art style, [style description],
格1: [shot 1 opening — character walks toward camera in rain],
格2: [shot 1 closing — character stops, looks up, rain on face],
格3: [shot 2 opening — close-up of letter being opened],
格4: [shot 2 closing — character's shocked expression, letter falls],
...
high quality, cinematic, continuous motion implied, no merged panels, no missing panels, no text, no watermark
```

#### 多参考模式 (multi_ref)

所有格子都是同一镜头的不同角度/构图参考。仍然必须严格生成用户指定的 `rows x cols` 总格数。

```
[rows x cols grid layout], exactly [rows*cols] visible panels, same scene different angles, [style description],
[main scene description — a young woman standing in a traditional courtyard at dusk],
格1: wide shot establishing, full courtyard visible,
格2: medium shot character focus, upper body centered,
格3: close-up detail, face and hair in golden light,
格4: dramatic low angle, character silhouetted against sunset,
格5: over-shoulder shot, looking toward the open gate,
格6: bird's eye view, character small in the courtyard,
consistent lighting and color palette, no merged panels, no missing panels, no text, no watermark
```

### 宫格图通用规则

1. 提示词使用**英文**
2. 必须明确写出用户指定的 `rows x cols grid layout`（如 `2x3 grid layout`）
3. 必须包含 `consistent art style` 保持风格统一
4. 必须明确要求 `exactly N visible panels`（N = rows × cols）
5. 必须明确要求 `no merged panels, no missing panels`（防止格子融合或缺失）
6. 避免在格子间出现分割线的描述
7. 尺寸建议：每格 960x540，总图 = 960×cols × 540×rows
8. 当存在参考图映射时，统一使用 `图片1/图片2/...` 指代参考图，不要把它和 `格1/格2/...` 混用

---

## 提示词工程核心原则

### 结构化公式

```
[风格] + [主体描述] + [细节描述] + [光线] + [构图] + [品质标签]
```

### 风格关键词速查

| 风格 | 关键词 |
|-----|-------|
| 影视质感 | `cinematic, film still, movie quality, film grain` |
| 超写实 | `photorealistic, hyperrealistic, 8k ultra detailed` |
| 赛博朋克 | `cyberpunk, neon lights, dark atmosphere, rain` |
| 中国古风 | `Chinese traditional style, ink wash, elegant, wuxia` |
| 日系动漫 | `anime style, cel shading, vibrant colors, ghibli-inspired` |
| 漫画风 | `comic book style, bold outlines, vivid colors, halftone` |
| 黑白电影 | `black and white, film noir, high contrast, dramatic shadows` |

### 光线关键词速查

| 光线类型 | 关键词 | 效果 |
|---------|-------|------|
| 自然光 | `natural lighting, soft daylight` | 清新、真实 |
| 逆光 | `backlighting, silhouette, rim light` | 戏剧性、轮廓美 |
| 伦勃朗光 | `Rembrandt lighting, dramatic shadows` | 立体感、情绪化 |
| 暖光 | `warm golden light, sunset glow, amber tones` | 温馨、浪漫 |
| 冷光 | `cool blue tones, moonlight, cold atmosphere` | 冷峻、孤独 |
| 霓虹光 | `neon lighting, colorful reflections, cyberpunk glow` | 赛博、未来 |

### 构图关键词速查

| 构图 | 关键词 | 效果 |
|-----|-------|------|
| 三分法 | `rule of thirds composition` | 经典、平衡 |
| 居中 | `centered composition, symmetrical` | 庄重、仪式感 |
| 引导线 | `leading lines, perspective, vanishing point` | 纵深、吸引视线 |
| 景深 | `shallow depth of field, bokeh background` | 主体突出、梦幻 |

---

## 负面提示词参考（调用时自动添加）

- 人物：`blurry, low quality, distorted face, extra limbs, deformed, watermark, text, signature`
- 场景：`blurry, low quality, amateur, people, figures, watermark, text overlay`
- 宫格：`blurry, low quality, merged panels, missing panels, watermark, text`

---

## 一致性保证（极重要！）

- **同一角色**在不同镜头/宫格中应使用**完全相同**的外貌描述关键词（发型、服装、配饰）
- **同一场景**在不同镜头/宫格中应保持**一致**的光线、色调和空间布局
- 使用**相同的品质标签**确保全片风格统一（如始终用 `8k ultra detailed, cinematic`）
- 使用**相同的风格关键词**确保全片画风统一（如始终用 `anime style` 或始终用 `photorealistic`）

---

## 常见问题处理

| 问题 | 处理方法 |
|-----|---------|
| 角色外貌信息不足 | 从剧本的角色描写中提取所有视觉细节，不确定的用通用描述 |
| 场景没有具体描写 | 根据场景名+时间段推断合理视觉元素（如"黄昏的咖啡厅"→暖光+咖啡杯+木质家具） |
| 宫格格子数不对 | 严格按要求计算 rows×cols，在提示词中写明 `exactly N visible panels` |
| 格子之间融合 | 加强 `no merged panels` 约束，每格描述要有明确边界 |
| 风格不统一 | 确保所有提示词使用相同的风格关键词和品质标签 |
| 参考图和格子混淆 | 参考图用 `图片1/图片2`，格子用 `格1/格2`，绝不混用 |

## 质量自检清单

- [ ] 角色提示词是否包含完整外貌描述（面部、发型、服装、配饰）
- [ ] 场景提示词是否包含 `No characters` 确保纯背景
- [ ] 宫格图是否写明了 `rows x cols grid layout` 和 `exactly N visible panels`
- [ ] 宫格图是否包含 `no merged panels, no missing panels`
- [ ] 所有提示词是否使用英文
- [ ] 同一角色/场景在不同提示词中外貌描述是否一致
- [ ] 风格关键词是否全局统一
