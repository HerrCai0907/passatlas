import { makeDemo } from './types.ts';

const before = `
---
name: guard
tracksRegLiveness: true
body: |
  bb.0.entry:
    liveins: $edi
    CMP32ri $edi, 0, implicit-def $eflags
    JCC_1 %bb.2.cold, 14, implicit $eflags
  bb.1.hot:
    $eax = MOV32rr $edi
    RET64 $eax
  bb.2.cold:
    $eax = MOV32ri -1
    RET64 $eax
`;

const split = `
---
name: guard
tracksRegLiveness: true
body: |
  bb.0.entry:
    liveins: $edi
    CMP32ri $edi, 0, implicit-def $eflags
    JCC_1 %bb.2.cold, 14, implicit $eflags
  bb.1.hot:
    $eax = MOV32rr $edi
    RET64 $eax
  bb.2.cold (bbsections Cold):
    $eax = MOV32ri -1
    RET64 $eax
`;

const profile = [
  'block   count      freq',
  'entry   1200000    1.0',
  'hot     1199997    1.0',
  'cold    3          0.0000025',
].join('\n');

const decision = [
  'block   count      decision',
  'entry   1200000    hot',
  'hot     1199997    hot',
  'cold    3          cold -> split',
].join('\n');

const marked = [
  'section  bb.2.cold -> Cold',
  'hot      bb.0.entry bb.1.hot',
  'split    yes',
].join('\n');

const outlined = [
  'section  .text.split.guard',
  'symbol   guard.cold',
  'layout   cold blocks collected by the linker',
].join('\n');

export const machineFunctionSplitterDemo = makeDemo(
  'machine-function-splitter',
  'machine-function-splitter · x86-64',
  [
    {
      title: '第 1 步 · 读 profile，给每个块算执行次数',
      note: 'MFS 跑到这里时，寄存器分配、栈帧和 block placement 都已经完成。profile 给出函数入口 120 万次、热路径几乎相同、bb.2.cold 只有 3 次——冷块已经被排到函数尾部，但仍然和热代码同属 .text.guard。',
      before,
      after: before,
      cursor: { line: 'CMP32ri $edi, 0, implicit-def $eflags' },
      focus: ['CMP32ri $edi, 0, implicit-def $eflags'],
      state: profile,
    },
    {
      title: '第 2 步 · 把 bb.2.cold 判成冷块',
      note: '判断依据是块的执行频率相对函数入口的比例。3 / 1200000 约等于 2.5e-6，远低于冷阈值；JCC 仍然指向这个块，但 MFS 已经决定让它离开热 section。',
      before,
      after: before,
      cursor: { line: 'JCC_1 %bb.2.cold, 14, implicit $eflags' },
      focus: ['JCC_1 %bb.2.cold, 14, implicit $eflags'],
      state: decision,
    },
    {
      title: '第 3 步 · 给冷块打上 bbsections Cold',
      note: 'MFS 只改 section 归属：bb.2.cold 被标成 `bbsections Cold`，指令一条没动。这是 MIR 里唯一的变化，后面的 AsmPrinter 才会据此切换 section。',
      before,
      after: split,
      cursor: { line: 'bb.2.cold:' },
      focus: ['bb.2.cold (bbsections Cold):'],
      state: marked,
    },
    {
      title: '第 4 步 · AsmPrinter 把冷块放进独立 section',
      note: 'AsmPrinter 为带 Cold 标记的块另开 `.section .text.split.guard`，并给冷区域一个 `guard.cold` 符号；链接器再把所有函数的冷 section 收到一起。热路径因此更紧凑，i-cache 和 iTLB 都更友好。',
      before: split,
      after: split,
      cursor: { line: '$eax = MOV32ri -1' },
      focus: ['bb.2.cold (bbsections Cold):', '$eax = MOV32ri -1'],
      state: outlined,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Read the profile and count each block',
          note: 'By the time MFS runs, register allocation, frame lowering and block placement are done. The profile gives the function entry 1,200,000 executions, the hot path almost the same, and bb.2.cold just 3; the cold block already sits at the end of the function but still shares .text.guard with the hot code.',
        },
        {
          title: 'Step 2 · Classify bb.2.cold as cold',
          note: 'The decision compares a block’s execution frequency with the function entry. 3 / 1,200,000 is about 2.5e-6, far below the cold threshold; JCC still targets the block, but MFS has decided it should leave the hot section.',
        },
        {
          title: 'Step 3 · Mark the cold block with bbsections Cold',
          note: 'MFS changes only section membership: bb.2.cold gets `bbsections Cold` and no instruction changes. This is the single MIR difference; AsmPrinter uses it to switch sections later.',
        },
        {
          title: 'Step 4 · AsmPrinter emits the cold block into its own section',
          note: 'AsmPrinter opens `.section .text.split.guard` for blocks marked Cold and gives the cold region a `guard.cold` symbol; the linker then collects every function’s cold sections together. The hot path becomes tighter, which is friendlier to the i-cache and iTLB.',
        },
      ],
    },
  },
  { format: 'mir' },
);
