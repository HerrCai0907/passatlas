import type { Locale } from '../i18n/config';

/**
 * 核心分析（analysis）的数据模型。
 *
 * 这一版先把框架接好：`analysisPasses` 暂时为空。补条目时只加数据，不再改组件——
 * 分析层卡片、管线阶段的「依赖分析」行、pass 详情页的「依赖的分析」都从这张表派生。
 *
 * 每条依赖都应当能在 pinned LLVM 源码里找到：
 *   llvm/lib/Analysis/*.cpp 的 `Analysis::run` / `getResult<>`
 *   llvm/lib/Transforms/** 的 `getResult<>` / `getCachedResult<>` / `LoopStandardAnalysisResults`
 *
 * `consumers` 用 `PassRegistry.def` 的注册名（例如 `inline`），不是页面 slug（`inliner`）；
 * 分析到分析的依赖填在 `requires`，只有确实会被另一个分析消费时才写进 `consumers`。
 */
export type AnalysisScope = 'module' | 'function' | 'loop';

export interface AnalysisEntry {
  /** 稳定的短 id，也是页面内锚点 `analysis-<id>` 的后半段 */
  id: string;
  /** 显示名，如 `DominatorTree` */
  name: string;
  /** C++ 侧的名字，必要时带结果类型，如 `AAManager → AAResults` */
  analysis: string;
  /** `PassRegistry.def` 里的名字，用于 `require<...>`，如 `domtree` */
  handle: string;
  /** 结果挂在哪个 IR 单元上 */
  scope: AnalysisScope;
  /** 一句话：它回答什么问题 */
  answers: Record<Locale, string>;
  /** 分析到分析的依赖，填 `AnalysisEntry.id` */
  requires: string[];
  /** 会向它提问的 pass 注册名，或另一个分析的 id */
  consumers: string[];
  /** 相对 LLVM 仓库根，如 `llvm/lib/IR/Dominators.cpp` */
  source: string;
  /** 将来如果给它单独开页，填内容 slug；现在都还没有 */
  page?: string;
}

/**
 * 暂时留空：先把结构、样式和链接入口搭好，下一批只补数据。
 * 新条目按 scope 分组，并在同组内按依赖深度从基础到派生排列。
 */
export const analysisPasses: AnalysisEntry[] = [];

/** 分析层的范围顺序，和 PassManager 的 IR 层级一致（CGSCC 落在 LazyCallGraph 上，不单列）。 */
export const analysisScopeOrder: AnalysisScope[] = ['module', 'function', 'loop'];

export const analysisScopes: Record<
  AnalysisScope,
  { manager: string; note: Record<Locale, string> }
> = {
  module: {
    manager: 'ModuleAnalysisManager',
    note: {
      zh: '整个模块一份：调用图、profile 摘要这类跨函数事实；CGSCC 的 SCC 行走也建在这里缓存的 LazyCallGraph 上。',
      en: 'One result per module: cross-function facts such as the call graph and profile summary; the CGSCC walk also builds on the LazyCallGraph cached here.',
    },
  },
  function: {
    manager: 'FunctionAnalysisManager',
    note: {
      zh: '每个函数一份：CFG、循环、别名、内存与代价模型都在这一层。',
      en: 'One result per function: CFG structure, loops, alias and memory facts, and the cost model all live here.',
    },
  },
  loop: {
    manager: 'LoopAnalysisManager',
    note: {
      zh: '每个循环一份：结果只在这个循环上有效，换一个循环就要重新取。',
      en: 'One result per loop: it is only valid for that loop, and asking about another loop fetches another result.',
    },
  },
};
