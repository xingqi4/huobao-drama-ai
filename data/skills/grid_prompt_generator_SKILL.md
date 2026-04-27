# 宫格提示词生成器 — 专业技能指南

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

## 提示词工程原则

### 结构化公式
```
[风格] + [主体描述] + [细节描述] + [光线] + [构图] + [品质标签]
```

### 风格关键词
- 影视风格：`cinematic, film still, movie quality`
- 写实风格：`photorealistic, hyperrealistic, 8k ultra detailed`
- 赛博朋克：`cyberpunk, neon lights, dark atmosphere`
- 古风：`Chinese traditional style, ink wash, elegant`
- 漫画风格：`comic book style, bold outlines, vivid colors`

### 光线关键词
- 自然光：`natural lighting, soft daylight`
- 逆光：`backlighting, silhouette, rim light`
- 伦勃朗光：`Rembrandt lighting, dramatic shadows`
- 暖光：`warm golden light, sunset glow`
- 冷光：`cool blue tones, moonlight`

### 构图关键词
- 三分法：`rule of thirds composition`
- 居中：`centered composition, symmetrical`
- 引导线：`leading lines, perspective`
- 景深：`shallow depth of field, bokeh background`

## 角色肖像提示词模板

```
Cinematic portrait, [性别] [年龄描述], [面部特征], [发型发色],
[服装描述], [表情/姿态], [光线效果],
shallow depth of field with bokeh background,
8k ultra detailed, photorealistic
```

## 场景背景提示词模板

```
Cinematic establishing shot, [场景类型],
[空间布局描述], [关键道具/元素],
[光线氛围], [色调], [构图方式],
8k ultra detailed, photorealistic
```

## 宫格分镜图提示词模板

```
Cinematic storyboard frame, [镜头类型],
[角色位置和动作], [场景要素],
[氛围/情绪], [构图描述],
8k ultra detailed, film grain, movie still
```

## 负面提示词参考（调用时自动添加）

- 人物：`blurry, low quality, distorted face, extra limbs, deformed, watermark, text`
- 场景：`blurry, low quality, amateur, cartoon, anime, watermark, text overlay`
- 分镜：`blurry, low quality, cartoon style, anime style, watermark, text`

## 一致性保证

- 同一角色在不同镜头中应使用相似的外貌描述关键词
- 同一场景在不同镜头中应保持一致的光线和色调
- 使用相同的品质标签确保风格统一
