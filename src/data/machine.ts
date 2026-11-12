import type { Locale } from '../i18n/config.ts';
import type { PipelinePass } from './pipeline.ts';

/**
 * Machine IR 阶段的事实来源。
 *
 * 这里刻意不把「代码生成」压成一个阶段：
 * - 共享部分来自 TargetPassConfig（target-independent ordering）；
 * - lanes 里的 pass 来自 X86PassConfig / AArch64PassConfig 的 hook；
 * - 同一段 IR 的 MIR 快照用两条目标线并排展示，避免把后端当黑盒。
 *
 * 顺序按 LLVM 23.1.4 的 TargetPassConfig.cpp、X86TargetMachine.cpp 与
 * AArch64TargetMachine.cpp 整理；target hook 的实际位置以注释为准。
 */
export type MachineTargetId = 'x86-64' | 'aarch64';

export interface MachineTarget {
  id: MachineTargetId;
  label: string;
  triple: string;
  passConfig: string;
  isel: string;
  asmPrinter: string;
  abi: Record<Locale, string>;
  registers: Record<Locale, string>;
  addressing: Record<Locale, string>;
}

export const machineTargets: Record<MachineTargetId, MachineTarget> = {
  'x86-64': {
    id: 'x86-64',
    label: 'x86-64',
    triple: 'x86_64-linux-gnu',
    passConfig: 'X86PassConfig',
    isel: 'X86DAGToDAGISel',
    asmPrinter: 'X86AsmPrinter',
    abi: {
      zh: 'System V AMD64：rdi、rsi、rdx、rcx、r8、r9 传参，rax 返回；rsp 16 字节对齐。',
      en: 'System V AMD64: arguments in rdi, rsi, rdx, rcx, r8, r9; return in rax; rsp stays 16-byte aligned.',
    },
    registers: {
      zh: '16 个通用寄存器，通常 14 个可参与分配；大量指令是两地址形式，需要额外的 COPY。',
      en: '16 general-purpose registers, usually 14 allocatable; many instructions are two-address and need extra COPYs.',
    },
    addressing: {
      zh: '基址 + 比例索引 + 位移可以塞进一条指令的 memory operand，例如 8(%rdi,%rsi,4)。',
      en: 'Base + scaled index + displacement fits in one memory operand, e.g. 8(%rdi,%rsi,4).',
    },
  },
  aarch64: {
    id: 'aarch64',
    label: 'AArch64',
    triple: 'aarch64-linux-gnu',
    passConfig: 'AArch64PassConfig',
    isel: 'AArch64DAGToDAGISel',
    asmPrinter: 'AArch64AsmPrinter',
    abi: {
      zh: 'AAPCS64：x0–x7 传参，x0 返回；x8 是间接结果指针，x16/x17 留给链接器。',
      en: 'AAPCS64: arguments in x0–x7, return in x0; x8 is the indirect result pointer and x16/x17 are linker scratch.',
    },
    registers: {
      zh: '31 个 64 位通用寄存器；w0–w30 是低 32 位视图。三地址指令多，寄存器压力通常比 x86 小。',
      en: '31 64-bit general-purpose registers; w0–w30 are their low 32-bit views. Three-address instructions keep pressure lower than on x86.',
    },
    addressing: {
      zh: '基址 + 寄存器偏移（可带 extend/shift）或 12 位立即数；没有 x86 那样任意位移的 memory operand。',
      en: 'Base + register offset (optionally extended/shifted) or a 12-bit immediate; no arbitrary-displacement memory operand like x86.',
    },
  },
};

export interface MachineStage {
  id: 'isel' | 'ssa' | 'pre-ra' | 'ra' | 'post-ra' | 'emit';
  title: Record<Locale, string>;
  manager: string;
  note: Record<Locale, string>;
  /** 两个 target 共用的 target-independent pass，顺序即执行顺序 */
  shared: PipelinePass[];
  /** 由 target 的 addPreRegAlloc / addPostRegAlloc / addPreEmitPass 等 hook 插入 */
  lanes: Record<MachineTargetId, PipelinePass[]>;
}

const p = (name: string, extra: Omit<PipelinePass, 'name'> = {}): PipelinePass => ({
  name,
  ...extra,
});

export const machineStages: MachineStage[] = [
  {
    id: 'isel',
    title: { zh: '指令选择', en: 'Instruction selection' },
    manager: 'SelectionDAGISel · MachineFunctionPass',
    note: {
      zh: '每个基本块被摊成 SelectionDAG：先合法化类型与操作，再做 DAG combine，最后用 target 的 TableGen pattern 选出机器指令。输出仍是 SSA，但虚拟寄存器已经带上寄存器类（gr32、gpr64、fpr…）。',
      en: 'Each basic block becomes a SelectionDAG: legalise types and operations, combine, then match target TableGen patterns. The output is still SSA, but virtual registers now carry register classes (gr32, gpr64, fpr…).',
    },
    shared: [
      p('isel', { label: 'ISel (DAG)', page: 'isel' }),
      p('finalize-isel'),
    ],
    lanes: {
      'x86-64': [
        p('x86-isel', { label: 'X86DAGToDAGISel', kind: 'helper' }),
      ],
      aarch64: [
        p('aarch64-isel', { label: 'AArch64DAGToDAGISel', kind: 'helper' }),
      ],
    },
  },
  {
    id: 'ssa',
    title: { zh: '机器级 SSA 化简', en: 'Machine SSA cleanup' },
    manager: 'MachineFunctionPass · pre-RA',
    note: {
      zh: '寄存器分配之前，MIR 仍是 SSA。machinelicm、machine-cse 在机器指令上做冗余消除，peephole-opt 折叠地址与立即数；此时还没有物理寄存器，只有虚拟寄存器和寄存器类。',
      en: 'MIR is still SSA before allocation. machinelicm and machine-cse remove redundancy at the machine level, and peephole-opt folds addresses and immediates; there are still no physical registers, only virtuals and classes.',
    },
    shared: [
      p('early-tailduplication'),
      p('opt-phis', { label: 'OptimizePHIs' }),
      p('stack-coloring'),
      p('dead-mi-elimination'),
      p('machinelicm', { label: 'MachineLICM' }),
      p('machine-cse'),
      p('machine-sink', { label: 'MachineSinking' }),
      p('peephole-opt', { label: 'PeepholeOptimizer' }),
    ],
    lanes: {
      'x86-64': [
        p('early-ifcvt'),
        p('machine-combiner'),
        p('x86-cmov-conversion'),
        p('x86-partial-reduction', { conditional: true }),
      ],
      aarch64: [
        p('aarch64-condopt'),
        p('aarch64-ccmp', { label: 'AArch64ConditionalCompares' }),
        p('machine-combiner'),
        p('aarch64-cond-br-tuning'),
        p('aarch64-stp-suppress'),
        p('aarch64-simd-instr-opt'),
      ],
    },
  },
  {
    id: 'pre-ra',
    title: { zh: '拆 SSA 与预分配调度', en: 'SSA destruction & pre-RA scheduling' },
    manager: 'MachineFunctionPass · pre-RA',
    note: {
      zh: 'phi-node-elimination 把 φ 换成前驱里的 COPY，必要时拆开 critical edge；twoaddressinstruction 处理 x86 的两地址约束；register-coalescer 清掉多余 COPY；machine-scheduler 在分配前重排指令，让活跃区间更短、更少重叠。',
      en: 'phi-node-elimination turns PHIs into COPYs in predecessors, splitting critical edges when needed; twoaddressinstruction handles x86 two-address constraints; register-coalescer removes redundant COPYs; machine-scheduler reorders before allocation to shorten and separate live ranges.',
    },
    shared: [
      p('phi-node-elimination', { page: 'phi-elim' }),
      p('twoaddressinstruction', { label: 'TwoAddressInstruction' }),
      p('register-coalescer', { page: 'regalloc' }),
      p('machine-scheduler'),
      p('rename-independent-subregs'),
    ],
    lanes: {
      'x86-64': [
        p('live-range-shrink'),
        p('x86-fixup-setcc'),
        p('x86-optimize-leas'),
        p('x86-cf-opt', { label: 'X86CallFrameOptimization' }),
        p('x86-avoid-sfb', { label: 'X86AvoidStoreForwardingBlocks' }),
        p('x86-flags-copy-lowering'),
        p('x86-domain-reassignment'),
        p('x86-dyn-alloca-expander'),
      ],
      aarch64: [
        p('aarch64-dead-defs'),
        p('aarch64-simd-scalar', { label: 'AArch64AdvSIMDScalar' }),
        p('peephole-opt', { label: 'PeepholeOptimizer' }),
        p('pipeliner', { label: 'MachinePipeliner' }),
      ],
    },
  },
  {
    id: 'ra',
    title: { zh: '寄存器分配', en: 'Register allocation' },
    manager: 'RegAllocGreedy · MachineFunctionPass',
    note: {
      zh: 'greedy 按 spill weight 处理活跃区间：先试 copy hint，再找空闲寄存器，必要时拆区间或驱逐邻居；实在放不下就溢出到 %stack.N。virtregrewriter 把虚拟寄存器换成物理寄存器，并插入 spill / reload。',
      en: 'greedy processes live intervals by spill weight: try copy hints, then free registers, split a range or evict a neighbour, and spill to %stack.N as a last resort. virtregrewriter replaces virtuals with physical registers and inserts spill / reload code.',
    },
    shared: [
      p('greedy', { page: 'regalloc', conditional: true }),
      p('virtregrewriter', { page: 'regalloc' }),
      p('stack-slot-coloring'),
      p('machine-cp'),
      p('machinelicm', { label: 'MachineLICM' }),
    ],
    lanes: {
      'x86-64': [
        p('x86-fp-stackifier'),
        p('x86-lower-tile-copy'),
      ],
      aarch64: [
        p('aarch64-srlt-define-superregs', { label: 'AArch64SRLTDefineSuperRegs', conditional: true }),
        p('aarch64-copyelim', { label: 'AArch64RedundantCopyElimination' }),
        p('aarch64-a57-fp-load-balancing'),
      ],
    },
  },
  {
    id: 'post-ra',
    title: { zh: '栈帧与后分配优化', en: 'Frame lowering & post-RA' },
    manager: 'MachineFunctionPass · post-RA',
    note: {
      zh: 'prolog-epilog 解析 frame index、保存 callee-saved 寄存器、对齐栈并生成 prologue / epilogue；之后再做 post-RA 调度、分支折叠、尾复制和基本块布局。布局定下来后，machine-function-splitter 按 profile 把冷块标进独立 section。此时寄存器已经是物理寄存器。',
      en: 'prolog-epilog resolves frame indices, saves callee-saved registers, aligns the stack and emits prologue / epilogue; post-RA scheduling, branch folding, tail duplication and block placement follow. Once the layout is settled, machine-function-splitter marks cold blocks for their own section. Registers are physical by now.',
    },
    shared: [
      p('prolog-epilog', { label: 'PrologEpilogInserter' }),
      p('postmisched', { label: 'PostMachineScheduler' }),
      p('branch-folder'),
      p('tailduplication'),
      p('block-placement', { label: 'MachineBlockPlacement' }),
      p('postrapseudos', { label: 'ExpandPostRAPseudos' }),
      p('machine-function-splitter', { page: 'machine-function-splitter', conditional: true }),
    ],
    lanes: {
      'x86-64': [
        p('x86-expand-pseudo'),
        p('x86-insert-vzeroupper'),
        p('x86-fixup-bw-insts'),
        p('x86-fixup-leas'),
        p('x86-pad-short-functions'),
        p('x86-return-thunks'),
      ],
      aarch64: [
        p('aarch64-expand-pseudo', { label: 'AArch64ExpandPseudo' }),
        p('aarch64-ldst-opt', { label: 'AArch64LoadStoreOptimizer' }),
        p('aarch64-redundantcondbranch', { label: 'AArch64RedundantCondBranch' }),
      ],
    },
  },
  {
    id: 'emit',
    title: { zh: '收尾与 MC 发射', en: 'Finalisation & MC emission' },
    manager: 'AsmPrinter · MC',
    note: {
      zh: '最后一段仍然在 Machine IR 上：AArch64 做 branch relaxation、跳转表压缩和指针认证，x86 做 EVEX 压缩与 x87 等待；AsmPrinter 把 MIR 变成 MC 指令，再由编码器写出汇编或目标文件。',
      en: 'The last stage is still Machine IR: AArch64 does branch relaxation, jump-table compression and pointer authentication, x86 compresses EVEX and inserts x87 waits; AsmPrinter lowers MIR to MC instructions before the encoder emits assembly or an object file.',
    },
    shared: [
      p('asm-printer'),
    ],
    lanes: {
      'x86-64': [
        p('x86-compress-evex'),
        p('x86-execution-domain-fix'),
        p('x86-insert-x87-wait'),
        p('x86-avoid-trailing-call'),
      ],
      aarch64: [
        p('aarch64-collect-loh', { conditional: true }),
        p('aarch64-sls-hardening'),
        p('aarch64-ptrauth', { label: 'AArch64PointerAuth' }),
        p('aarch64-branch-targets', { conditional: true }),
        p('branch-relaxation', { conditional: true }),
        p('aarch64-jump-tables', { label: 'AArch64CompressJumpTables' }),
        p('aarch64-post-coalescer'),
        p('aarch64-speculation-hardening'),
      ],
    },
  },
];

export interface MachineSnapshot {
  id: string;
  title: Record<Locale, string>;
  intro: Record<Locale, string>;
  before?: string;
  targets: Record<MachineTargetId, string>;
}

const block = (text: string): string => {
  const lines = text.replace(/^\n+|\n+$/g, '').split('\n');
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) ?? [''])[0].length);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(min).replace(/\s+$/, '')).join('\n');
};

const scaleIR = block(`
define i32 @scale(ptr %p, i32 %i) {
entry:
  %idx = sext i32 %i to i64
  %addr = getelementptr inbounds i32, ptr %p, i64 %idx
  %v = load i32, ptr %addr, align 4
  %mul = mul nsw i32 %v, 3
  %add = add nsw i32 %mul, 1
  ret i32 %add
}
`);

const scaleX86MIR = block(`
---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $rdi, $esi
    %0:gr64 = COPY $rdi
    %1:gr32 = COPY $esi
    %2:gr64 = MOVSX64rr32 %1
    %3:gr32 = MOV32rm %0, 4, %2, 0, _
    %4:gr32 = LEA32r %3, 2, %3, 0, _
    %5:gr32 = INC32r %4, implicit-def dead $eflags
    $eax = COPY %5
    RET64 $eax
`);

const scaleA64MIR = block(`
---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $x0, $w1
    %0:gpr64 = COPY $x0
    %1:gpr32 = COPY $w1
    %2:gpr32 = LDRWroW %0, %1, 6
    %3:gpr32 = ADDWrs %2, %2, 1
    %4:gpr32 = ADDWri %3, 1, 0
    $w0 = COPY %4
    RET_ReallyLR implicit $w0
`);

const assignedX86MIR = block(`
---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $rdi, $esi
    $rax = MOVSX64rr32 $esi
    $eax = MOV32rm $rdi, 4, $rax, 0, _
    $eax = LEA32r $eax, 2, $eax, 0, _
    $eax = INC32r $eax, implicit-def dead $eflags
    RET64 $eax
`);

const assignedA64MIR = block(`
---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $x0, $w1
    $w8 = LDRWroW $x0, $w1, 6
    $w0 = ADDWrs $w8, $w8, 1
    $w0 = ADDWri $w0, 1, 0
    RET_ReallyLR implicit $w0
`);

export const machineSnapshots: MachineSnapshot[] = [
  {
    id: 'isel',
    title: { zh: '同一段 IR，两种选择', en: 'One IR, two selections' },
    intro: {
      zh: 'scale 的地址计算、乘 3 和加 1 在两条目标线上落到不同指令：x86 用 LEA 把「三个操作数」压成一条，AArch64 用移位加；两边的 load 都把索引计算折进了寻址模式。',
      en: 'For scale, address computation, multiply-by-3 and add-1 land on different instructions: x86 folds three operands into LEA, AArch64 uses a shifted add, and both fold the index computation into the load addressing mode.',
    },
    before: scaleIR,
    targets: {
      'x86-64': scaleX86MIR,
      aarch64: scaleA64MIR,
    },
  },
  {
    id: 'ra',
    title: { zh: '同一段 MIR，两套寄存器', en: 'One MIR, two register files' },
    intro: {
      zh: '分配后虚拟寄存器消失，只剩物理寄存器。x86 的 $rax 同时承担地址索引与结果，AArch64 则把中间值放在 $w8、返回值放在 $w0；这不是模板，而是活跃区间与目标约束共同决定的结果。',
      en: 'After allocation virtual registers are gone. x86 reuses $rax for the address index and the result; AArch64 keeps the intermediate in $w8 and the return value in $w0. This is not a template: live ranges and target constraints decide it.',
    },
    targets: {
      'x86-64': assignedX86MIR,
      aarch64: assignedA64MIR,
    },
  },
];
