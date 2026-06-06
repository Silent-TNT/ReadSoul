#!/usr/bin/env node
/**
 * 生成 Beta 门禁随机密钥，并可选写入 .env.local
 *
 * 用法：
 *   npm run gen:beta-secret          # 仅打印，手动复制
 *   npm run gen:beta-secret -- --write   # 写入/更新 .env.local
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const secret = crypto.randomBytes(32).toString("hex");
const write = process.argv.includes("--write");
const envPath = path.join(process.cwd(), ".env.local");

const lines = [
  `BETA_GATE_SECRET=${secret}`,
  `NEXT_PUBLIC_BETA_GATE_SECRET=${secret}`,
];

console.log("");
console.log("── 阅己 ReadSoul · Beta 门禁密钥 ──");
console.log("");
console.log("以下两行前后端须相同，生产环境必填；本地开发可留空跳过门禁。");
console.log("");
for (const line of lines) console.log(line);
console.log("");

if (!write) {
  console.log("提示：执行 npm run gen:beta-secret -- --write 可自动写入 .env.local");
  console.log("");
  process.exit(0);
}

function upsertEnv(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(content)) return content.replace(re, line);
  return content.trimEnd() + (content.endsWith("\n") ? "" : "\n") + line + "\n";
}

let content = "";
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, "utf8");
} else {
  const examplePath = path.join(process.cwd(), ".env.example");
  if (fs.existsSync(examplePath)) {
    content = fs.readFileSync(examplePath, "utf8");
    console.log("未找到 .env.local，已从 .env.example 创建。");
  } else {
    content = "# ReadSoul 环境变量\n";
    console.log("未找到 .env.local，已创建新文件。");
  }
}

content = upsertEnv(content, "BETA_GATE_SECRET", secret);
content = upsertEnv(content, "NEXT_PUBLIC_BETA_GATE_SECRET", secret);
fs.writeFileSync(envPath, content, "utf8");

console.log(`已写入 ${envPath}`);
console.log("请勿将 .env.local 提交到 Git。");
console.log("");
