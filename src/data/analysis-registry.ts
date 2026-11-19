import type { Locale } from '../i18n/config';

/**
 * LLVM 23.1.4 的 analysis 注册表快照，来源：
 * llvm/lib/Passes/PassRegistry.def @ 7a941dfb2877a0b8cf30323fefa85ad019e0b0f5
 *
 * 只收 MODULE / CGSCC / FUNCTION / LOOP_ANALYSIS 宏；67 项 =
 * Module 23 + CGSCC 3 + Function 36 + Loop 5。
 *
 * 和 pass registry 一样，这里包含 verify / no-op / pass-instrumentation 等
 * 调试与基础设施入口，因此比「默认管线真正会用到的分析」多。
 * 未注册的辅助分析（GlobalsAA、InlineCostAnalysis 等）不在这个快照里。
 */
export type AnalysisScope = 'module' | 'cgscc' | 'function' | 'loop';

export interface AnalysisRegistration {
  /** `require<...>` / `print<...>` 里用的注册名，如 `domtree` */
  name: string;
  /** C++ 侧的 analysis 类，如 `DominatorTreeAnalysis` */
  analysis: string;
  /** 结果挂在哪个 IR 单元上 */
  scope: AnalysisScope;
}

export const analysisRegistry: AnalysisRegistration[] = [
  { name: 'callgraph', analysis: 'CallGraphAnalysis', scope: 'module' },
  { name: 'collector-metadata', analysis: 'CollectorMetadataAnalysis', scope: 'module' },
  { name: 'ctx-prof-analysis', analysis: 'CtxProfAnalysis', scope: 'module' },
  { name: 'dxil-metadata', analysis: 'DXILMetadataAnalysis', scope: 'module' },
  { name: 'dxil-resources', analysis: 'DXILResourceAnalysis', scope: 'module' },
  { name: 'dxil-resource-type', analysis: 'DXILResourceTypeAnalysis', scope: 'module' },
  { name: 'dxil-resource-bindings', analysis: 'DXILResourceBindingAnalysis', scope: 'module' },
  { name: 'inline-advisor', analysis: 'InlineAdvisorAnalysis', scope: 'module' },
  { name: 'ir2vec-vocab', analysis: 'IR2VecVocabAnalysis', scope: 'module' },
  { name: 'ir-similarity', analysis: 'IRSimilarityAnalysis', scope: 'module' },
  { name: 'last-run-tracking', analysis: 'LastRunTrackingAnalysis', scope: 'module' },
  { name: 'lcg', analysis: 'LazyCallGraphAnalysis', scope: 'module' },
  { name: 'libcall-lowering-info', analysis: 'LibcallLoweringModuleAnalysis', scope: 'module' },
  {
    name: 'immutable-module-summary',
    analysis: 'ImmutableModuleSummaryIndexAnalysis',
    scope: 'module',
  },
  { name: 'module-summary', analysis: 'ModuleSummaryIndexAnalysis', scope: 'module' },
  { name: 'no-op-module', analysis: 'NoOpModuleAnalysis', scope: 'module' },
  { name: 'pass-instrumentation', analysis: 'PassInstrumentationAnalysis', scope: 'module' },
  { name: 'profile-summary', analysis: 'ProfileSummaryAnalysis', scope: 'module' },
  { name: 'reg-usage', analysis: 'PhysicalRegisterUsageAnalysis', scope: 'module' },
  { name: 'runtime-libcall-info', analysis: 'RuntimeLibraryAnalysis', scope: 'module' },
  { name: 'stack-safety', analysis: 'StackSafetyGlobalAnalysis', scope: 'module' },
  { name: 'static-data-profile-info', analysis: 'StaticDataProfileInfoAnalysis', scope: 'module' },
  { name: 'verify', analysis: 'VerifierAnalysis', scope: 'module' },

  { name: 'no-op-cgscc', analysis: 'NoOpCGSCCAnalysis', scope: 'cgscc' },
  { name: 'fam-proxy', analysis: 'FunctionAnalysisManagerCGSCCProxy', scope: 'cgscc' },
  { name: 'pass-instrumentation', analysis: 'PassInstrumentationAnalysis', scope: 'cgscc' },

  { name: 'aa', analysis: 'AAManager', scope: 'function' },
  { name: 'access-info', analysis: 'LoopAccessAnalysis', scope: 'function' },
  { name: 'assumptions', analysis: 'AssumptionAnalysis', scope: 'function' },
  {
    name: 'bb-sections-profile-reader',
    analysis: 'BasicBlockSectionsProfileReaderAnalysis',
    scope: 'function',
  },
  { name: 'block-freq', analysis: 'BlockFrequencyAnalysis', scope: 'function' },
  { name: 'branch-prob', analysis: 'BranchProbabilityAnalysis', scope: 'function' },
  { name: 'cycles', analysis: 'CycleAnalysis', scope: 'function' },
  { name: 'da', analysis: 'DependenceAnalysis', scope: 'function' },
  { name: 'debug-ata', analysis: 'DebugAssignmentTrackingAnalysis', scope: 'function' },
  { name: 'demanded-bits', analysis: 'DemandedBitsAnalysis', scope: 'function' },
  { name: 'domfrontier', analysis: 'DominanceFrontierAnalysis', scope: 'function' },
  { name: 'domtree', analysis: 'DominatorTreeAnalysis', scope: 'function' },
  { name: 'ephemerals', analysis: 'EphemeralValuesAnalysis', scope: 'function' },
  { name: 'func-properties', analysis: 'FunctionPropertiesAnalysis', scope: 'function' },
  { name: 'machine-function-info', analysis: 'MachineFunctionAnalysis', scope: 'function' },
  { name: 'gc-function', analysis: 'GCFunctionAnalysis', scope: 'function' },
  { name: 'last-run-tracking', analysis: 'LastRunTrackingAnalysis', scope: 'function' },
  { name: 'lazy-value-info', analysis: 'LazyValueAnalysis', scope: 'function' },
  { name: 'loops', analysis: 'LoopAnalysis', scope: 'function' },
  { name: 'memdep', analysis: 'MemoryDependenceAnalysis', scope: 'function' },
  { name: 'memoryssa', analysis: 'MemorySSAAnalysis', scope: 'function' },
  { name: 'no-op-function', analysis: 'NoOpFunctionAnalysis', scope: 'function' },
  { name: 'opt-remark-emit', analysis: 'OptimizationRemarkEmitterAnalysis', scope: 'function' },
  { name: 'pass-instrumentation', analysis: 'PassInstrumentationAnalysis', scope: 'function' },
  { name: 'phi-values', analysis: 'PhiValuesAnalysis', scope: 'function' },
  { name: 'postdomtree', analysis: 'PostDominatorTreeAnalysis', scope: 'function' },
  { name: 'regions', analysis: 'RegionInfoAnalysis', scope: 'function' },
  { name: 'scalar-evolution', analysis: 'ScalarEvolutionAnalysis', scope: 'function' },
  {
    name: 'should-not-run-function-passes',
    analysis: 'ShouldNotRunFunctionPassesAnalysis',
    scope: 'function',
  },
  {
    name: 'should-run-extra-vector-passes',
    analysis: 'ShouldRunExtraVectorPasses',
    scope: 'function',
  },
  { name: 'ssp-layout', analysis: 'SSPLayoutAnalysis', scope: 'function' },
  { name: 'stack-safety-local', analysis: 'StackSafetyAnalysis', scope: 'function' },
  { name: 'target-ir', analysis: 'TargetIRAnalysis', scope: 'function' },
  { name: 'target-lib-info', analysis: 'TargetLibraryAnalysis', scope: 'function' },
  { name: 'uniformity', analysis: 'UniformityInfoAnalysis', scope: 'function' },
  { name: 'verify', analysis: 'VerifierAnalysis', scope: 'function' },

  { name: 'ddg', analysis: 'DDGAnalysis', scope: 'loop' },
  { name: 'iv-users', analysis: 'IVUsersAnalysis', scope: 'loop' },
  { name: 'no-op-loop', analysis: 'NoOpLoopAnalysis', scope: 'loop' },
  { name: 'pass-instrumentation', analysis: 'PassInstrumentationAnalysis', scope: 'loop' },
  {
    name: 'should-run-extra-simple-loop-unswitch',
    analysis: 'ShouldRunExtraSimpleLoopUnswitch',
    scope: 'loop',
  },
];

/** 注册表里的 scope 分组顺序，和最外层 PassManager 的 IR 层级一致。 */
export const analysisScopeOrder: AnalysisScope[] = ['module', 'cgscc', 'function', 'loop'];

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
  cgscc: {
    manager: 'CGSCCAnalysisManager',
    note: {
      zh: '每个 SCC 一份：目前注册表里主要是 FAM proxy、pass instrumentation 和 no-op 这类基础设施；真正的调用图事实在模块级的 LazyCallGraph 上。',
      en: 'One result per SCC: the registrations here are mostly infrastructure such as the FAM proxy, pass instrumentation and no-op wrappers; the actual call-graph facts live in the module-level LazyCallGraph.',
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
