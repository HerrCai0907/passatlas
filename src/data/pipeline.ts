import type { Locale } from '../i18n/config';

/**
 * LLVM 管线的层级。新版 pass manager 的 IR 层级是
 * Module ->（CGSCC ->）Function -> Loop，代码生成则切到 Machine IR。
 */
export type PipelineLevel =
  | 'module'
  | 'cgscc'
  | 'function'
  | 'loop'
  | 'vectorize'
  | 'codegen';

export interface PipelinePass {
  /**
   * pass 的注册名（`opt -passes=` 里的名字），也是内容目录里默认的 slug。
   * 注册名和页面 slug 不同时用 page 显式指定。
   */
  name: string;
  /** 页面 slug 与 name 不同时显式指定（如 inline → inliner） */
  page?: string;
  /** 图上显示的名字，默认使用 name（例如 InlineFunction、ISel） */
  label?: string;
  /** helper 不是独立 pass，而是另一个 pass 内部的步骤 */
  kind?: 'pass' | 'helper';
  /** 同一个 pass 在管线里会出现多次 */
  repeat?: boolean;
  /** 只在特定优化级别、PGO 或 target 条件下启用 */
  conditional?: boolean;
}

export interface PipelineStage {
  id: string;
  level: PipelineLevel;
  /** 承载这一层 pass 的 manager */
  manager: string;
  /** 从上一层进入本层时用的 adaptor */
  adaptor?: string;
  /** 没有 adaptor 时，连接线上显示的说明 */
  entry?: Record<Locale, string>;
  title: Record<Locale, string>;
  note: Record<Locale, string>;
  passes: PipelinePass[];
}

/** 字符串就是普通 pass；对象用于 helper / 重复 / 条件启用 / 换页面 slug 的情况。 */
function list(...items: Array<string | PipelinePass>): PipelinePass[] {
  return items.map((item) => (typeof item === 'string' ? { name: item } : item));
}

/**
 * 默认优化管线的主干，按 PassManager 的层级与大致执行顺序整理。
 * 这不是 -O2 的逐条复刻：条件启用的 pass 用 * 标出，完整注册表在
 * pass-registry.ts 里；新增一篇页面后，同名节点会自动变成链接。
 */
export const pipelineStages: PipelineStage[] = [
  {
    id: 'module-early',
    level: 'module',
    manager: 'ModulePassManager',
    title: { zh: '模块入口', en: 'Module entry' },
    note: {
      zh: '模块级 pass 贯穿管线前半段：先读 profile、函数属性和全局，再决定哪些全局对象可以删掉。',
      en: 'Module passes run throughout the first half: read the profile, infer function attributes and globals, then decide which globals can go away.',
    },
    passes: list(
      'annotation2metadata',
      'forceattrs',
      'inferattrs',
      'coro-early',
      'openmp-opt',
      'ipsccp',
      'called-value-propagation',
      { name: 'globalopt', repeat: true },
      { name: 'sample-profile', page: 'sample-profile-inline', conditional: true },
      { name: 'pgo-instr-gen', conditional: true },
      'always-inline',
    ),
  },
  {
    id: 'cgscc',
    level: 'cgscc',
    manager: 'CGSCCPassManager',
    adaptor: 'ModuleToPostOrderCGSCCPassAdaptor',
    title: { zh: 'CGSCC 内联', en: 'CGSCC inlining' },
    note: {
      zh: '调用图先缩成 SCC，再按后序从 callee 走到 caller；内联决策和真正的克隆都在这一层，函数化简嵌在 CGSCC 遍历里。',
      en: 'The call graph is collapsed into SCCs and walked post-order, callees before callers; decisions and cloning live here, with function simplification nested inside the walk.',
    },
    passes: list(
      { name: 'inline', page: 'inliner', label: 'inliner' },
      { name: 'inline-function', label: 'InlineFunction', kind: 'helper' },
      'function-attrs',
      { name: 'argpromotion', conditional: true },
      'openmp-opt-cgscc',
      { name: 'attributor-cgscc', conditional: true },
      'coro-split',
      'coro-annotation-elide',
    ),
  },
  {
    id: 'function-early',
    level: 'function',
    manager: 'FunctionPassManager',
    adaptor: 'CGSCCToFunctionPassAdaptor',
    title: { zh: '函数化简 · 前段', en: 'Function simplification · early' },
    note: {
      zh: '先把聚合体和内存拆成 SSA 值，再做局部化简；instcombine、simplifycfg、jump-threading 会在多个位置反复运行。',
      en: 'Break aggregates and memory into SSA values, then simplify locally; instcombine, simplifycfg and jump-threading run repeatedly at several points.',
    },
    passes: list(
      { name: 'ee-instrument', conditional: true },
      'lower-expect',
      { name: 'simplifycfg', repeat: true },
      { name: 'sroa', repeat: true },
      'early-cse',
      'mem2reg',
      { name: 'instcombine', repeat: true },
      'speculative-execution',
      { name: 'jump-threading', repeat: true },
      { name: 'correlated-propagation', repeat: true },
      { name: 'jump-table-to-switch', conditional: true },
      'aggressive-instcombine',
      'libcalls-shrinkwrap',
      'tailcallelim',
      'reassociate',
      { name: 'constraint-elimination', conditional: true },
      { name: 'callsite-splitting', conditional: true },
      { name: 'assume-simplify', conditional: true },
      { name: 'gvn-hoist', conditional: true },
      { name: 'gvn-sink', conditional: true },
      { name: 'dfa-jump-threading', conditional: true },
      'loop-simplify',
    ),
  },
  {
    id: 'loop',
    level: 'loop',
    manager: 'LoopPassManager',
    adaptor: 'FunctionToLoopPassAdaptor',
    title: { zh: '循环优化', en: 'Loop optimisation' },
    note: {
      zh: '每个函数里的每个循环都过一遍：先规范化，再外提不变量、化简归纳变量，最后展开。',
      en: 'Every loop in every function: canonicalise it, hoist invariants, simplify induction variables, then unroll.',
    },
    passes: list(
      'loop-instsimplify',
      'loop-simplifycfg',
      { name: 'licm', repeat: true },
      { name: 'loop-rotate', repeat: true },
      'simple-loop-unswitch',
      'loop-idiom',
      'indvars',
      'loop-deletion',
      'loop-unroll-full',
      { name: 'loop-interchange', conditional: true },
      { name: 'loop-flatten', conditional: true },
      { name: 'loop-versioning-licm', conditional: true },
      { name: 'lnicm', conditional: true },
    ),
  },
  {
    id: 'vectorize',
    level: 'vectorize',
    manager: 'FunctionPassManager',
    entry: {
      zh: 'LoopPassManager 返回函数级',
      en: 'LoopPassManager returns to function level',
    },
    title: { zh: '向量化', en: 'Vectorisation' },
    note: {
      zh: '向量化器仍然是 function pass：LoopVectorize 内部再驱动 loop 与 region，SLP 则横向打包相邻标量。',
      en: 'The vectorisers are still function passes: LoopVectorize drives loop and region passes internally, while SLP packs neighbouring scalars sideways.',
    },
    passes: list(
      'loop-distribute',
      'inject-tli-mappings',
      'loop-vectorize',
      'slp-vectorizer',
      { name: 'vector-combine', repeat: true },
      'loop-load-elim',
      { name: 'loop-unroll', repeat: true },
      { name: 'loop-unroll-and-jam', conditional: true },
      'infer-alignment',
      'alignment-from-assumptions',
      'transform-warning',
      { name: 'loop-fusion', conditional: true },
    ),
  },
  {
    id: 'function-late',
    level: 'function',
    manager: 'FunctionPassManager',
    title: { zh: '函数清理 · 后段', en: 'Function cleanup · late' },
    note: {
      zh: '向量化会留下新的控制流与冗余，最后用 GVN、SCCP、DCE / ADCE 和内存优化收一遍。',
      en: 'Vectorisation leaves new control flow and redundancy; GVN, SCCP, DCE / ADCE and memory passes clean up afterwards.',
    },
    passes: list(
      { name: 'gvn', repeat: true },
      { name: 'newgvn', conditional: true },
      'sccp',
      'bdce',
      { name: 'dce', repeat: true },
      'adce',
      'memcpyopt',
      'dse',
      'move-auto-init',
      'mldst-motion',
      'float2int',
      'lower-constant-intrinsics',
      { name: 'lower-matrix-intrinsics', conditional: true },
      'drop-unnecessary-assumes',
      'instsimplify',
      'div-rem-pairs',
      'mergeicmps',
      'expand-memcmp',
      'loop-sink',
      'coro-elide',
      { name: 'chr', conditional: true },
    ),
  },
  {
    id: 'module-late',
    level: 'module',
    manager: 'ModulePassManager',
    entry: { zh: '回到 ModulePassManager', en: 'back to ModulePassManager' },
    title: { zh: '模块收尾', en: 'Module cleanup' },
    note: {
      zh: '函数优化结束后回到模块级：删死参数、死函数，做 LTO、全局常量合并与 lookup table 收尾。',
      en: 'Back at module scope after function optimisation: remove dead arguments and functions, then LTO, constant merging and lookup-table cleanups.',
    },
    passes: list(
      'deadargelim',
      'coro-cleanup',
      'elim-avail-extern',
      'rpo-function-attrs',
      'recompute-globalsaa',
      { name: 'partial-inliner', conditional: true },
      { name: 'hotcoldsplit', conditional: true },
      'constmerge',
      { name: 'mergefunc', conditional: true },
      'rel-lookup-table-converter',
      { name: 'cg-profile', conditional: true },
      'wholeprogramdevirt',
      'globalsplit',
      'lower-comment-string',
      { name: 'alloc-token', conditional: true },
      { name: 'globaldce', repeat: true },
    ),
  },
  {
    id: 'codegen',
    level: 'codegen',
    manager: 'Legacy PassManager · Machine IR',
    entry: { zh: 'IR → Machine IR', en: 'IR → Machine IR' },
    title: { zh: '代码生成', en: 'Code generation' },
    note: {
      zh: 'IR 优化到此为止：CodeGenPrepare 之后由 SelectionDAG 负责指令选择，再进入 Machine IR 的调度与寄存器分配。',
      en: 'IR optimisation ends here: after CodeGenPrepare, SelectionDAG selects instructions, then machine passes schedule and allocate registers.',
    },
    passes: list(
      'codegenprepare',
      'isel',
      'machine-scheduler',
      'regalloc',
    ),
  },
];

/** 图上所有节点，供首页统计「还有多少篇没画」。 */
export const pipelinePasses: PipelinePass[] = pipelineStages.flatMap(
  (stage) => stage.passes,
);
