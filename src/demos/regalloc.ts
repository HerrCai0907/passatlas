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

export const regallocDemo = makeDemo(
  'regalloc',
  'regalloc · x86-64',
  [
    {
      title: '第 1 步 · 先合并多余的 COPY',
      note: 'ISel 和两地址改写会留下 COPY。register-coalescer 发现 %2 和 %3 的活跃区间在 COPY 处首尾相接，直接把两个虚拟寄存器合并，COPY 消失；这一步不分配物理寄存器，只是减少后面的约束。',
      before,
      after: coalesced,
      focus: ['%3:gr32 = COPY %2'],
    },
    {
      title: '第 2 步 · greedy 决定，rewriter 落地',
      note: 'greedy 按 spill weight 处理这些区间：%0→$edi、%1→$esi、%4→$eax，%2 在 ADD 之后死亡，可以复用 $eax。virtregrewriter 把决定写成物理寄存器，并删掉所有 COPY。',
      before: coalesced,
      after: rewritten,
      focus: ['$eax = LEA32r $edi, 2, $esi, 0, _', '$eax = ADD32ri $eax, 1'],
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Coalesce redundant COPYs first',
          note: 'ISel and two-address rewriting leave COPYs behind. register-coalescer sees that the live ranges of %2 and %3 meet at the COPY and joins the two virtual registers, removing the COPY. This step does not assign physical registers; it only removes constraints before allocation.',
        },
        {
          title: 'Step 2 · greedy decides, the rewriter lands it',
          note: 'greedy processes these intervals by spill weight: %0→$edi, %1→$esi, %4→$eax, and %2 dies after the ADD so it can reuse $eax. virtregrewriter materialises those decisions as physical registers and removes every COPY.',
        },
      ],
    },
  },
  { format: 'mir' },
);
