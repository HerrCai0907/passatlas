import { makeDemo } from './types.ts';

/**
 * 一个函数里有两段互不相交的溢出区：
 * - 第一个 call 两侧用 %stack.0；
 * - 第二个 call 两侧用 %stack.1。
 * 两段之间没有活跃值，所以 1 可以复用 0。
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
body: |
  bb.0:
    liveins: $rdi
    renamable $rbx = COPY $rdi
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 0, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 8, $noreg
    MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rcx
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rcx = MOV64rm %stack.1, 1, $noreg, 0, $noreg
    renamable $rax = ADD64rr killed renamable $rax, killed renamable $rcx, implicit-def dead $eflags
    RET64 $rax
`;

const storeRewritten = `
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
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 8, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rcx
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rcx = MOV64rm %stack.1, 1, $noreg, 0, $noreg
    renamable $rax = ADD64rr killed renamable $rax, killed renamable $rcx, implicit-def dead $eflags
    RET64 $rax
`;

const rewritten = `
---
name: spill_merge
tracksRegLiveness: true
stack:
  - { id: 0, type: spill-slot, size: 8, alignment: 8 }
body: |
  bb.0:
    liveins: $rdi
    renamable $rbx = COPY $rdi
    renamable $rax = MOV64rm renamable $rbx, 1, $noreg, 0, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rcx = MOV64rm renamable $rbx, 1, $noreg, 8, $noreg
    MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rcx
    CALL64pcrel32 @use, csr_64, implicit $rsp, implicit $ssp, implicit $rdi, implicit-def $rsp, implicit-def $ssp
    renamable $rcx = MOV64rm %stack.0, 1, $noreg, 0, $noreg
    renamable $rax = ADD64rr killed renamable $rax, killed renamable $rcx, implicit-def dead $eflags
    RET64 $rax
`;

const spill0 = 'MOV64mr %stack.0, 1, $noreg, 0, $noreg, killed renamable $rax';
const reload0 = 'renamable $rax = MOV64rm %stack.0, 1, $noreg, 0, $noreg';
const spill1 = 'MOV64mr %stack.1, 1, $noreg, 0, $noreg, killed renamable $rcx';
const reload1 = 'renamable $rcx = MOV64rm %stack.1, 1, $noreg, 0, $noreg';

const scanSpill0 = [
  'slot  live    refs  weight  color',
  '.0    call 1    1     1.0     -',
  '.1    -         -     -       -',
].join('\n');

const scanReload0 = [
  'slot  live    refs  weight  color',
  '.0    call 1    2     2.0     -',
  '.1    -         -     -       -',
].join('\n');

const scanSpill1 = [
  'slot  live    refs  weight  color',
  '.0    call 1    2     2.0     -',
  '.1    call 2    1     1.0     -',
].join('\n');

const scanReload1 = [
  'slot  live    refs  weight  color',
  '.0    call 1    2     2.0     -',
  '.1    call 2    2     2.0     -',
  'overlap: none   order: .0 .1',
].join('\n');

const color0 = [
  'slot  live    refs  weight  color',
  '.0    call 1    2     2.0     0',
  '.1    call 2    2     2.0     -',
  'colors: 0',
].join('\n');

const color1 = [
  'slot  live    refs  weight  color',
  '.0    call 1    2     2.0     0',
  '.1    call 2    2     2.0     0   share .0',
  'colors: 0',
].join('\n');

const rewriteStore = [
  'slot  live    refs  weight  color  new',
  '.0    call 1    2     2.0     0     .0',
  '.1    call 2    2     2.0     0     .0',
  'rewrite: %stack.1 -> %stack.0 (store)',
].join('\n');

const rewriteLoad = [
  'slot  live    refs  weight  color  new',
  '.0    call 1    2     2.0     0     .0',
  '.1    call 2    2     2.0     0     .0',
  'rewrite: %stack.1 -> %stack.0 (load)',
  'frame: 2 slots / 16 B -> 1 slot / 8 B',
  'removed: %stack.1',
].join('\n');

export const stackSlotColoringDemo = makeDemo(
  'stack-slot-coloring',
  'stack-slot-coloring · x86-64',
  [
    {
      title: '第 1 步 · 扫描 %stack.0 的 spill',
      note: '当前指令把 %rax 溢出到 %stack.0。LiveStacks 从这条 store 开始记录 .0 的活跃区间：refs=1，按块频率累加一次 spill weight。',
      before,
      after: before,
      state: scanSpill0,
      cursor: { line: spill0 },
      focus: ['- { id: 0, type: spill-slot, size: 8, alignment: 8 }'],
    },
    {
      title: '第 2 步 · 扫描 %stack.0 的 reload',
      note: '第一个 call 之后重新载入 %stack.0。这是 .0 的最后一条引用：refs=2，权重 2.0，区间在这里结束。',
      before,
      after: before,
      state: scanReload0,
      cursor: { line: reload0 },
      focus: ['- { id: 0, type: spill-slot, size: 8, alignment: 8 }'],
    },
    {
      title: '第 3 步 · 扫描 %stack.1 的 spill',
      note: '第二个 call 之前，%rcx 被溢出到 %stack.1。此时 .0 已经死亡；新区间从这条 store 开始，refs=1。',
      before,
      after: before,
      state: scanSpill1,
      cursor: { line: spill1 },
      focus: ['- { id: 1, type: spill-slot, size: 8, alignment: 8 }'],
    },
    {
      title: '第 4 步 · 扫描 %stack.1 的 reload',
      note: '第二个 call 之后载入 %stack.1，.1 的区间也结束。两个区间分处两个 call 两侧，互不重叠；扫描完成，处理顺序是 .0、.1。',
      before,
      after: before,
      state: scanReload1,
      cursor: { line: reload1 },
      focus: ['- { id: 1, type: spill-slot, size: 8, alignment: 8 }'],
    },
    {
      title: '第 5 步 · 给 .0 分配颜色',
      note: '按 frame index 顺序处理区间。.0 是第一个，颜色 0 还没有被占用；它直接拿颜色 0（也就是 %stack.0 自己）。这一步没有改写 MIR。',
      before,
      after: before,
      state: color0,
      cursor: { line: spill0 },
    },
    {
      title: '第 6 步 · 让 .1 共享颜色 0',
      note: '处理 .1 时，已用颜色只有 0。ColorSlot 检查 .1 和颜色 0 里的 .0 是否重叠：两者分处两个 call 两侧，没有交集，于是 .1 共享颜色 0。',
      before,
      after: before,
      state: color1,
      cursor: { line: spill1 },
    },
    {
      title: '第 7 步 · 改写 .1 的 store',
      note: 'SlotMapping 把 .1 的 store 改成颜色槽 %stack.0，MachineMemOperand 也一起改。这一步只处理这一条指令，所以 MIR 只变一行。',
      before,
      after: storeRewritten,
      state: rewriteStore,
      cursor: { line: spill1 },
    },
    {
      title: '第 8 步 · 改写 .1 的 reload 并回收对象',
      note: '最后一条 %stack.1 引用也改成 %stack.0。此后 .1 不再被任何指令使用，从 MachineFrameInfo 删除；stack 列表只剩 .0，frame 从 16 字节降到 8 字节。',
      before: storeRewritten,
      after: rewritten,
      state: rewriteLoad,
      cursor: { line: reload1 },
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Scan the spill into %stack.0',
          note: 'This instruction spills %rax to %stack.0. LiveStacks starts recording the live range of .0 at this store: refs=1 and one block-frequency-weighted spill weight.',
        },
        {
          title: 'Step 2 · Scan the reload of %stack.0',
          note: 'After the first call, %stack.0 is reloaded. This is the last reference of .0: refs=2, weight 2.0, and the interval ends here.',
        },
        {
          title: 'Step 3 · Scan the spill into %stack.1',
          note: 'Before the second call, %rcx is spilled to %stack.1. .0 is already dead; the new interval starts at this store with refs=1.',
        },
        {
          title: 'Step 4 · Scan the reload of %stack.1',
          note: 'After the second call, %stack.1 is reloaded and the interval of .1 ends too. The two intervals sit on opposite sides of the two calls and do not overlap; the scan is complete and the order is .0, .1.',
        },
        {
          title: 'Step 5 · Give .0 a color',
          note: 'Intervals are processed in frame-index order. .0 is first and color 0 is unused, so it takes color 0 — the frame index of %stack.0 itself. MIR is unchanged at this step.',
        },
        {
          title: 'Step 6 · Let .1 share color 0',
          note: 'When .1 is processed, the only used color is 0. ColorSlot checks whether .1 overlaps .0 in color 0: they sit on opposite sides of the two calls, so .1 shares color 0.',
        },
        {
          title: 'Step 7 · Rewrite the store of .1',
          note: 'SlotMapping rewrites the store of .1 to its color slot %stack.0 and updates the MachineMemOperand with it. This step processes one instruction, so exactly one MIR line changes.',
        },
        {
          title: 'Step 8 · Rewrite the reload and drop the object',
          note: 'The last %stack.1 reference becomes %stack.0 as well. Nothing uses .1 any more, so it is removed from MachineFrameInfo; the stack list keeps only .0 and the frame shrinks from 16 bytes to 8.',
        },
      ],
    },
  },
  { format: 'mir' },
);
