import {
  tokenize,
  type NoteCorpusItem,
  type InsightKind,
} from "@/lib/noteLinks";

export type { NoteCorpusItem, InsightKind };

export interface NoteGraphNode extends NoteCorpusItem {
  clusterId?: string;
  degree: number;
}

export interface NoteGraphEdge {
  source: string;
  target: string;
  kind: InsightKind;
  score: number;
  sharedTerms: string[];
}

export interface ClusterSide {
  label: string;
  nodeIds: string[];
}

export interface InsightCluster {
  id: string;
  kind: "resonance" | "debate";
  theme: string;
  summary?: string;
  nodeIds: string[];
  sides?: ClusterSide[];
  source?: "local" | "ai";
}

export interface InsightGraph {
  nodes: NoteGraphNode[];
  edges: NoteGraphEdge[];
  clusters: InsightCluster[];
}

const STOP = /不|非|没|无|未|勿|别|否|难以|无法|不能|不应|反对|拒绝|缺乏|避免|禁止|否定|并非|不是|不会|不要|不可|不必|不应|不该|不要|避免|切勿|勿/;

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

function sharedTerms(a: Set<string>, b: Set<string>, limit = 5): string[] {
  const out: string[] = [];
  a.forEach((t) => {
    if (b.has(t) && out.length < limit) out.push(t);
  });
  return out;
}

function isOpposing(textA: string, textB: string, overlap: number): boolean {
  if (overlap < 0.08) return false;
  const negA = STOP.test(textA);
  const negB = STOP.test(textB);
  if (negA !== negB && overlap >= 0.1) return true;
  const dutyA = /应|该|必须|需要|值得|应当/.test(textA);
  const dutyB = /应|该|必须|需要|值得|应当/.test(textB);
  const avoidA = /不应|不该|不必|不要|避免|切勿|勿/.test(textA);
  const avoidB = /不应|不该|不必|不要|避免|切勿|勿/.test(textB);
  if ((dutyA && avoidB) || (dutyB && avoidA)) return true;
  const pairs: [string, string][] = [
    ["成功", "失败"], ["自由", "束缚"], ["理性", "感性"], ["乐观", "悲观"],
    ["简单", "复杂"], ["主动", "被动"], ["开放", "封闭"], ["信任", "怀疑"],
  ];
  for (const [w1, w2] of pairs) {
    if (
      (textA.includes(w1) && textB.includes(w2)) ||
      (textA.includes(w2) && textB.includes(w1))
    ) {
      return true;
    }
  }
  return false;
}

/** 构建笔记关联边 */
export function buildAllEdges(
  corpus: NoteCorpusItem[],
  opts: { minScore?: number; maxEdges?: number } = {}
): NoteGraphEdge[] {
  const { minScore = 0.14, maxEdges = 400 } = opts;
  const tokens = new Map<string, Set<string>>();
  corpus.forEach((c) => tokens.set(c.id, tokenize(c.text)));

  const edges: NoteGraphEdge[] = [];

  for (let i = 0; i < corpus.length; i++) {
    for (let j = i + 1; j < corpus.length; j++) {
      const a = corpus[i];
      const b = corpus[j];
      const ta = tokens.get(a.id)!;
      const tb = tokens.get(b.id)!;
      if (ta.size === 0 || tb.size === 0) continue;

      const score = jaccard(ta, tb);
      if (score < 0.06) continue;

      const shared = sharedTerms(ta, tb);
      const opposing = isOpposing(a.text, b.text, score);
      if (opposing) {
        edges.push({
          source: a.id,
          target: b.id,
          kind: "opposing",
          score,
          sharedTerms: shared,
        });
      } else if (score >= minScore) {
        edges.push({
          source: a.id,
          target: b.id,
          kind: "similar",
          score,
          sharedTerms: shared,
        });
      }
    }
  }

  edges.sort((x, y) => y.score - x.score);
  return edges.slice(0, maxEdges);
}

function topThemeForNodes(
  corpus: NoteCorpusItem[],
  nodeIds: string[]
): string {
  const freq = new Map<string, number>();
  const idSet = new Set(nodeIds);
  for (const item of corpus) {
    if (!idSet.has(item.id)) continue;
    tokenize(item.text).forEach((t) => {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    });
  }
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 3).map(([w]) => w).join(" · ") || "阅读思考";
}

function partitionDebateSides(
  corpus: NoteCorpusItem[],
  nodeIds: string[],
  edges: NoteGraphEdge[]
): ClusterSide[] | undefined {
  const idSet = new Set(nodeIds);
  const oppEdges = edges.filter(
    (e) =>
      e.kind === "opposing" &&
      idSet.has(e.source) &&
      idSet.has(e.target)
  );
  if (oppEdges.length === 0) return undefined;

  const side = new Map<string, 0 | 1>();
  const seed = oppEdges[0];
  side.set(seed.source, 0);
  side.set(seed.target, 1);

  const similarInCluster = edges.filter(
    (e) =>
      e.kind === "similar" &&
      idSet.has(e.source) &&
      idSet.has(e.target)
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of similarInCluster) {
      const s = side.get(e.source);
      const t = side.get(e.target);
      if (s != null && t == null) {
        side.set(e.target, s);
        changed = true;
      } else if (t != null && s == null) {
        side.set(e.source, t);
        changed = true;
      }
    }
  }

  const side0: string[] = [];
  const side1: string[] = [];
  const neutral: string[] = [];

  for (const id of nodeIds) {
    const s = side.get(id);
    if (s === 0) side0.push(id);
    else if (s === 1) side1.push(id);
    else neutral.push(id);
  }

  if (side0.length === 0 || side1.length === 0) return undefined;

  const itemMap = new Map(corpus.map((c) => [c.id, c]));
  const labelFor = (ids: string[]) => {
    const text = ids
      .map((id) => itemMap.get(id)?.text.slice(0, 16) ?? "")
      .filter(Boolean)
      .join(" / ");
    return text.slice(0, 24) || "一派观点";
  };

  const sides: ClusterSide[] = [
    { label: labelFor(side0), nodeIds: [...side0, ...neutral.filter((_, i) => i % 2 === 0)] },
    { label: labelFor(side1), nodeIds: [...side1, ...neutral.filter((_, i) => i % 2 === 1)] },
  ];
  return sides;
}

/** 从边集构建多笔记观点群（连通分量） */
export function buildLocalClusters(
  corpus: NoteCorpusItem[],
  edges: NoteGraphEdge[]
): InsightCluster[] {
  if (corpus.length === 0) return [];

  const adj = new Map<string, Set<string>>();
  const addAdj = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const e of edges) {
    addAdj(e.source, e.target);
    addAdj(e.target, e.source);
  }

  const visited = new Set<string>();
  const clusters: InsightCluster[] = [];
  let idx = 0;

  for (const item of corpus) {
    if (visited.has(item.id) || !adj.has(item.id)) continue;

    const queue = [item.id];
    const component: string[] = [];
    visited.add(item.id);

    while (queue.length) {
      const cur = queue.pop()!;
      component.push(cur);
      adj.get(cur)?.forEach((nb) => {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      });
    }

    if (component.length < 2) continue;

    const compSet = new Set(component);
    const compEdges = edges.filter(
      (e) => compSet.has(e.source) && compSet.has(e.target)
    );
    const hasOpp = compEdges.some((e) => e.kind === "opposing");
    const theme = topThemeForNodes(corpus, component);

    clusters.push({
      id: `local-${idx++}`,
      kind: hasOpp ? "debate" : "resonance",
      theme,
      nodeIds: component,
      sides: hasOpp
        ? partitionDebateSides(corpus, component, compEdges)
        : undefined,
      source: "local",
    });
  }

  clusters.sort((a, b) => b.nodeIds.length - a.nodeIds.length);
  return clusters;
}

export function buildInsightGraph(corpus: NoteCorpusItem[]): InsightGraph {
  const edges = buildAllEdges(corpus);
  const clusters = buildLocalClusters(corpus, edges);

  const clusterOf = new Map<string, string>();
  clusters.forEach((c) => {
    c.nodeIds.forEach((id) => clusterOf.set(id, c.id));
  });

  const degree = new Map<string, number>();
  edges.forEach((e) => {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  });

  const nodes: NoteGraphNode[] = corpus.map((c) => ({
    ...c,
    clusterId: clusterOf.get(c.id),
    degree: degree.get(c.id) ?? 0,
  }));

  return { nodes, edges, clusters };
}

export function nodeLabel(text: string, max = 14): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** 合并 AI 返回的聚类结果 */
export function mergeAiClusters(
  graph: InsightGraph,
  aiClusters: {
    theme?: string;
    kind?: string;
    summary?: string;
    noteIds?: string[];
    sides?: ClusterSide[];
  }[]
): InsightGraph {
  const validIds = new Set(graph.nodes.map((n) => n.id));
  const clusters: InsightCluster[] = [];

  aiClusters.forEach((c, i) => {
    const nodeIds = (c.noteIds ?? []).filter((id) => validIds.has(id));
    if (nodeIds.length < 2) return;
    clusters.push({
      id: `ai-${i}`,
      kind: c.kind === "debate" ? "debate" : "resonance",
      theme: c.theme || "AI 观点群",
      summary: c.summary,
      nodeIds,
      sides: c.sides,
      source: "ai",
    });
  });

  if (clusters.length === 0) return graph;

  const clusterOf = new Map<string, string>();
  clusters.forEach((c) => {
    c.nodeIds.forEach((id) => clusterOf.set(id, c.id));
  });

  const nodes = graph.nodes.map((n) => ({
    ...n,
    clusterId: clusterOf.get(n.id) ?? n.clusterId,
  }));

  return { ...graph, nodes, clusters: [...clusters, ...graph.clusters] };
}

export interface BookOverviewNode {
  id: string;
  title: string;
  noteCount: number;
}

export interface BookOverviewEdge {
  source: string;
  target: string;
  weight: number;
  similar: number;
  opposing: number;
}

export interface BookOverviewGraph {
  nodes: BookOverviewNode[];
  edges: BookOverviewEdge[];
}

/** 书籍层级总览：用倒排索引快速计算跨书关联强度（支持全量语料） */
export function buildBookOverview(corpus: NoteCorpusItem[]): BookOverviewGraph {
  const byBook = new Map<string, { title: string; items: NoteCorpusItem[] }>();
  for (const item of corpus) {
    const g = byBook.get(item.bookId) ?? {
      title: item.bookTitle,
      items: [],
    };
    g.items.push(item);
    byBook.set(item.bookId, g);
  }

  const nodes: BookOverviewNode[] = [];
  byBook.forEach((g, id) => {
    nodes.push({ id, title: g.title, noteCount: g.items.length });
  });

  const bookIds = nodes.map((n) => n.id);
  const pairScore = new Map<string, { sim: number; opp: number }>();

  const bump = (a: string, b: string, kind: InsightKind) => {
    if (a === b) return;
    const key = [a, b].sort().join("|");
    const cur = pairScore.get(key) ?? { sim: 0, opp: 0 };
    if (kind === "similar") cur.sim++;
    else cur.opp++;
    pairScore.set(key, cur);
  };

  // 倒排：token -> bookIds
  const inverted = new Map<string, Set<string>>();
  const bookTokens = new Map<string, Map<string, number>>();

  for (const item of corpus) {
    const tokens = tokenize(item.text);
    const tf = bookTokens.get(item.bookId) ?? new Map<string, number>();
    tokens.forEach((t) => {
      tf.set(t, (tf.get(t) ?? 0) + 1);
      if (!inverted.has(t)) inverted.set(t, new Set());
      inverted.get(t)!.add(item.bookId);
    });
    bookTokens.set(item.bookId, tf);
  }

  // 共享 token 的书对加分（粗粒度）
  inverted.forEach((books) => {
    const arr = Array.from(books);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        bump(arr[i], arr[j], "similar");
      }
    }
  });

  // 抽样精算跨书 opposing（每对书最多 12×12 对比，避免爆炸）
  for (let i = 0; i < bookIds.length; i++) {
    for (let j = i + 1; j < bookIds.length; j++) {
      const aId = bookIds[i];
      const bId = bookIds[j];
      const aItems = byBook.get(aId)!.items.slice(0, 12);
      const bItems = byBook.get(bId)!.items.slice(0, 12);
      for (const a of aItems) {
        for (const b of bItems) {
          const ta = tokenize(a.text);
          const tb = tokenize(b.text);
          let inter = 0;
          ta.forEach((t) => {
            if (tb.has(t)) inter++;
          });
          if (inter === 0) continue;
          const overlap = inter / (ta.size + tb.size - inter);
          if (isOpposing(a.text, b.text, overlap)) bump(aId, bId, "opposing");
        }
      }
    }
  }

  const edges: BookOverviewEdge[] = [];
  pairScore.forEach((v, key) => {
    const [source, target] = key.split("|");
    const weight = v.sim + v.opp * 1.5;
    if (weight < 2) return;
    edges.push({
      source,
      target,
      weight,
      similar: v.sim,
      opposing: v.opp,
    });
  });

  edges.sort((a, b) => b.weight - a.weight);
  return { nodes, edges: edges.slice(0, 120) };
}

export function filterCorpusByBooks(
  corpus: NoteCorpusItem[],
  bookIds: Set<string>
): NoteCorpusItem[] {
  if (bookIds.size === 0) return corpus;
  return corpus.filter((c) => bookIds.has(c.bookId));
}
