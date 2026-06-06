import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "隐私说明 · 阅己 ReadSoul",
  description: "阅己 ReadSoul 隐私与数据使用说明",
};

export default function PrivacyPage() {
  return (
    <main className="grain min-h-screen px-6 py-16">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <article className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-soul-gold/80 transition hover:text-soul-gold"
        >
          ← 返回首页
        </Link>
        <h1 className="mt-6 font-serif text-3xl font-black text-soul-cream">
          隐私说明
        </h1>
        <div className="soul-card mt-8 space-y-5 text-sm leading-relaxed soul-card-sub">
          <section>
            <h2 className="soul-card-title mb-2 text-base">API Key 存储</h2>
            <p>
              你的微信读书 API Key（<code className="text-soul-gold">wrk-</code>
              ）仅保存在浏览器 localStorage 中，我们不会在后端数据库持久化存储。
            </p>
          </section>
          <section>
            <h2 className="soul-card-title mb-2 text-base">数据请求</h2>
            <p>
              每次读取阅读数据时，Key 经本站服务端代理转发至微信读书官方网关（
              i.weread.qq.com），代理层不做 Key 或阅读内容的持久化。
            </p>
          </section>
          <section>
            <h2 className="soul-card-title mb-2 text-base">AI 功能</h2>
            <p>
              阅读人格、灵魂解读、观点织网等 AI
              功能会将你的阅读统计摘要、笔记/划线片段发送至部署方配置的 LLM
              服务商（如 DeepSeek、OpenAI 等）进行分析。请勿在笔记中包含敏感个人信息。
            </p>
          </section>
          <section>
            <h2 className="soul-card-title mb-2 text-base">本地缓存</h2>
            <p>
              观点织网分析结果、主题偏好、用户思考笔记等保存在浏览器 IndexedDB /
              localStorage 中，清除浏览器数据即可删除。
            </p>
          </section>
          <section>
            <h2 className="soul-card-title mb-2 text-base">Beta 试用</h2>
            <p>
              当前为小范围试用阶段。如有问题或反馈，请联系站点管理员。
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
