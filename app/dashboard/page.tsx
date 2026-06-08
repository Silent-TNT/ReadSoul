"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useApiKey } from "@/hooks/useApiKey";
import {
  fetchReadData,
  fetchAllNotebooks,
  fetchBookmarkList,
  fetchShelf,
  WereadError,
} from "@/lib/weread";
import {
  buildOverview,
  buildTimeline,
  buildCategories,
  buildAuthors,
  buildHourly,
  buildTopBooks,
  buildNoteDistribution,
  buildEvolution,
  buildWordCloud,
} from "@/lib/aggregate";
import { formatDuration } from "@/lib/format";
import type { Bookmark } from "@/lib/types";

import Sidebar from "@/components/Sidebar";
import LoadingScreen from "@/components/LoadingScreen";
import DashboardOnboarding from "@/components/DashboardOnboarding";
import { MenuIcon } from "@/components/icons";

import { fetchFullNoteCorpus } from "@/lib/noteCorpus";
import { clearInsightCache } from "@/lib/insightCache";
import type { NoteCorpusItem } from "@/lib/noteLinks";
import type { ReadDataDetail, NotebooksResp, ShelfBook } from "@/lib/types";

const OverviewSection = dynamic(
  () => import("@/components/sections/OverviewSection"),
  { ssr: false }
);
const TimelineSection = dynamic(
  () => import("@/components/sections/TimelineSection"),
  { ssr: false }
);
const CategorySection = dynamic(
  () => import("@/components/sections/CategorySection"),
  { ssr: false }
);
const AuthorSection = dynamic(
  () => import("@/components/sections/AuthorSection"),
  { ssr: false }
);
const HourlySection = dynamic(
  () => import("@/components/sections/HourlySection"),
  { ssr: false }
);
const TopBooksSection = dynamic(
  () => import("@/components/sections/TopBooksSection"),
  { ssr: false }
);
const NoteDistSection = dynamic(
  () => import("@/components/sections/NoteDistSection"),
  { ssr: false }
);
const WordCloudSection = dynamic(
  () => import("@/components/sections/WordCloudSection"),
  { ssr: false }
);
const EvolutionSection = dynamic(
  () => import("@/components/sections/EvolutionSection"),
  { ssr: false }
);
const ReviewCardSection = dynamic(
  () => import("@/components/sections/ReviewCardSection"),
  { ssr: false }
);
const PersonalitySection = dynamic(
  () => import("@/components/sections/PersonalitySection"),
  { ssr: false }
);
import {
  SoulChatProvider,
  SoulChatEmbedded,
  SoulChatFab,
} from "@/components/ChatDrawer";
const NotesView = dynamic(() => import("@/components/notes/NotesView"), {
  ssr: false,
});
const InsightWeaveView = dynamic(
  () => import("@/components/insights/InsightWeaveView"),
  { ssr: false }
);
const ReadingPosterView = dynamic(
  () => import("@/components/poster/ReadingPosterView"),
  { ssr: false }
);

interface DashboardData {
  overall: ReadDataDetail;
  annual: ReadDataDetail;
  notebooks: NotebooksResp;
  shelf: ShelfBook[];
  bookmarks: Bookmark[];
  bookmarkBookTitles: Record<string, string>;
}

const VIEW_TABS = [
  ["poster", "阅读海报", "海报"],
  ["dashboard", "阅读全景", "全景"],
  ["notes", "我的笔记", "笔记"],
  ["insights", "观点织网", "织网"],
  ["ai", "灵魂解读", "解读"],
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { apiKey, clearApiKey, ready } = useApiKey();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("正在唤醒你的阅读灵魂…");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<
    "dashboard" | "notes" | "insights" | "ai" | "poster"
  >("poster");
  const [ragCorpus, setRagCorpus] = useState<NoteCorpusItem[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState("");
  const startedRef = useRef(false);
  const ragStartedRef = useRef(false);
  const [, startTransition] = useTransition();

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      setProgress("正在读取总体阅读统计…");
      const overall = await fetchReadData(key, "overall");

      setProgress("正在并行拉取年度数据、笔记本与书架…");
      const [annualResult, notebooksResult, shelfResult] =
        await Promise.allSettled([
          fetchReadData(key, "annually"),
          fetchAllNotebooks(key),
          fetchShelf(key),
        ]);

      const annual: ReadDataDetail =
        annualResult.status === "fulfilled" ? annualResult.value : {};
      const notebooks: NotebooksResp =
        notebooksResult.status === "fulfilled"
          ? notebooksResult.value
          : { books: [] };
      const shelf: ShelfBook[] =
        shelfResult.status === "fulfilled"
          ? (shelfResult.value.books ?? [])
          : [];

      startTransition(() => {
        setData({
          overall,
          annual,
          notebooks,
          shelf,
          bookmarks: [],
          bookmarkBookTitles: {},
        });
        setLoading(false);
      });

      setProgress("正在采撷你划下的句子…");
      const topNoteBooks = [...(notebooks.books ?? [])]
        .sort(
          (a, b) =>
            (b.reviewCount ?? 0) +
            (b.noteCount ?? 0) -
            ((a.reviewCount ?? 0) + (a.noteCount ?? 0))
        )
        .slice(0, 8);

      const bookmarks: Bookmark[] = [];
      const bookmarkBookTitles: Record<string, string> = {};
      await Promise.all(
        topNoteBooks.map(async (nb) => {
          try {
            const list = await fetchBookmarkList(key, nb.bookId);
            if (list.book?.title)
              bookmarkBookTitles[nb.bookId] = list.book.title;
            else if (nb.book?.title)
              bookmarkBookTitles[nb.bookId] = nb.book.title;
            for (const m of list.updated ?? []) {
              bookmarks.push({ ...m, bookId: nb.bookId });
            }
          } catch {
            // 跳过单本失败
          }
        })
      );

      startTransition(() => {
        setData((prev) =>
          prev
            ? { ...prev, bookmarks, bookmarkBookTitles }
            : prev
        );
      });
    } catch (e) {
      const raw = (e as Error).message ?? "";
      const msg =
        e instanceof WereadError
          ? e.message
          : raw.includes("Unexpected token '<'")
            ? "数据接口返回异常。请确认本地已运行 npm run dev，线上部署需包含 /api/weread 且勿将 /api 指到静态页。"
            : `加载失败：${raw}`;
      setError(msg);
      setLoading(false);
    }
  }, [startTransition]);

  useEffect(() => {
    if (!ready) return;
    if (!apiKey) {
      router.replace("/");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    load(apiKey);
  }, [ready, apiKey, router, load]);

  useEffect(() => {
    if (!apiKey || !data || ragStartedRef.current) return;
    if (view !== "insights" && view !== "ai") return;
    ragStartedRef.current = true;
    setRagLoading(true);
    setRagError("");
    fetchFullNoteCorpus(apiKey, data.notebooks.books ?? [], (msg) =>
      setProgress(msg)
    )
      .then(setRagCorpus)
      .catch((e) => {
        setRagError(
          (e as Error).message || "笔记语料加载失败，灵魂解读与观点织网可能受限"
        );
      })
      .finally(() => setRagLoading(false));
  }, [apiKey, data, view]);

  function openSoulChat() {
    setView("ai");
    setChatOpen(true);
  }

  function handleLogout() {
    clearApiKey();
    router.replace("/");
  }

  async function handleRefresh() {
    if (!apiKey || refreshing) return;
    setRefreshing(true);
    ragStartedRef.current = false;
    setRagCorpus([]);
    setRagError("");
    await clearInsightCache();
    await load(apiKey);
    setRefreshing(false);
  }

  const aggregates = useMemo(() => {
    if (!data) return null;
    const overview = buildOverview(data.overall, data.notebooks);
    const timeline = buildTimeline(
      data.annual.dailyReadTimes ? data.annual : data.overall
    );
    const categories = buildCategories(data.overall);
    const authors = buildAuthors(data.overall);
    const hourly = buildHourly(data.overall);
    const topBooks = buildTopBooks(data.overall);
    const noteDist = buildNoteDistribution(data.notebooks);
    const evolution = buildEvolution(data.overall);
    const wordCloud = buildWordCloud(
      data.bookmarks.map((b) => b.markText || "")
    );
    const personalitySummary = {
      totalReadTimeText: formatDuration(data.overall.totalReadTime),
      readDays: data.overall.readDays,
      noteCount: data.notebooks.totalNoteCount,
      topCategories: categories.slice(0, 3).map((c) => c.name),
      topAuthors: authors.slice(0, 3).map((a) => a.name),
      preferTimeWord: data.overall.preferTimeWord,
      topBooks: topBooks.slice(0, 3).map((b) => b.title),
    };
    return {
      overview,
      timeline,
      categories,
      authors,
      hourly,
      topBooks,
      noteDist,
      evolution,
      wordCloud,
      personalitySummary,
    };
  }, [data]);

  const chatContext = useMemo(() => {
    if (!data || !aggregates) return "";
    const { categories, authors, topBooks } = aggregates;
    return [
      `累计阅读：${formatDuration(data.overall.totalReadTime)}`,
      `有效阅读天数：${data.overall.readDays ?? "未知"} 天`,
      `笔记总数：${data.notebooks.totalNoteCount ?? "未知"} 条`,
      `偏好分类：${categories.slice(0, 5).map((c) => c.name).join("、") || "未知"}`,
      `偏好作者：${authors.slice(0, 5).map((a) => a.name).join("、") || "未知"}`,
      `偏好时段：${data.overall.preferTimeWord ?? "未知"}`,
      `读得最多的书：${topBooks.slice(0, 5).map((b) => b.title).join("、") || "未知"}`,
    ].join("\n");
  }, [data, aggregates]);

  if (!ready) {
    return <LoadingScreen message="正在初始化…" />;
  }

  if (ready && !apiKey) {
    return null;
  }

  return (
    <SoulChatProvider
      context={chatContext}
      noteCorpus={ragCorpus}
      apiKey={apiKey ?? undefined}
      active={Boolean(data && apiKey)}
    >
    <main className="grain min-h-screen pb-12">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onLogout={handleLogout}
      />

      {!chatOpen && data && <SoulChatFab onOpen={openSoulChat} />}

      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="打开设置"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:border-soul-gold/40 hover:text-soul-gold"
            >
              <MenuIcon />
            </button>
            <span className="font-serif text-xl font-black text-soul-cream sm:text-2xl">
              阅<span className="gold-text">己</span>
            </span>
            <span className="hidden text-xs tracking-[0.3em] text-white/30 md:inline">
              见人阅己
            </span>
          </div>

          <nav
            aria-label="功能导航"
            className="flex max-w-[min(72vw,520px)] items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-0.5 sm:max-w-none sm:gap-1 sm:p-1"
          >
            {VIEW_TABS.map(([id, label, short]) => (
              <button
                key={id}
                type="button"
                disabled={!data}
                onClick={() => {
                  if (!data) return;
                  setView(id);
                  if (id === "ai") setChatOpen(true);
                  else setChatOpen(false);
                }}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-medium transition sm:px-3 sm:py-2 sm:text-xs md:text-sm disabled:cursor-wait disabled:opacity-45 ${
                  view === id
                    ? "bg-gradient-to-r from-soul-amber to-soul-gold text-ink-950"
                    : "text-white/55 hover:text-soul-gold"
                }`}
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {(loading || refreshing) && !error && (
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-8">
          <p className="text-center text-xs text-soul-gold/80">{progress}</p>
        </div>
      )}

      {ragError && (
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-8">
          <div className="rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-2 text-center text-xs text-amber-200/90">
            {ragError}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        {error && (
          <div className="soul-card mx-auto max-w-md text-center">
            <p className="font-serif text-xl text-soul-cream">未能连接你的阅读数据</p>
            <p className="mt-3 text-sm text-red-400">{error}</p>
            <p className="mt-3 text-left text-xs leading-relaxed soul-card-sub">
              本地开发请在项目目录运行{" "}
              <code className="text-soul-gold">npm run dev</code>
              ，浏览器访问{" "}
              <code className="text-soul-gold">http://localhost:3000/api/weread</code>
              {" "}应看到 JSON（含 <code className="text-soul-gold">ok: true</code>）。
              若打开是网页，说明 API 路由未生效。
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => apiKey && load(apiKey)}
                className="rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:brightness-110"
              >
                重试
              </button>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
              >
                更换 Key
              </button>
            </div>
          </div>
        )}

        {!error && !data && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-soul-gold to-transparent" />
            </div>
            <p className="mt-4 text-sm soul-card-sub">{progress}</p>
          </div>
        )}

        {data && aggregates && (
          <>
        <DashboardOnboarding />

        {view === "dashboard" && (
        <div className="space-y-6">
            <div id="sec-review" className="scroll-mt-24">
              <ReviewCardSection
                bookmarks={data.bookmarks}
                bookTitles={data.bookmarkBookTitles}
              />
            </div>
            <div id="sec-overview" className="scroll-mt-24">
              <OverviewSection overview={aggregates.overview} />
            </div>
            <div id="sec-personality" className="scroll-mt-24">
              <PersonalitySection
                summary={aggregates.personalitySummary}
                apiKey={apiKey ?? undefined}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div id="sec-category" className="scroll-mt-24">
                <CategorySection data={aggregates.categories} />
              </div>
              <div id="sec-hourly" className="scroll-mt-24">
                <HourlySection
                  data={aggregates.hourly}
                  preferTimeWord={data.overall.preferTimeWord}
                />
              </div>
            </div>
            <div id="sec-timeline" className="scroll-mt-24">
              <TimelineSection data={aggregates.timeline} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div id="sec-author" className="scroll-mt-24">
                <AuthorSection data={aggregates.authors} />
              </div>
              <div id="sec-notes" className="scroll-mt-24">
                <NoteDistSection
                  data={aggregates.noteDist}
                  total={data.notebooks.totalNoteCount}
                />
              </div>
            </div>
            <div id="sec-top" className="scroll-mt-24">
              <TopBooksSection data={aggregates.topBooks} />
            </div>
            <div id="sec-wordcloud" className="scroll-mt-24">
              <WordCloudSection data={aggregates.wordCloud} />
            </div>
            {aggregates.evolution.length > 1 && (
              <div id="sec-evolution" className="scroll-mt-24">
                <EvolutionSection data={aggregates.evolution} />
              </div>
            )}
        </div>
        )}

        {view === "notes" && (
        <div className="mt-2">
            <NotesView apiKey={apiKey ?? ""} books={data.notebooks.books ?? []} />
        </div>
        )}

        {view === "insights" && (
        <div className="mt-2">
            <InsightWeaveView
              apiKey={apiKey ?? ""}
              books={data.notebooks.books ?? []}
              sharedCorpus={ragCorpus}
              sharedLoading={ragLoading}
              onCorpusLoaded={setRagCorpus}
            />
        </div>
        )}

        {view === "ai" && (
        <div className="mt-2">
          {ragLoading && ragCorpus.length === 0 ? (
            <div className="soul-card text-center text-sm soul-card-sub">
              正在加载笔记语料，加载完成后即可对话…
            </div>
          ) : chatOpen ? (
            <SoulChatEmbedded onClose={() => setChatOpen(false)} />
          ) : (
            <div className="soul-card text-center">
              <p className="soul-card-title">灵魂解读</p>
              <p className="mt-2 text-sm soul-card-sub">
                基于你的划线与阅读数据，做深度、可引用的分析
              </p>
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="mt-4 rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:brightness-110"
              >
                开始对话
              </button>
            </div>
          )}
        </div>
        )}

        {view === "poster" && (
        <div className="mt-2">
            <ReadingPosterView
              shelf={data.shelf}
              notebooks={data.notebooks.books ?? []}
            />
        </div>
        )}

        <footer className="pt-8 text-center text-[11px] text-white/25">
          <p>
            阅己 ReadSoul · readsoul.cn · 数据来源：微信读书 · 仅本地读取，不作存储
          </p>
          <a href="/privacy" className="mt-1 inline-block hover:text-soul-gold">
            隐私说明
          </a>
        </footer>
          </>
        )}
      </div>
    </main>
    </SoulChatProvider>
  );
}
