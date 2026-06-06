interface Props {
  message: string;
}

/** 全屏加载：品牌 + 域名 + 进度文案 */
export default function LoadingScreen({ message }: Props) {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6">
      <div className="animate-fade-in text-center">
        <p className="mb-3 font-sans text-xs tracking-[0.4em] text-soul-gold/60">
          READSOUL.CN
        </p>
        <h1 className="font-serif text-4xl font-black text-soul-cream">
          阅<span className="gold-text">己</span>
        </h1>
        <p className="mt-2 text-xs tracking-[0.28em] text-white/40">
          见人阅己 · readsoul.cn
        </p>
        <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-soul-gold to-transparent" />
        </div>
        <p className="mt-4 text-sm text-white/50">{message}</p>
      </div>
    </main>
  );
}
