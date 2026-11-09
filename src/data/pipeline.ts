import type { Locale } from '../i18n/config';
import type { CategoryId } from '../lib/categories';

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
   * pass 的注册名，同时也是内容目录里的 slug。
   * 如果 src/content/passes/<locale>/<name>.mdx 存在，图上会自动变成链接；
   * 不存在就渲染成灰色、不可点的「待绘制」节点。
   */
  name: string;
  category: CategoryId;
  /** 页面 slug 与 name 不同时显式指定 */
  page?: string;
  /** 图上显示的名字，默认使用 name（例如 InlineFunction、ISel） */
  label?: string;
  /** helper 不是独立 pass，而是另一个 pass 内部的步骤 */
  kind?: 'pass' | 'helper';
  /** 同一个 pass 在管线里会出现多次 */
  repeat?: boolean;
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

/**
 * 一张示意图，不是 -O2 的逐条复刻：
 * 只保留主干上的代表 pass，省略 PGO、coroutine、target-specific 的部分。
 * 有同名页面时自动链接，所以新增一篇页面后不需要改这张表。
 */
export const pipelineStages: PipelineStage[] = [
  {
    id: 'module',
    level: 'module',
    manager: 'ModulePassManager',
    title: { zh: '模块入口', en: 'Module entry' },
    note: {
      zh: '先看整个模块：样本 profile、跨过程常量传播、全局变量折叠，以及哪些全局对象可以删掉。',
      en: 'Start at module scope: sample profiles, interprocedural constant propagation, global folding, and which globals can be removed.',
    },
    passes: [
      { name: 'sample-profile', page: 'sample-profile-inline', category: 'interproc' },
      { name: 'ipsccp', category: 'interproc' },
      { name: 'globalopt', category: 'interproc' },
      { name: 'globaldce', category: 'interproc' },
    ],
  },
  {
    id: 'cgscc',
    level: 'cgscc',
    manager: 'CGSCCPassManager',
    adaptor: 'ModuleToPostOrderCGSCCPassAdaptor',
    title: { zh: 'CGSCC 内联', en: 'CGSCC inlining' },
    note: {
      zh: '调用图先缩成 SCC，再按后序从 callee 走到 caller；内联决策和真正的克隆都在这一层。',
      en: 'The call graph is collapsed into SCCs and walked post-order, callees before callers; both the inline decision and the cloning live here.',
    },
    passes: [
      { name: 'inliner', category: 'interproc' },
      {
        name: 'inline-function',
        label: 'InlineFunction',
        category: 'interproc',
        kind: 'helper',
      },
      { name: 'argpromotion', category: 'interproc' },
    ],
  },
  {
    id: 'function-early',
    level: 'function',
    manager: 'FunctionPassManager',
    adaptor: 'CGSCCToFunctionPassAdaptor',
    title: { zh: '函数化简 · 前段', en: 'Function simplification · early' },
    note: {
      zh: '先把聚合体和内存拆成 SSA 值，再做局部化简；instcombine 在这一层反复运行。',
      en: 'Break aggregates and memory into SSA values, then simplify locally; instcombine runs repeatedly at this level.',
    },
    passes: [
      { name: 'sroa', category: 'dataflow' },
      { name: 'mem2reg', category: 'dataflow' },
      { name: 'early-cse', category: 'scalar' },
      { name: 'instcombine', category: 'scalar', repeat: true },
      { name: 'simplifycfg', category: 'scalar' },
    ],
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
    passes: [
      { name: 'loop-simplify', category: 'loop' },
      { name: 'loop-rotate', category: 'loop' },
      { name: 'licm', category: 'loop' },
      { name: 'indvars', category: 'loop' },
      { name: 'loop-unroll', category: 'loop' },
    ],
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
    passes: [
      { name: 'loop-vectorize', category: 'vectorize' },
      { name: 'slp-vectorizer', category: 'vectorize' },
      { name: 'vector-combine', category: 'vectorize' },
    ],
  },
  {
    id: 'function-late',
    level: 'function',
    manager: 'FunctionPassManager',
    title: { zh: '函数清理 · 后段', en: 'Function cleanup · late' },
    note: {
      zh: '向量化会留下新的控制流与冗余，最后用 GVN、SCCP 和 DCE / ADCE 收一遍。',
      en: 'Vectorisation leaves new control flow and redundancy; GVN, SCCP and DCE / ADCE clean up afterwards.',
    },
    passes: [
      { name: 'gvn', category: 'scalar' },
      { name: 'sccp', category: 'scalar' },
      { name: 'dce', category: 'scalar' },
      { name: 'adce', category: 'scalar' },
    ],
  },
  {
    id: 'codegen',
    level: 'codegen',
    manager: 'Legacy PassManager · Machine IR',
    entry: { zh: 'IR → Machine IR', en: 'IR → Machine IR' },
    title: { zh: '代码生成', en: 'Code generation' },
    note: {
      zh: 'IR 优化到此为止：SelectionDAG 负责指令选择，之后是 Machine IR 上的调度与寄存器分配。',
      en: 'IR optimisation ends here: SelectionDAG selects instructions, then machine passes schedule and allocate registers.',
    },
    passes: [
      { name: 'codegenprepare', label: 'CodeGenPrepare', category: 'codegen' },
      { name: 'isel', label: 'ISel', category: 'codegen' },
    ],
  },
];

/** 图上所有节点，供首页统计「还有多少篇没画」。 */
export const pipelinePasses: PipelinePass[] = pipelineStages.flatMap(
  (stage) => stage.passes,
);
