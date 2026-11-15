import { makeDemo } from './types.ts';

const before = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    %0:gr32 = COPY $edi
    %1:gr32 = COPY $esi
    %2:gr32 = LEA32r %0, 2, %1, 0, _
    %3:gr32 = COPY %2
    %4:gr32 = ADD32ri %3, 1
    $eax = COPY %4
    RET64 $eax
`;

const coalesced = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    %0:gr32 = COPY $edi
    %1:gr32 = COPY $esi
    %2:gr32 = LEA32r %0, 2, %1, 0, _
    %4:gr32 = ADD32ri %2, 1
    $eax = COPY %4
    RET64 $eax
`;

const copyRemoved = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    %0:gr32 = COPY $edi
    %1:gr32 = COPY $esi
    %2:gr32 = LEA32r %0, 2, %1, 0, _
    %4:gr32 = ADD32ri %2, 1
    RET64 $eax
`;

const addRewritten = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    %0:gr32 = COPY $edi
    %1:gr32 = COPY $esi
    %2:gr32 = LEA32r %0, 2, %1, 0, _
    $eax = ADD32ri $eax, 1
    RET64 $eax
`;

const leaRewritten = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    %0:gr32 = COPY $edi
    %1:gr32 = COPY $esi
    $eax = LEA32r $edi, 2, $esi, 0, _
    $eax = ADD32ri $eax, 1
    RET64 $eax
`;

const noZero = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    %1:gr32 = COPY $esi
    $eax = LEA32r $edi, 2, $esi, 0, _
    $eax = ADD32ri $eax, 1
    RET64 $eax
`;

const rewritten = `
---
name: lea
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $edi, $esi
    $eax = LEA32r $edi, 2, $esi, 0, _
    $eax = ADD32ri $eax, 1
    RET64 $eax
`;

const intervals = [
  'vreg  interval  weight  reg',
  '%0    [0,2]     1.0     -',
  '%1    [1,2]     1.0     -',
  '%2    [2,3]     3.0     -',
  '%3    [3,4]     3.0     -',
  '%4    [4,5]     2.0     -',
].join('\n');

const ordered = [
  'vreg  interval  weight  reg',
  '%2    [2,3]     3.0     -',
  '%3    [3,4]     3.0     -',
  '%4    [4,5]     2.0     -',
  '%0    [0,2]     1.0     -',
  '%1    [1,2]     1.0     -',
].join('\n');

const merged = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     -',
  '%1     [1,2]     1.0     -',
  '%2/%3  [2,4]     3.0     -',
  '%4     [4,5]     2.0     -',
  'coalesced: %3 -> %2',
].join('\n');

const color2 = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     -',
  '%1     [1,2]     1.0     -',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     -',
].join('\n');

const color4 = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     -',
  '%1     [1,2]     1.0     -',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax (share %2/%3)',
].join('\n');

const color0 = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi (pinned by COPY)',
  '%1     [1,2]     1.0     -',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax (share %2/%3)',
].join('\n');

const color1 = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi (pinned by COPY)',
  '%1     [1,2]     1.0     $esi (pinned by COPY)',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax (share %2/%3)',
].join('\n');

const rewriteAdd = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi',
  '%1     [1,2]     1.0     $esi',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax',
  'rewriter  ADD operands physical',
].join('\n');

const rewriteCopy = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi',
  '%1     [1,2]     1.0     $esi',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax',
  'rewriter  removed $eax = COPY %4',
].join('\n');

const rewriteLea = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi',
  '%1     [1,2]     1.0     $esi',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax',
  'rewriter  LEA operands physical',
].join('\n');

const rewriteZero = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi',
  '%1     [1,2]     1.0     $esi',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax',
  'rewriter  removed %0 = COPY $edi',
].join('\n');

const rewriteOne = [
  'vreg   interval  weight  reg',
  '%0     [0,2]     1.0     $edi',
  '%1     [1,2]     1.0     $esi',
  '%2/%3  [2,4]     3.0     $eax',
  '%4     [4,5]     2.0     $eax',
  'rewriter  removed %1 = COPY $esi',
].join('\n');

export const regallocDemo = makeDemo(
  'regalloc',
  'regalloc · x86-64',
  [
    {
      title: '第 1 步 · 算出每个虚拟寄存器的活跃区间',
      note: 'LiveIntervals 为每个虚拟寄存器建区间：%0 从 COPY $edi 活到 LEA，%2 从 LEA 活到 ADD，%4 从 ADD 活到最后的 COPY。区间端点决定谁和谁不能共用物理寄存器。',
      before,
      after: before,
      cursor: { line: '%0:gr32 = COPY $edi' },
      focus: ['%0:gr32 = COPY $edi'],
      state: intervals,
    },
    {
      title: '第 2 步 · 按 spill weight 排序',
      note: 'greedy 不按块内顺序分配，而是优先处理最「贵」的区间。%2 和 %3 权重最高，%4 次之，来自参数的 %0、%1 最简单。这个顺序决定谁先挑寄存器。',
      before,
      after: before,
      cursor: { line: '%2:gr32 = LEA32r %0, 2, %1, 0, _' },
      focus: ['%2:gr32 = LEA32r %0, 2, %1, 0, _'],
      state: ordered,
    },
    {
      title: '第 3 步 · 在 COPY 处合并 %2 和 %3',
      note: 'register-coalescer 发现 %2 和 %3 的区间在 `%3 = COPY %2` 处首尾相接，把它们合并成一个区间，COPY 消失，ADD 改成直接用 %2。合并减少一次复制，也让后面的约束更简单。',
      before,
      after: coalesced,
      cursor: { line: '%3:gr32 = COPY %2' },
      focus: ['%3:gr32 = COPY %2'],
      state: merged,
    },
    {
      title: '第 4 步 · 把 %2/%3 分到 $eax',
      note: '合并后的区间是当前最重的，$eax 空闲，直接给它。此时还不改写 MIR，greedy 只在内部记录「这个区间属于 $eax」。',
      before: coalesced,
      after: coalesced,
      cursor: { line: '%2:gr32 = LEA32r %0, 2, %1, 0, _' },
      focus: ['%2:gr32 = LEA32r %0, 2, %1, 0, _'],
      state: color2,
    },
    {
      title: '第 5 步 · %4 复用 $eax',
      note: '%4 的区间从 ADD 开始，而 %2/%3 的区间在 ADD 处结束：终点和起点相接，不算重叠。ADD 是两地址指令，结果写回同一个寄存器，所以 %4 直接复用 $eax，不需要新寄存器。',
      before: coalesced,
      after: coalesced,
      cursor: { line: '%4:gr32 = ADD32ri %2, 1' },
      focus: ['%4:gr32 = ADD32ri %2, 1'],
      state: color4,
    },
    {
      title: '第 6 步 · %0 被 COPY 固定在 $edi',
      note: '%0 来自 `COPY $edi`，它可以直接用 $edi，省掉一次复制。greedy 优先尊重这种来自 ABI 的固定约束，而不是另选一个空闲寄存器。',
      before: coalesced,
      after: coalesced,
      cursor: { line: '%0:gr32 = COPY $edi' },
      focus: ['%0:gr32 = COPY $edi'],
      state: color0,
    },
    {
      title: '第 7 步 · %1 被 COPY 固定在 $esi',
      note: '%1 同理落在 $esi。到这里四个虚拟寄存器都有物理寄存器，greedy 的决策结束，接下来交给 virtregrewriter 把这些决定写进 MIR。',
      before: coalesced,
      after: coalesced,
      cursor: { line: '%1:gr32 = COPY $esi' },
      focus: ['%1:gr32 = COPY $esi'],
      state: color1,
    },
    {
      title: '第 8 步 · 删掉多余的 `$eax = COPY %4`',
      note: 'ADD 的结果 %4 已经分配在 $eax，再把它 COPY 给 $eax 没有作用，rewriter 先删除这条自复制。',
      before: coalesced,
      after: copyRemoved,
      cursor: { line: '$eax = COPY %4' },
      state: rewriteCopy,
    },
    {
      title: '第 9 步 · 改写 ADD 的操作数',
      note: 'virtregrewriter 按决定替换虚拟寄存器。ADD 的源 %2 和结果 %4 都映射到 $eax，于是这条两地址指令变成 `$eax = ADD32ri $eax, 1`。改写是逐条进行的，所以这一步只动 ADD。',
      before: copyRemoved,
      after: addRewritten,
      cursor: { line: '%4:gr32 = ADD32ri %2, 1' },
      focus: ['$eax = ADD32ri $eax, 1'],
      state: rewriteAdd,
    },
    {
      title: '第 10 步 · 改写 LEA 并消掉两个虚拟操作数',
      note: 'LEA 的结果 %2 和两个源 %0、%1 都换成了物理寄存器：`$eax = LEA32r $edi, 2, $esi, 0, _`。注意 %0、%1 的 COPY 还在，但它们已经没有人使用。',
      before: addRewritten,
      after: leaRewritten,
      cursor: { line: '%2:gr32 = LEA32r %0, 2, %1, 0, _' },
      focus: ['$eax = LEA32r $edi, 2, $esi, 0, _'],
      state: rewriteLea,
    },
    {
      title: '第 11 步 · 删除 `%0 = COPY $edi`',
      note: 'LEA 现在直接用 $edi，%0 的 COPY 变成死指令。它本来就是一次冗余复制，删除后块里少一条指令。',
      before: leaRewritten,
      after: noZero,
      cursor: { line: '%0:gr32 = COPY $edi' },
      state: rewriteZero,
    },
    {
      title: '第 12 步 · 删除 `%1 = COPY $esi`，分配落地',
      note: '最后删掉 %1 的 COPY。块里只剩 LEA、ADD 和 RET，全部使用物理寄存器；spill 一个都没有发生。',
      before: noZero,
      after: rewritten,
      cursor: { line: '%1:gr32 = COPY $esi' },
      focus: ['$eax = LEA32r $edi, 2, $esi, 0, _', '$eax = ADD32ri $eax, 1'],
      state: rewriteOne,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Compute the live interval of every virtual register',
          note: 'LiveIntervals builds an interval per virtual register: %0 lives from COPY $edi to LEA, %2 from LEA to ADD, %4 from ADD to the final COPY. The endpoints decide which values can share a physical register.',
        },
        {
          title: 'Step 2 · Sort by spill weight',
          note: 'greedy does not allocate in block order; it handles the most expensive intervals first. %2 and %3 have the highest weight, %4 is next, and the argument copies %0 and %1 are the simplest. This order decides who picks a register first.',
        },
        {
          title: 'Step 3 · Coalesce %2 and %3 at the COPY',
          note: 'register-coalescer sees that the intervals of %2 and %3 meet at `%3 = COPY %2`, joins them into one interval, removes the COPY, and rewrites ADD to use %2 directly. Coalescing removes one copy and simplifies later constraints.',
        },
        {
          title: 'Step 4 · Assign %2/%3 to $eax',
          note: 'The merged interval is the heaviest and $eax is free, so it gets $eax. MIR is not rewritten yet; greedy only records that this interval owns $eax.',
        },
        {
          title: 'Step 5 · %4 reuses $eax',
          note: 'The interval of %4 starts at ADD while the interval of %2/%3 ends there: touching endpoints do not overlap. ADD is a two-address instruction and writes its result back to the same register, so %4 reuses $eax without a new register.',
        },
        {
          title: 'Step 6 · The COPY pins %0 to $edi',
          note: '%0 comes from `COPY $edi`, so it can simply use $edi and save a copy. greedy honours this ABI-style fixed constraint instead of picking another free register.',
        },
        {
          title: 'Step 7 · The COPY pins %1 to $esi',
          note: '%1 lands in $esi for the same reason. All four virtual registers now have a physical register; greedy is done and virtregrewriter will write the decisions into MIR.',
        },
        {
          title: 'Step 8 · Remove the redundant `$eax = COPY %4`',
          note: 'The result %4 of ADD is already allocated to $eax, so copying it to $eax does nothing; the rewriter deletes the self-copy first.',
        },
        {
          title: 'Step 9 · Rewrite the operands of ADD',
          note: 'virtregrewriter replaces virtual registers according to the decisions. Both the source %2 and the result %4 of ADD map to $eax, so the two-address instruction becomes `$eax = ADD32ri $eax, 1`. Rewriting is per instruction, so only ADD changes here.',
        },
        {
          title: 'Step 10 · Rewrite LEA and drop both virtual operands',
          note: 'The result %2 and both sources %0 and %1 of LEA become physical: `$eax = LEA32r $edi, 2, $esi, 0, _`. The %0 and %1 COPYs are still present, but nothing uses them any more.',
        },
        {
          title: 'Step 11 · Delete `%0 = COPY $edi`',
          note: 'LEA now uses $edi directly, so the COPY of %0 is dead. It was a redundant copy to begin with, and the block loses one instruction.',
        },
        {
          title: 'Step 12 · Delete `%1 = COPY $esi` and land the allocation',
          note: 'Delete the last COPY. The block is left with LEA, ADD and RET, all using physical registers, and no spill occurred.',
        },
      ],
    },
  },
  { format: 'mir' },
);
