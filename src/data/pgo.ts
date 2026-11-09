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

/** 图鉴里的 IR PGO 分组：一个插桩 pass + 五个采样点。 */
export const pgoGroup = {
  short: { zh: 'IR PGO', en: 'IR PGO' },
  title: { zh: 'IR PGO', en: 'IR PGO' },
  en: 'Profile-guided optimization',
  description: {
    zh: '先由 pgo-instr-gen 插入计数器与值采样，跑完合并成 profile，再由 pgo-instr-use 读回。下面五页按采样点拆开，并指回消费它们的 pass。',
    en: 'pgo-instr-gen inserts counters and value sites, a run turns them into a profile, and pgo-instr-use reads it back. The five pages below split the sites apart and point back to the passes that consume them.',
  },
  sitesLabel: { zh: '五个采样点', en: 'Five sampling points' },
  leadKicker: { zh: '插桩 pass', en: 'Instrumentation pass' },
};
