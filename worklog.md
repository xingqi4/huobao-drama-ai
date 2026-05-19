---
Task ID: 1
Agent: Main Agent
Task: 修复免费用户API Key配置功能

Work Log:
- 读取了 settings-view.tsx 全文（1896行），理解了当前代码结构
- 检查了 api.ts 中 userProvider 的类型定义
- 检查了 user-provider/route.ts 后端API逻辑
- 运行 npm run build 确认当前代码可以成功构建
- 启动 dev server 验证无白屏错误
- 分析用户需求：管理员看默认key，免费用户看不到默认key但可添加自己的key

主要修改：
1. **settings-view.tsx** - CategoryPanel 组件重写：
   - 管理员：显示完整的 ProviderCard（可编辑、测试、保存）
   - 非管理员：只显示"平台共享 Key"状态区域（Badge显示哪些已配置，不暴露key值）
   - "我的 API Key"区域对所有用户可见（管理员标注"个人覆盖"，免费用户标注"优先使用"）

2. **settings-view.tsx** - handleSetActiveUserProvider 修复：
   - 不再发送空的 apiKey 创建空记录
   - 如果用户没有配置过该 provider 的 key，提示先配置
   - 切换时保留现有的 apiKey

3. **api.ts** - 类型修复：
   - apiKey 从 required 改为 optional

4. **user-provider/route.ts** - upsert 逻辑优化：
   - create: apiKey 为空时默认空字符串
   - update: 只有 apiKey 非空时才更新，避免覆盖已有 key

Build: ✅ npm run build 成功
Push: ❌ GitHub token 过期，无法推送

Stage Summary:
- 本地构建成功，commit 2bee554 已创建
- 需要用户更新 GitHub token 才能推送到远程
