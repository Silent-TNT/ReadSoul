# 阅己 ReadSoul · 见人阅己

连接你的微信读书数据，把无法被丈量的阅读，化作一幅可以凝视、可以分享的灵魂图谱。

> 域名：readsoul.cn · 副标：见人阅己

## 功能特性

### 数据可视化
- 阅读全景总览（累计时长 / 阅读天数 / 日均 / 读过·读完·笔记）
- 阅读时间轴、书籍类型分布、作者排行
- 24 小时活跃时段、阅读 TOP 10、笔记分布
- 划线词云、阅读演化、回顾卡片导出

### AI 能力
- **阅读人格**：MBTI 风格分析（未配置 AI 时规则降级）
- **灵魂解读**：流式 AI 伴读对话，携带阅读摘要 + RAG 笔记
- **观点织网**：Embedding + 聚类 + LLM 分析笔记跨书关联

### 其他
- **我的笔记**：浏览划线/想法、导出 Markdown、单书 AI 解读
- **阅读海报**：可定制风格并导出 PNG
- 明/暗双主题、侧边导览、数据刷新、`weread://` 深链
- 手机端 / 电脑端响应式适配

## 技术栈

- Next.js 14（App Router）+ TypeScript + Tailwind CSS
- ECharts（含 echarts-wordcloud）
- html-to-image（导出分享图）
- 无数据库：Key 存 localStorage，观点织网缓存 IndexedDB

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填写 AI_API_KEY、BETA_GATE_SECRET 等
npm run dev
```

访问 http://localhost:3000

## 环境变量

| 变量 | 说明 |
|------|------|
| `WEREAD_SKILL_VERSION` | 微信读书 Skill 版本（默认 1.0.3） |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | AI 人格、对话、观点织网 |
| `AI_EMBED_MODEL` / `AI_EMBED_BASE_URL` | Embedding（可选，无则 LLM 降级） |
| `BETA_GATE_SECRET` / `NEXT_PUBLIC_BETA_GATE_SECRET` | Beta 门禁（AI 接口鉴权） |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | 错误监控（可选） |

## 生产部署

详见 [DEPLOY.md](./DEPLOY.md)。推荐 Railway / Docker VPS（支持观点织网 120s 长任务）。

```bash
npm run build && npm run start
# 或
docker compose up -d --build
```

## 架构

```
浏览器(localStorage 存 wrk- key)
   │  Authorization: Bearer wrk-...
   ▼
Next.js middleware（AI 鉴权 + 限流）
   ├─ /api/weread           → 微信读书网关（api_name 白名单）
   ├─ /api/cover            → 封面图代理
   └─ /api/ai/*             → 人格 / 对话 / 观点织网
```

## 目录结构

```
app/
  page.tsx                 落地页
  dashboard/page.tsx       五 Tab 看板
  privacy/page.tsx         隐私说明
  api/weread/              微信读书代理
  api/ai/chat/             灵魂解读
  api/ai/personality/      阅读人格
  api/ai/insight-build/    观点织网
components/sections/       可视化模块
components/insights/       观点织网 UI
lib/weread.ts              接口封装
middleware.ts              AI 鉴权与限流
```

## 说明

- 「阅读地图」因微信读书 API 无地理位置数据，当前未实现。
- 隐私说明见站内 `/privacy` 页面。

---

阅己 ReadSoul · 让人们更好地认识自己
