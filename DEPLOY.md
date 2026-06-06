# ReadSoul 部署指南

## 推荐方案

| 平台 | 适用 | 说明 |
|------|------|------|
| **Railway / Fly.io** | Beta 首选 | Node 长驻，支持观点织网 120s 长任务 |
| **Docker + VPS** | 成本可控 | 使用本仓库 `Dockerfile` + Caddy/Nginx HTTPS |
| **Vercel Pro** | Serverless | 需 Pro 计划支持 `maxDuration=120` |

## 生成 Beta 门禁密钥

Beta 密钥是一串随机字符串，用于防止他人直接调用你的 AI 接口。与用户的 `wrk-` Key、你的 `AI_API_KEY` 无关。

```bash
# 仅打印，手动复制到环境变量
npm run gen:beta-secret

# 自动写入/更新 .env.local（本地开发）
npm run gen:beta-secret -- --write
```

输出示例：

```bash
BETA_GATE_SECRET=a7f3c9e2b1d84f6a0e5c8b2d9f1a3e7c...
NEXT_PUBLIC_BETA_GATE_SECRET=a7f3c9e2b1d84f6a0e5c8b2d9f1a3e7c...
```

**两行必须完全相同。** 本地开发可留空（跳过门禁）；生产环境必填。

## 环境变量（生产必配）

复制 `.env.example` 为 `.env.local` 或填入平台环境变量面板：

```bash
WEREAD_SKILL_VERSION=1.0.3
AI_API_KEY=sk-...
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat

BETA_GATE_SECRET=<npm run gen:beta-secret 生成>
NEXT_PUBLIC_BETA_GATE_SECRET=<与上一行相同>

# 可选
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

## Railway 部署（逐步）

### 1. 准备仓库

将项目推送到 GitHub（`.env.local` 已在 `.gitignore` 中，勿提交密钥）。

### 2. 创建 Railway 项目

1. 打开 [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. 选择 ReadSoul 仓库
3. Railway 会自动检测 Next.js，默认 Build / Start 一般为：
   - Build: `npm run build`
   - Start: `npm run start`

### 3. 配置环境变量

进入项目 → **Variables**，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `WEREAD_SKILL_VERSION` | `1.0.3` | 与 weread-skill 版本一致 |
| `AI_API_KEY` | `sk-...` | DeepSeek / OpenAI 等 |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | |
| `AI_MODEL` | `deepseek-chat` | |
| `BETA_GATE_SECRET` | 运行 `npm run gen:beta-secret` 得到 | 服务端校验 |
| `NEXT_PUBLIC_BETA_GATE_SECRET` | **与上一行相同** | 前端构建时注入 |

> `NEXT_PUBLIC_*` 会在 **构建阶段** 打进前端包。修改变量后需在 Railway 触发 **Redeploy** 才会生效。

### 4. 绑定域名

1. 项目 → **Settings** → **Networking** → **Generate Domain**（可先拿 `*.up.railway.app` 测试）
2. 自有域名：添加 Custom Domain → 按提示在 DNS 添加 CNAME
3. Railway 自动提供 HTTPS

### 5. 验证部署

```bash
# 无密钥时应返回 401
curl -X POST https://你的域名/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[]}'

# 带密钥 + wrk- Key 才应通过 middleware（仍可能 503 若未配 AI）
curl -X POST https://你的域名/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "X-ReadSoul-Beta: 你的BETA_GATE_SECRET" \
  -H "Authorization: Bearer wrk-xxxxxxxx" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

浏览器访问首页 → 输入 `wrk-` Key → 测试「阅读人格」「灵魂解读」「观点织网」。

## Docker 部署

```bash
npm run gen:beta-secret -- --write   # 本地生成并写入 .env.local
docker compose up -d --build
```

反向代理示例（Caddy）：

```
readsoul.cn {
  reverse_proxy localhost:3000
}
```

## 上线自检

- [ ] `BETA_GATE_SECRET` 与 `NEXT_PUBLIC_BETA_GATE_SECRET` 已设置且相同
- [ ] 无密钥时 `POST /api/ai/chat` 返回 401
- [ ] HTTPS 生效
- [ ] 观点织网能完整跑完（或显示超时提示）
- [ ] `/privacy` 可访问
- [ ] 手机端可「更换 Key」退出
