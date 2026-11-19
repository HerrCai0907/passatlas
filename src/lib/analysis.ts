import {
  analysisPasses,
  type AnalysisEntry,
  type AnalysisScope,
} from '../data/analysis.ts';
import { pipelineStages, type PipelineStage } from '../data/pipeline.ts';
import { pipelinePageSlug } from './pipeline.ts';

const byId = new Map(analysisPasses.map((entry) => [entry.id, entry]));
const depthCache = new Map<string, number>();

/** 分析卡片在 /passes 里的锚点；与 pass 的锚点分开，避免撞名。 */
export function analysisAnchor(id: string): string {
  return `analysis-${id}`;
}

/** 分析层里一个 scope 分组的锚点。 */
export function analysisScopeAnchor(scope: AnalysisScope): string {
  return `analysis-${scope}`;
}

export function analysisFor(id: string): AnalysisEntry | undefined {
  return byId.get(id);
}

/** 按数据里的顺序取某个 scope 的分析，保证「基础 → 派生」的可读顺序。 */
export function analysesByScope(scope: AnalysisScope): AnalysisEntry[] {
  return analysisPasses.filter((entry) => entry.scope === scope);
}

/**
 * 依赖深度：0 表示直接读 IR / 目标信息，1 表示基于一个 L0 分析，依此类推。
 * 数据有环或 requires 指向不存在的 id 时在构建期抛错，不做静默降级。
 */
export function analysisDepth(
  entry: AnalysisEntry,
  visiting = new Set<string>(),
): number {
  const cached = depthCache.get(entry.id);
  if (cached !== undefined) return cached;
  if (visiting.has(entry.id)) {
    throw new Error(`Analysis dependency cycle at ${entry.id}`);
  }

  visiting.add(entry.id);
  let depth = 0;
  for (const id of entry.requires) {
    const dependency = analysisFor(id);
    if (!dependency) {
      throw new Error(`Analysis ${entry.id} requires unknown analysis ${id}`);
    }
    depth = Math.max(depth, analysisDepth(dependency, visiting) + 1);
  }
  visiting.delete(entry.id);
  depthCache.set(entry.id, depth);
  return depth;
}

/** 一个 `-passes=` 注册名直接会向哪些分析提问。 */
export function analysesForPipelinePass(name: string): AnalysisEntry[] {
  return analysisPasses.filter((entry) => entry.consumers.includes(name));
}

/**
 * 一个管线阶段里所有 pass 直接依赖的分析，按数据顺序去重。
 * 只算直接消费者，不展开分析的传递依赖——那部分由卡片上的「基于」表达。
 */
export function analysesForStage(stage: PipelineStage): AnalysisEntry[] {
  const names = new Set(stage.passes.map((item) => item.name));
  return analysisPasses.filter((entry) =>
    entry.consumers.some((consumer) => names.has(consumer)),
  );
}

/**
 * 一个 pass 页面依赖的分析。页面 slug 与注册名可能不同（inliner → inline），
 * 所以先经过 `pipelinePageSlug()`，再按注册名匹配。
 */
export function analysesForPassSlug(
  slug: string,
  stages: PipelineStage[] = pipelineStages,
): AnalysisEntry[] {
  const names = new Set<string>();
  for (const stage of stages) {
    for (const item of stage.passes) {
      if (pipelinePageSlug(item) === slug) names.add(item.name);
    }
  }
  if (names.size === 0) return [];
  return analysisPasses.filter((entry) =>
    entry.consumers.some((consumer) => names.has(consumer)),
  );
}
