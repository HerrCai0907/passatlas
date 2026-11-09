import type { Locale } from '../i18n/config';

/**
 * IR PGO 采样点的结构化事实。
 *
 * 正文在 src/content/pgo/<locale>/<id>.mdx，这里只放每一页都会重复出现的
 * 「采样什么 / 写成什么 / 喂给谁」，以及总览页的流水线与对照表。
 * 文案按语言分开，标识符、flag 和元数据键保持英文。
 */
export type PgoSiteId =
  | 'function-entry'
  | 'basic-block'
  | 'indirect-call'
  | 'memop-size'
  | 'vtable';

export type PgoSiteKind = 'counter' | 'value';

export interface PgoPageLink {
  href: string;
  label: string;
}

export interface PgoSiteMeta {
  id: PgoSiteId;
  kind: PgoSiteKind;
  /** 采样点由哪个 IR 入口插入：increment 或 value.profile */
  symbol: string;
  /** 第二次编译写进 IR 的元数据键或 value kind */
  record: string;
  /** 一行：它在运行时观察什么 */
  samples: Record<Locale, string>;
  /** 一行：profile use 把它变成什么 */
  writes: Record<Locale, string>;
  /** 一行：哪些优化会消费它 */
  feeds: Record<Locale, string>;
  /** 已收录的 pass 页面，详情页底部展示 */
  pages?: PgoPageLink[];
  source: string;
  /** 仍在实验阶段、默认关闭的采样点 */
  experimental?: boolean;
}

export const pgoSites: PgoSiteMeta[] = [
  {
    id: 'function-entry',
    kind: 'counter',
    symbol: 'llvm.instrprof.increment',
    record: 'function_entry_count',
    samples: {
      zh: '控制流进入函数体的次数，也就是这个函数被执行了多少次。',
      en: 'How many times control enters the function body — the function execution count.',
    },
    writes: {
      zh: '函数上的 !prof !{!"function_entry_count", i64 N}。',
      en: '!prof !{!"function_entry_count", i64 N} on the function.',
    },
    feeds: {
      zh: '冷热判定、内联、冷函数优化与代码布局。',
      en: 'Hot/cold decisions, inlining, cold-function optimisation and code layout.',
    },
    pages: [{ href: '/passes/inliner/', label: 'inliner' }],
    source: 'llvm/lib/Transforms/Instrumentation/PGOInstrumentation.cpp',
  },
  {
    id: 'basic-block',
    kind: 'counter',
    symbol: 'llvm.instrprof.increment',
    record: 'branch_weights',
    samples: {
      zh: 'MST 选出的 CFG 边，以及每个 select 条件为真的次数；不是每个基本块都插计数器。',
      en: 'The CFG edges chosen by the MST, plus each select’s true count — not every block gets a counter.',
    },
    writes: {
      zh: '分支、switch、select 与 call 上的 !prof !{!"branch_weights", ...}。',
      en: '!prof !{!"branch_weights", ...} on branches, switches, selects and calls.',
    },
    feeds: {
      zh: 'BranchProbabilityInfo / BlockFrequencyInfo：内联、循环优化、块布局。',
      en: 'BranchProbabilityInfo / BlockFrequencyInfo: inlining, loop transforms, block layout.',
    },
    pages: [{ href: '/passes/inliner/', label: 'inliner' }],
    source: 'llvm/lib/Transforms/Instrumentation/PGOInstrumentation.cpp',
  },
  {
    id: 'indirect-call',
    kind: 'value',
    symbol: 'llvm.instrprof.value.profile',
    record: 'VP · i32 0',
    samples: {
      zh: '每个间接调用点实际落到的函数地址；profile reader 再把它换成函数名的 64 位 hash。',
      en: 'The actual function address taken at each indirect call site; the profile reader turns it into a 64-bit hash of the function name.',
    },
    writes: {
      zh: '间接调用上的 !prof !{!"VP", i32 0, total, hash, count, ...}。',
      en: '!prof !{!"VP", i32 0, total, hash, count, ...} on the indirect call.',
    },
    feeds: {
      zh: 'PGOIndirectCallPromotion：条件直调、去虚化、随后内联。',
      en: 'PGOIndirectCallPromotion: guarded direct calls, devirtualisation and later inlining.',
    },
    pages: [
      { href: '/passes/inliner/', label: 'inliner' },
      { href: '/passes/sample-profile-inline/', label: 'sample-profile-inline' },
    ],
    source: 'llvm/lib/Transforms/Instrumentation/IndirectCallPromotion.cpp',
  },
  {
    id: 'memop-size',
    kind: 'value',
    symbol: 'llvm.instrprof.value.profile',
    record: 'VP · i32 1',
    samples: {
      zh: '变长 memcpy / memset / memcmp / bcmp 的长度；常量长度不插桩。',
      en: 'The length of variable-sized memcpy / memset / memcmp / bcmp; constant lengths are not instrumented.',
    },
    writes: {
      zh: '内存操作调用上的 !prof !{!"VP", i32 1, total, size, count, ...}。',
      en: '!prof !{!"VP", i32 1, total, size, count, ...} on the memory operation.',
    },
    feeds: {
      zh: 'PGOMemOPSizeOpt：按长度做 switch 特化，再把小拷贝展开成加载/存储。',
      en: 'PGOMemOPSizeOpt: size-specialise into a switch, then expand small copies into loads and stores.',
    },
    source: 'llvm/lib/Transforms/Instrumentation/PGOMemOPSizeOpt.cpp',
  },
  {
    id: 'vtable',
    kind: 'value',
    symbol: 'llvm.instrprof.value.profile',
    record: 'VP · i32 2',
    samples: {
      zh: '虚调用前加载的 vtable 地址点；只在 ELF、显式打开 vtable 值采样时启用。',
      en: 'The vtable address point loaded before a virtual call; only on ELF with vtable value profiling explicitly enabled.',
    },
    writes: {
      zh: 'vptr 加载指令上的 !prof !{!"VP", i32 2, total, vtable-guid, count, ...}。',
      en: '!prof !{!"VP", i32 2, total, vtable-guid, count, ...} on the vptr load.',
    },
    feeds: {
      zh: '带 vtable 比较的 ICP：少一次函数指针加载，直接比较 vptr，再决定是否去虚化。',
      en: 'ICP with vtable comparisons: skip one function-pointer load, compare the vptr, then decide whether to devirtualise.',
    },
    pages: [{ href: '/passes/inliner/', label: 'inliner' }],
    source: 'llvm/lib/Transforms/Instrumentation/IndirectCallPromotion.cpp',
    experimental: true,
  },
];

export function pgoSite(id: string): PgoSiteMeta | undefined {
  return pgoSites.find((site) => site.id === id);
}

export interface PgoFlowStep {
  no: string;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
  code: string;
}

/** 总览页的流水线：采集 → 运行 → 合并 → 标注 → 消费。 */
export const pgoFlow: PgoFlowStep[] = [
  {
    no: '01',
    title: { zh: '插桩', en: 'Instrument' },
    body: {
      zh: 'PGOInstrumentationGen 在 IR 里插入计数器与值采样，InstrProfiling 再把它降低成 __profc_* / __profd_*。',
      en: 'PGOInstrumentationGen inserts counters and value sites into the IR; InstrProfiling lowers them to __profc_* / __profd_*.',
    },
    code: 'clang -fprofile-generate',
  },
  {
    no: '02',
    title: { zh: '运行', en: 'Run' },
    body: {
      zh: '程序正常跑一遍负载。每次执行累加计数器，值采样把目标地址或长度写进 value 区，退出时落成 *.profraw。',
      en: 'Run the workload. Counters increment, value sites record addresses or lengths, and the runtime writes *.profraw on exit.',
    },
    code: './app',
  },
  {
    no: '03',
    title: { zh: '合并', en: 'Merge' },
    body: {
      zh: 'llvm-profdata 合并多次运行的 raw profile，按函数名 hash 与 CFG hash 建索引，写出 *.profdata。',
      en: 'llvm-profdata merges raw profiles from several runs, indexes them by function-name and CFG hashes, and writes *.profdata.',
    },
    code: 'llvm-profdata merge',
  },
  {
    no: '04',
    title: { zh: '标注', en: 'Annotate' },
    body: {
      zh: 'PGOInstrumentationUse 读回计数：函数写 function_entry_count，分支写 branch_weights，值采样点写 VP。',
      en: 'PGOInstrumentationUse reads the counts back: function_entry_count on functions, branch_weights on branches, VP on value sites.',
    },
    code: 'clang -fprofile-use',
  },
  {
    no: '05',
    title: { zh: '消费', en: 'Consume' },
    body: {
      zh: '后面的 pass 只读 !prof 元数据：内联器、ICP、pgo-memop-opt、块布局。它们不直接读 .profdata。',
      en: 'Later passes read only the !prof metadata: the inliner, ICP, pgo-memop-opt, block placement. They never read .profdata directly.',
    },
    code: '!prof',
  },
];

export interface PgoComparisonRow {
  label: Record<Locale, string>;
  ir: Record<Locale, string>;
  sample: Record<Locale, string>;
}

export const pgoComparison: PgoComparisonRow[] = [
  {
    label: { zh: '事实来源', en: 'Source of truth' },
    ir: { zh: 'IR 里的计数器与值采样点', en: 'Counters and value sites in the IR' },
    sample: { zh: '硬件采样器，或 pseudo probe', en: 'Hardware sampler, or pseudo probes' },
  },
  {
    label: { zh: '精度', en: 'Precision' },
    ir: { zh: '精确整数计数；冷路径也有 0', en: 'Exact integer counts, including zero on cold paths' },
    sample: { zh: '统计估计；采样周期决定噪声', en: 'Statistical estimate; the sampling period sets the noise' },
  },
  {
    label: { zh: '运行期开销', en: 'Runtime cost' },
    ir: { zh: '有；计数器读写，循环里还要 counter promotion', en: 'Yes: counter traffic, plus counter promotion in loops' },
    sample: { zh: '接近零；不需要插桩过的二进制', en: 'Near zero; no instrumented binary needed' },
  },
  {
    label: { zh: '构建流程', en: 'Build flow' },
    ir: { zh: 'gen → run → merge → use，至少两遍', en: 'gen → run → merge → use, at least two builds' },
    sample: { zh: '采样 → merge → use；AutoFDO 可直接采生产二进制', en: 'sample → merge → use; AutoFDO can sample a production binary' },
  },
  {
    label: { zh: '最擅长', en: 'Best at' },
    ir: { zh: '分支、调用点、内存长度的精确分布', en: 'Exact distributions for branches, call sites and memory sizes' },
    sample: { zh: '大规模部署、无法重编 instrumented binary 的场景', en: 'Large deployments where an instrumented binary is impractical' },
  },
];
