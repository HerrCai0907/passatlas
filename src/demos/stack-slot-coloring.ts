import { makeDemo } from './types.ts';

/**
 * 一个函数里有两段互不相交的溢出区：
 * - 第一个 call 两侧用 %stack.0 / %stack.1；
 * - 第二个 call 两侧用 %stack.2 / %stack.3。
 * 两段之间没有活跃值，所以 2 可以复用 0、3 可以复用 1。
 *
 * MIR 取自 x86-64 的真实形态，删掉了无关的 debug 信息和 prologue，
 * 保留 stack 列表以便在动画里直接看到栈对象被删掉。
 */
const before = `
---
name: spill_merge
tracksRegLiveness: true
stack:
  - { id: 0, type: spill-slot, size: 8, alignment: 8 }
  - { id: 1, type: spill-slot, size: 8, alignment: 8 }
  - { id: 2, type: spill-slot, size: 8, alignment: 8 }
  - { id: 3, type: spill-slot, size: 8, alignment: 8 }
body: |
  bb.0:
    liveins: $rdi
    renamable $rbx = COPY $rdi
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 0, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 8, $noreg
    MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rax
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rax = ADD64rm killed renamable $rax, %stack.1, 1, $noreg, 0, $noreg, implicit-def dead $eflags
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 16, $noreg
    MOV64mr %stack.2, 1, $noreg, 0, $noreg, killed renamable $rcx
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 24, $noreg
    MOV64mr %stack.3, 1, $noreg, 0, $noreg, killed renamable $rcx
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rcx = MOV64rm %stack.2, 1, $noreg, 0, $noreg
    renamable $rcx = ADD64rm killed renamable $rcx, %stack.3, 1, $noreg, 0, $noreg, implicit-def dead $eflags
    renamable $rax = ADD64rr killed renamable $rax, killed renamable $rcx, implicit-def dead $eflags
    RET64 $rax
`;

const rewritten = `
---
name: spill_merge
tracksRegLiveness: true
stack:
  - { id: 0, type: spill-slot, size: 8, alignment: 8 }
  - { id: 1, type: spill-slot, size: 8, alignment: 8 }
  - { id: 2, type: spill-slot, size: 8, alignment: 8 }
  - { id: 3, type: spill-slot, size: 8, alignment: 8 }
body: |
  bb.0:
    liveins: $rdi
    renamable $rbx = COPY $rdi
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 0, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 8, $noreg
    MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rax
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rax = ADD64rm killed renamable $rax, %stack.1, 1, $noreg, 0, $noreg, implicit-def dead $eflags
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 16, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rcx
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 24, $noreg
    MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rcx
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rcx = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rcx = ADD64rm killed renamable $rcx, %stack.1, 1, $noreg, 0, $noreg, implicit-def dead $eflags
    renamable $rax = ADD64rr killed renamable $rax, killed renamable $rcx, implicit-def dead $eflags
    RET64 $rax
`;

const compact = `
---
name: spill_merge
tracksRegLiveness: true
stack:
  - { id: 0, type: spill-slot, size: 8, alignment: 8 }
  - { id: 1, type: spill-slot, size: 8, alignment: 8 }
body: |
  bb.0:
    liveins: $rdi
    renamable $rbx = COPY $rdi
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 0, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 8, $noreg
    MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rax
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rax = ADD64rm killed renamable $rax, %stack.1, 1, $noreg, 0, $noreg, implicit-def dead $eflags
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 16, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rcx
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 24, $noreg
    MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rcx
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rcx = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rcx = ADD64rm killed renamable $rcx, %stack.1, 1, $noreg, 0, $noreg, implicit-def dead $eflags
    renamable $rax = ADD64rr killed renamable $rax, killed renamable $rcx, implicit-def dead $eflags
    RET64 $rax
`;

const slots = [
  'slot   live     refs  weight  color',
  '.0     call 1     2     2.0     -',
  '.1     call 1     2     2.0     -',
  '.2     call 2     2     2.0     -',
  '.3     call 2     2     2.0     -',
].join('\n');

const firstColors = [
  'slot   live     refs  weight  color',
  '.0     call 1     2     2.0     0',
  '.1     call 1     2     2.0     1',
  '.2     call 2     2     2.0     -',
  '.3     call 2     2     2.0     -',
  'colors: 0 1   (both newly used)',
].join('\n');

const shared = [
  'slot   live     refs  weight  color',
  '.0     call 1     2     2.0     0',
  '.1     call 1     2     2.0     1',
  '.2     call 2     2     2.0     0   share .0',
  '.3     call 2     2     2.0     1   share .1',
  'overlap: .0/.1  .2/.3   cross-call: none',
].join('\n');

const mapped = [
  'slot   live     refs  weight  color  new',
  '.0     call 1     2     2.0     0     .0',
  '.1     call 1     2     2.0     1     .1',
  '.2     call 2     2     2.0     0     .0',
  '.3     call 2     2     2.0     1     .1',
  'mapping: 0->0  1->1  2->0  3->1',
].join('\n');

const dropped = [
  'slot   live     refs  weight  color  new',
  '.0     call 1     2     2.0     0     .0',
  '.1     call 1     2     2.0     1     .1',
  '.2     call 2     2     2.0     0     .0',
  '.3     call 2     2     2.0     1     .1',
  'frame: 4 slots / 32 B  ->  2 slots / 16 B',
  'removed: %stack.2 %stack.3',
].join('\n');

const stackRefs = [
  'MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax',
  'MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rax',
];

const phaseBStores = [
  'MOV64mr %stack.2, 1, $noreg, 0, $noreg, killed renamable $rcx',
  'MOV64mr %stack.3, 1, $noreg, 0, $noreg, killed renamable $rcx',
];

export const stackSlotColoringDemo = makeDemo(
  'stack-slot-coloring',
  'stack-slot-coloring · x86-64',
  [
    {
      title: '第 1 步 · 收集 spill slot 与活跃区间',
      note: 'StackSlotColoring 不新建栈槽：它从 LiveStacks 取寄存器分配器留下的 4 个 spill slot，扫描 FI 操作数并按块频率给每个槽累加 spill weight，同时记下 MachineMemOperand 以便后面改写。此时 4 个槽仍然各自独立，颜色列是空的。',
      before,
      after: before,
      state: slots,
      focus: [
        '- { id: 0, type: spill-slot, size: 8, alignment: 8 }',
        '- { id: 1, type: spill-slot, size: 8, alignment: 8 }',
        '- { id: 2, type: spill-slot, size: 8, alignment: 8 }',
        '- { id: 3, type: spill-slot, size: 8, alignment: 8 }',
      ],
    },
    {
      title: '第 2 步 · 第一个槽拿到基准色',
      note: '按 spill weight 从高到低处理，权重相同则保持 frame index 顺序。ColorSlot 先看已用颜色，再取下一个空闲槽：%stack.0 拿到颜色 0，%stack.1 与它重叠，只能拿颜色 1。MIR 还没改写，变化只发生在内部状态里。',
      before,
      after: before,
      state: firstColors,
      focus: stackRefs,
    },
    {
      title: '第 3 步 · 跨 call 复用颜色',
      note: '%stack.2 检查颜色 0：它和 %stack.0 的活跃区间分处两个 call 的两侧，不相交，于是共享颜色 0。%stack.3 与 %stack.2 重叠，颜色 0 不行；颜色 1 里的 %stack.1 已经死亡，于是共享颜色 1。四个槽收敛到两个颜色。',
      before,
      after: before,
      state: shared,
      focus: phaseBStores,
    },
    {
      title: '第 4 步 · 改写所有 frame index',
      note: 'SlotMapping 把每条 FI 操作数从旧槽改成颜色槽，MachineMemOperand 里的 FixedStackPseudoSourceValue 也一起改。这里 %stack.2 的 store/load 变成 %stack.0，%stack.3 变成 %stack.1；指令条数不变。',
      before,
      after: rewritten,
      state: mapped,
    },
    {
      title: '第 5 步 · 删掉空出来的栈对象',
      note: '最后从 MachineFrameInfo 里删除没有任何颜色使用的对象。stack: 从 4 项降到 2 项，栈帧从 32 字节降到 16 字节；动态 load/store 次数没变，收益来自更小的 frame 和更好的栈缓存局部性。',
      before: rewritten,
      after: compact,
      state: dropped,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Collect spill slots and live ranges',
          note: 'StackSlotColoring does not create slots: it takes the four spill slots left by the register allocator from LiveStacks, scans FI operands to accumulate a spill weight per slot from block frequency, and records MachineMemOperands for the rewrite. The four slots are still independent; the color column is empty.',
        },
        {
          title: 'Step 2 · The first slots take the base colors',
          note: 'Slots are processed by spill weight, highest first, with ties kept in frame-index order. ColorSlot looks at the used colors first, then takes the next free slot: %stack.0 gets color 0, and %stack.1 overlaps it, so it gets color 1. MIR is unchanged; only the internal state moves.',
        },
        {
          title: 'Step 3 · Reuse colors across the calls',
          note: '%stack.2 checks color 0: its live range and %stack.0’s sit on opposite sides of two calls, so they do not overlap and it shares color 0. %stack.3 overlaps %stack.2, so color 0 is out; but %stack.1 in color 1 is already dead, so it shares color 1. Four slots collapse to two colors.',
        },
        {
          title: 'Step 4 · Rewrite every frame index',
          note: 'SlotMapping rewrites each FI operand from its old slot to its color slot, and updates the FixedStackPseudoSourceValue in the MachineMemOperands with it. Here %stack.2’s store/load become %stack.0, and %stack.3 becomes %stack.1; the instruction count does not change.',
        },
        {
          title: 'Step 5 · Drop the objects that are now unused',
          note: 'Finally, objects that no color uses are removed from MachineFrameInfo. stack: shrinks from four entries to two, and the frame from 32 bytes to 16. The number of dynamic loads and stores is unchanged; the win is a smaller frame and better stack-cache locality.',
        },
      ],
    },
  },
  { format: 'mir' },
);
