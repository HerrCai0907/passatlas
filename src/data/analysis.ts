import type { Locale } from '../i18n/config';
import type { AnalysisRegistration } from './analysis-registry';

/**
 * 分析层里的「详解」条目：15 个默认管线反复用到的核心分析。
 *
 * 完整的 67 个注册项在 analysis-registry.ts；这里只放值得展开的条目。
 * 每条依赖都对应 pinned LLVM 源码：
 *   llvm/lib/Analysis/*.cpp 的 `Analysis::run` / `getResult<>`
 *   llvm/lib/Transforms/** 的 `getResult<>` / `getCachedResult<>` / `LoopStandardAnalysisResults`
 *
 * `consumers` 用 `PassRegistry.def` 的注册名（例如 `inline`），不是页面 slug（`inliner`）；
 * 分析到分析的依赖填在 `requires`，只有确实会被另一个分析消费时才写进 `consumers`。
 */
export interface AnalysisEntry extends AnalysisRegistration {
  /** 稳定的短 id，也是页面内锚点 `analysis-<id>` 的后半段 */
  id: string;
  /** 卡片上的显示名，如 `DominatorTree` */
  label: string;
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

export const analysisPasses: AnalysisEntry[] = [
  {
    id: 'lcg',
    label: 'LazyCallGraph',
    name: 'lcg',
    analysis: 'LazyCallGraphAnalysis',
    scope: 'module',
    answers: {
      zh: '把模块里的函数和调用边组织成一张可增删的图；CGSCC 的后序行走就是在这张图上从 callee 走到 caller。',
      en: 'Organises the module’s functions and call edges into a graph that can be updated in place; the CGSCC post-order walk moves from callees to callers on it.',
    },
    requires: [],
    consumers: [
      'inline',
      'function-attrs',
      'attributor-cgscc',
      'coro-split',
      'sample-profile',
    ],
    source: 'llvm/lib/Analysis/LazyCallGraph.cpp',
  },
  {
    id: 'profile-summary',
    label: 'ProfileSummaryInfo',
    name: 'profile-summary',
    analysis: 'ProfileSummaryAnalysis',
    scope: 'module',
    answers: {
      zh: '把 profile 汇总成模块级的热度事实：入口计数的分布、冷热阈值。',
      en: 'Summarises the profile into module-level hotness facts: the distribution of entry counts and the hot/cold thresholds.',
    },
    requires: [],
    consumers: ['inline', 'partial-inliner', 'sample-profile', 'hotcoldsplit'],
    source: 'llvm/lib/Analysis/ProfileSummaryInfo.cpp',
  },
  {
    id: 'assumptions',
    label: 'AssumptionCache',
    name: 'assumptions',
    analysis: 'AssumptionAnalysis',
    scope: 'function',
    answers: {
      zh: '收集函数里 llvm.assume 声明的条件，让化简可以安全地利用它们。',
      en: 'Collects the conditions declared by llvm.assume in a function so simplification can use them safely.',
    },
    requires: [],
    consumers: [
      'instcombine',
      'inline',
      'mem2reg',
      'gvn',
      'licm',
      'sccp',
      'loop-unroll',
      'loop-reduce',
      'loop-vectorize',
    ],
    source: 'llvm/lib/Analysis/AssumptionCache.cpp',
  },
  {
    id: 'domtree',
    label: 'DominatorTree',
    name: 'domtree',
    analysis: 'DominatorTreeAnalysis',
    scope: 'function',
    answers: {
      zh: '为每个基本块算出支配者与支配树，回答「从 entry 到这块是否必经某点」。',
      en: 'Computes the dominator tree, answering whether every path from entry to a block must pass through a given point.',
    },
    requires: [],
    consumers: [
      'mem2reg',
      'instcombine',
      'gvn',
      'licm',
      'sccp',
      'jump-threading',
      'dse',
      'loop-reduce',
      'loop-vectorize',
    ],
    source: 'llvm/lib/IR/Dominators.cpp',
  },
  {
    id: 'postdomtree',
    label: 'PostDominatorTree',
    name: 'postdomtree',
    analysis: 'PostDominatorTreeAnalysis',
    scope: 'function',
    answers: {
      zh: '反向的支配关系：从某个点出发，哪些路径一定会走到出口。',
      en: 'The reverse dominance relation: from a point, which paths must reach the exit.',
    },
    requires: [],
    consumers: ['dse', 'memcpyopt', 'bpi'],
    source: 'llvm/lib/Analysis/PostDominators.cpp',
  },
  {
    id: 'tli',
    label: 'TargetLibraryInfo',
    name: 'target-lib-info',
    analysis: 'TargetLibraryAnalysis',
    scope: 'function',
    answers: {
      zh: '目标平台上的 libc 函数长什么样、有哪些属性，决定能否把调用换掉。',
      en: 'Describes the libc functions available on the target and their attributes, deciding whether a call can be replaced.',
    },
    requires: [],
    consumers: [
      'instcombine',
      'loop-idiom',
      'loop-vectorize',
      'loop-reduce',
      'gvn',
      'dse',
      'memcpyopt',
    ],
    source: 'llvm/lib/Analysis/TargetLibraryInfo.cpp',
  },
  {
    id: 'tti',
    label: 'TargetTransformInfo',
    name: 'target-ir',
    analysis: 'TargetIRAnalysis',
    scope: 'function',
    answers: {
      zh: '把寄存器宽度、指令代价、向量宽度这些目标事实交给 pass，用作决策的成本模型。',
      en: 'Hands passes target facts such as register width, instruction cost and vector width as the cost model for decisions.',
    },
    requires: [],
    consumers: [
      'instcombine',
      'inline',
      'loop-vectorize',
      'slp-vectorizer',
      'loop-unroll',
      'loop-reduce',
    ],
    source: 'llvm/lib/Analysis/TargetTransformInfo.cpp',
  },
  {
    id: 'loops',
    label: 'LoopInfo',
    name: 'loops',
    analysis: 'LoopAnalysis',
    scope: 'function',
    answers: {
      zh: '把 CFG 归纳成循环森林：每个循环的头、latch、父子关系与出口。',
      en: 'Folds the CFG into a loop forest: each loop’s header, latch, parent-child relation and exits.',
    },
    requires: ['domtree'],
    consumers: [
      'gvn',
      'licm',
      'indvars',
      'loop-idiom',
      'loop-unroll',
      'loop-reduce',
      'loop-vectorize',
    ],
    source: 'llvm/lib/Analysis/LoopInfo.cpp',
  },
  {
    id: 'aa',
    label: 'AliasAnalysis',
    name: 'aa',
    analysis: 'AAManager → AAResults',
    scope: 'function',
    answers: {
      zh: '回答两个指针是否可能指向同一块内存；默认叠加 BasicAA、ScopedNoAliasAA、TypeBasedAA，并可选查询 GlobalsAA。',
      en: 'Answers whether two pointers may refer to the same memory; AAManager combines BasicAA, ScopedNoAliasAA and TypeBasedAA, and can query GlobalsAA.',
    },
    requires: ['tli'],
    consumers: [
      'instcombine',
      'inline',
      'function-attrs',
      'gvn',
      'licm',
      'dse',
      'memcpyopt',
      'slp-vectorizer',
      'loop-idiom',
    ],
    source: 'llvm/lib/Analysis/AliasAnalysis.cpp',
  },
  {
    id: 'bpi',
    label: 'BranchProbabilityInfo',
    name: 'branch-prob',
    analysis: 'BranchProbabilityAnalysis',
    scope: 'function',
    answers: {
      zh: '给每条 CFG 边估一个概率，来源是 branch_weights 与一组启发式；大多数 pass 通过 BFI 间接使用它。',
      en: 'Estimates a probability for every CFG edge from branch_weights and heuristics; most passes use it through BFI.',
    },
    requires: ['loops', 'tli', 'domtree', 'postdomtree'],
    consumers: ['bfi'],
    source: 'llvm/lib/Analysis/BranchProbabilityInfo.cpp',
  },
  {
    id: 'scev',
    label: 'ScalarEvolution',
    name: 'scalar-evolution',
    analysis: 'ScalarEvolutionAnalysis',
    scope: 'function',
    answers: {
      zh: '把循环里的值写成 SCEV 表达式，并给出 trip count；循环优化据此判断步长与迭代次数。',
      en: 'Writes loop values as SCEV expressions and derives trip counts; loop optimisations use it to reason about steps and iteration counts.',
    },
    requires: ['assumptions', 'domtree', 'loops', 'tli'],
    consumers: [
      'licm',
      'indvars',
      'loop-idiom',
      'loop-unroll',
      'loop-reduce',
      'loop-vectorize',
      'slp-vectorizer',
    ],
    source: 'llvm/lib/Analysis/ScalarEvolution.cpp',
  },
  {
    id: 'memoryssa',
    label: 'MemorySSA',
    name: 'memoryssa',
    analysis: 'MemorySSAAnalysis',
    scope: 'function',
    answers: {
      zh: '给内存操作建立 SSA：每次读看到的是哪一次写，以及跨块的 MemoryPhi。',
      en: 'Builds SSA for memory: which write each read sees, plus MemoryPhi across blocks.',
    },
    requires: ['domtree', 'aa'],
    consumers: ['licm', 'indvars', 'gvn', 'dse', 'memcpyopt', 'loop-idiom', 'loop-reduce'],
    source: 'llvm/lib/Analysis/MemorySSA.cpp',
  },
  {
    id: 'bfi',
    label: 'BlockFrequencyInfo',
    name: 'block-freq',
    analysis: 'BlockFrequencyAnalysis',
    scope: 'function',
    answers: {
      zh: '沿 CFG 把边概率传播成每个基本块的执行频率，是冷热判断的共同输入。',
      en: 'Propagates edge probabilities along the CFG into a per-block execution frequency, the shared input for hot/cold decisions.',
    },
    requires: ['bpi', 'loops'],
    consumers: [
      'instcombine',
      'inline',
      'partial-inliner',
      'loop-unroll',
      'loop-vectorize',
      'hotcoldsplit',
    ],
    source: 'llvm/lib/Analysis/BlockFrequencyInfo.cpp',
  },
  {
    id: 'access-info',
    label: 'LoopAccessAnalysis',
    name: 'access-info',
    analysis: 'LoopAccessAnalysis',
    scope: 'function',
    answers: {
      zh: '对每个循环检查访存依赖，给出能否向量化、需要哪些运行时检查；注册为函数分析，内部再按循环缓存。',
      en: 'Checks the memory dependencies of each loop and reports whether it can be vectorised and which runtime checks are needed; registered as a function analysis that caches per loop.',
    },
    requires: ['assumptions', 'domtree', 'loops', 'aa', 'tli', 'tti', 'scev'],
    consumers: ['loop-vectorize', 'loop-load-elim'],
    source: 'llvm/lib/Analysis/LoopAccessAnalysis.cpp',
  },
  {
    id: 'iv-users',
    label: 'IVUsers',
    name: 'iv-users',
    analysis: 'IVUsersAnalysis',
    scope: 'loop',
    answers: {
      zh: '收集循环里所有依赖归纳变量的使用点，供 strength reduction 选择重写方案。',
      en: 'Collects every use that depends on an induction variable, giving strength reduction the candidates to rewrite.',
    },
    requires: ['assumptions', 'domtree', 'loops', 'scev'],
    consumers: ['loop-reduce'],
    source: 'llvm/lib/Analysis/IVUsers.cpp',
  },
];
