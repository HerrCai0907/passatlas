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

export const machineFunctionSplitterDemo = makeDemo(
  'machine-function-splitter',
  'machine-function-splitter · x86-64',
  [
    {
      title: '第 1 步 · profile 判出冷块',
      note: 'MFS 跑到这里时，寄存器分配、栈帧和 block placement 都已经完成。profile 里这个函数入口执行了 120 万次，bb.2.cold 只有 3 次；它已经被排到函数尾部，但仍然和热代码同属 .text.guard。',
      before,
      after: before,
      focus: ['bb.2.cold:', '$eax = MOV32ri -1'],
    },
    {
      title: '第 2 步 · 标进冷 section',
      note: 'MFS 只改 section 归属：bb.2.cold 被标成 bbsections Cold，MIR 里就多这一处标记，指令没动。AsmPrinter 会为它另开 .section .text.split.guard，并给冷区域一个 guard.cold 符号；链接器再把所有函数的冷 section 收在一起。',
      before,
      after: split,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · The profile finds the cold block',
          note: 'By the time MFS runs, register allocation, frame lowering and block placement are done. The profile gives the function entry 1,200,000 executions and bb.2.cold three; it already sits at the end of the function, but still shares .text.guard with the hot path.',
        },
        {
          title: 'Step 2 · Marked into the cold section',
          note: 'MFS changes only section membership: bb.2.cold becomes bbsections Cold, which is the single change in MIR — no instruction changes. AsmPrinter will open .section .text.split.guard for it and label the cold region guard.cold; the linker then collects every function’s cold sections together.',
        },
      ],
    },
  },
  { format: 'mir' },
);
