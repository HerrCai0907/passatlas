import { makeDemo } from './types.ts';

const ssa = `
---
name: pick
tracksRegLiveness: true
body: |
  bb.0.entry:
    successors: %bb.1.then(32), %bb.2.else(32)
    liveins: $w0, $w1
    CBZW $w0, %bb.2.else
    B %bb.1.then
  bb.1.then:
    %0:gpr32 = MOVi32imm 1
    B %bb.3.merge
  bb.2.else:
    %1:gpr32 = MOVi32imm 2
    CBNZW $w1, %bb.3.merge
    B %bb.4.other
  bb.3.merge:
    %2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.2.else
    $w0 = COPY %2:gpr32
    RET_ReallyLR implicit $w0
  bb.4.other:
    %3:gpr32 = MOVi32imm 0
    $w0 = COPY %3:gpr32
    RET_ReallyLR implicit $w0
`;

const split = `
---
name: pick
tracksRegLiveness: true
body: |
  bb.0.entry:
    successors: %bb.1.then(32), %bb.2.else(32)
    liveins: $w0, $w1
    CBZW $w0, %bb.2.else
    B %bb.1.then
  bb.1.then:
    %0:gpr32 = MOVi32imm 1
    B %bb.3.merge
  bb.2.else:
    %1:gpr32 = MOVi32imm 2
    CBNZW $w1, %bb.5.crit
    B %bb.4.other
  bb.3.merge:
    %2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.5.crit
    $w0 = COPY %2:gpr32
    RET_ReallyLR implicit $w0
  bb.4.other:
    %3:gpr32 = MOVi32imm 0
    $w0 = COPY %3:gpr32
    RET_ReallyLR implicit $w0
  bb.5.crit:
    successors: %bb.3.merge
    B %bb.3.merge
`;

const copyThen = `
---
name: pick
tracksRegLiveness: true
body: |
  bb.0.entry:
    successors: %bb.1.then(32), %bb.2.else(32)
    liveins: $w0, $w1
    CBZW $w0, %bb.2.else
    B %bb.1.then
  bb.1.then:
    %0:gpr32 = MOVi32imm 1
    %2:gpr32 = COPY %0:gpr32
    B %bb.3.merge
  bb.2.else:
    %1:gpr32 = MOVi32imm 2
    CBNZW $w1, %bb.5.crit
    B %bb.4.other
  bb.3.merge:
    %2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.5.crit
    $w0 = COPY %2:gpr32
    RET_ReallyLR implicit $w0
  bb.4.other:
    %3:gpr32 = MOVi32imm 0
    $w0 = COPY %3:gpr32
    RET_ReallyLR implicit $w0
  bb.5.crit:
    successors: %bb.3.merge
    B %bb.3.merge
`;

const copyBoth = `
---
name: pick
tracksRegLiveness: true
body: |
  bb.0.entry:
    successors: %bb.1.then(32), %bb.2.else(32)
    liveins: $w0, $w1
    CBZW $w0, %bb.2.else
    B %bb.1.then
  bb.1.then:
    %0:gpr32 = MOVi32imm 1
    %2:gpr32 = COPY %0:gpr32
    B %bb.3.merge
  bb.2.else:
    %1:gpr32 = MOVi32imm 2
    CBNZW $w1, %bb.5.crit
    B %bb.4.other
  bb.3.merge:
    %2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.5.crit
    $w0 = COPY %2:gpr32
    RET_ReallyLR implicit $w0
  bb.4.other:
    %3:gpr32 = MOVi32imm 0
    $w0 = COPY %3:gpr32
    RET_ReallyLR implicit $w0
  bb.5.crit:
    successors: %bb.3.merge
    %2:gpr32 = COPY %1:gpr32
    B %bb.3.merge
`;

const lowered = `
---
name: pick
tracksRegLiveness: true
body: |
  bb.0.entry:
    successors: %bb.1.then(32), %bb.2.else(32)
    liveins: $w0, $w1
    CBZW $w0, %bb.2.else
    B %bb.1.then
  bb.1.then:
    %0:gpr32 = MOVi32imm 1
    %2:gpr32 = COPY %0:gpr32
    B %bb.3.merge
  bb.2.else:
    %1:gpr32 = MOVi32imm 2
    CBNZW $w1, %bb.5.crit
    B %bb.4.other
  bb.3.merge:
    $w0 = COPY %2:gpr32
    RET_ReallyLR implicit $w0
  bb.4.other:
    %3:gpr32 = MOVi32imm 0
    $w0 = COPY %3:gpr32
    RET_ReallyLR implicit $w0
  bb.5.crit:
    successors: %bb.3.merge
    %2:gpr32 = COPY %1:gpr32
    B %bb.3.merge
`;

const observed = [
  'phi     %2 in bb.3.merge',
  'in      %0 <- bb.1.then',
  '        %1 <- bb.2.else',
  'copies  then -   else -',
].join('\n');

const critical = [
  'edge    bb.2.else -> bb.3.merge',
  'succ    2 (merge, other)',
  'pred    2 (then, else)',
  'critical yes',
].join('\n');

const splitState = [
  'edge    else -> merge split',
  'crit    bb.5.crit created',
  'phi in  %1 <- bb.5.crit',
  'copies  then -   crit -',
].join('\n');

const thenCopy = [
  'phi in  %0 <- bb.1.then',
  '        %1 <- bb.5.crit',
  'copies  then %2 = COPY %0',
  'phi     still present',
].join('\n');

const bothCopies = [
  'phi in  %0 <- bb.1.then',
  '        %1 <- bb.5.crit',
  'copies  then %2 = COPY %0',
  '        crit %2 = COPY %1',
  'phi     still present',
].join('\n');

const removed = [
  'phi     removed',
  '%2      defined in then and crit',
  'copies  2 (one per predecessor)',
].join('\n');

export const phiElimDemo = makeDemo(
  'phi-elim',
  'phi-node-elimination · AArch64',
  [
    {
      title: '第 1 步 · 读出 PHI 的每个入边',
      note: 'PHI 在 merge 汇集两个值：来自 then 的 %0 和来自 else 的 %1，目标都是 %2。phi-node-elimination 先把这张「前驱 → 值」的表记下来，后面每一步只处理一对。',
      before: ssa,
      after: ssa,
      cursor: { line: '%2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.2.else' },
      focus: ['%2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.2.else'],
      state: observed,
    },
    {
      title: '第 2 步 · 发现 else→merge 是 critical edge',
      note: 'bb.2.else 有两条出边（merge 和 other），bb.3.merge 有两个前驱（then 和 else）。如果把 COPY 直接塞进 else 的末尾，它也会作用到去 other 的路径上——这就是 critical edge，复制不能原地放。',
      before: ssa,
      after: ssa,
      cursor: { line: 'CBNZW $w1, %bb.3.merge' },
      focus: ['CBNZW $w1, %bb.3.merge'],
      state: critical,
    },
    {
      title: '第 3 步 · 拆出一条只负责跳转的边',
      note: 'PHI elimination 为 else→merge 新建 bb.5.crit，把 CBNZW 的目标改到 crit，并更新 PHI 的入边。crit 只有一个前驱和一个后继，COPY 放进去不会影响别的路径。演示用 -phi-elim-split-all-critical-edges=1 强制拆边。',
      before: ssa,
      after: split,
      cursor: { line: 'CBNZW $w1, %bb.3.merge' },
      focus: ['CBNZW $w1, %bb.5.crit', 'bb.5.crit:'],
      state: splitState,
    },
    {
      title: '第 4 步 · 在 then 的末尾写 COPY',
      note: 'then 只有一个后继，不需要拆边。在跳去 merge 之前插入 %2 = COPY %0，把这条路径上的值搬进 PHI 的目标虚拟寄存器。此时 PHI 还在，函数仍是 SSA。',
      before: split,
      after: copyThen,
      cursor: { line: '%2:gpr32 = COPY %0:gpr32', side: 'after' },
      focus: ['%2:gpr32 = COPY %0:gpr32'],
      state: thenCopy,
    },
    {
      title: '第 5 步 · 在 crit 里写第二条 COPY',
      note: 'crit 里插入 %2 = COPY %1。现在两条前驱路径都会在离开前定义 %2；注意这是同一虚拟寄存器在两个块里各定义一次，函数已经不再是 SSA。',
      before: copyThen,
      after: copyBoth,
      cursor: { line: '%2:gpr32 = COPY %1:gpr32', side: 'after' },
      focus: ['%2:gpr32 = COPY %1:gpr32'],
      state: bothCopies,
    },
    {
      title: '第 6 步 · 删除 PHI',
      note: 'PHI 本身不是机器指令，AArch64 也没有 φ。两条 COPY 都就位后，PHI 被删除，merge 里只剩对 %2 的普通使用；寄存器分配第一次看到「同一虚拟寄存器有多个定义」的普通 MIR。',
      before: copyBoth,
      after: lowered,
      cursor: { line: '%2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.5.crit' },
      state: removed,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Read the incoming edges of the PHI',
          note: 'The PHI joins two values at merge: %0 from then and %1 from else, both targeting %2. phi-node-elimination starts by recording this predecessor → value table; each later step handles one pair only.',
        },
        {
          title: 'Step 2 · else→merge is a critical edge',
          note: 'bb.2.else has two successors (merge and other) and bb.3.merge has two predecessors (then and else). A COPY appended to else would also run on the path to other — that is a critical edge, so the copy cannot simply go there.',
        },
        {
          title: 'Step 3 · Split off a jump-only edge block',
          note: 'PHI elimination creates bb.5.crit for else→merge, retargets CBNZW to crit, and updates the PHI incoming edge. crit has one predecessor and one successor, so a COPY placed inside it affects no other path. The demo forces this with -phi-elim-split-all-critical-edges=1.',
        },
        {
          title: 'Step 4 · Write a COPY at the end of then',
          note: 'then has a single successor, so no edge splitting is needed. Insert %2 = COPY %0 before the branch to merge, moving the value on this path into the PHI destination virtual register. The PHI is still there and the function is still SSA.',
        },
        {
          title: 'Step 5 · Write the second COPY in crit',
          note: 'Insert %2 = COPY %1 in crit. Both predecessor paths now define %2 before leaving; the same virtual register is defined twice in two blocks, so the function is no longer SSA.',
        },
        {
          title: 'Step 6 · Delete the PHI',
          note: 'A PHI is not a machine instruction and AArch64 has no φ. With both COPYs in place the PHI is deleted and merge keeps only an ordinary use of %2; register allocation now sees normal MIR where one virtual register has several definitions.',
        },
      ],
    },
  },
  { format: 'mir' },
);
