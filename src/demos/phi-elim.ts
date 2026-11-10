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

export const phiElimDemo = makeDemo(
  'phi-elim',
  'phi-node-elimination · AArch64',
  [
    {
      title: '第 1 步 · 先拆 critical edge',
      note: 'bb.2.else 有两条出边，bb.3.merge 有两个前驱，所以 else→merge 是 critical edge。把复制直接塞进 else，会同时作用于去 bb.4.other 的路径。PHI elimination 在复制可能和另一条路径冲突时会拆边；这里用 -phi-elim-split-all-critical-edges=1 强制演示，拆出一个只负责跳转的 bb.5.crit，并更新 PHI 的入边。',
      before: ssa,
      after: split,
      focus: ['%2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.2.else'],
    },
    {
      title: '第 2 步 · φ 变成前驱里的 COPY',
      note: 'PHI 指令本身不是机器指令，AArch64 也没有 φ。它被删除，每个前驱在离开前把对应值复制到同一个目标虚拟寄存器 %2；merge 只剩一个普通使用。此时函数不再是 SSA：%2 在两个基本块里各自定义一次。',
      before: split,
      after: lowered,
      focus: ['%2:gpr32 = PHI %0:gpr32, %bb.1.then, %1:gpr32, %bb.5.crit'],
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Split the critical edge first',
          note: 'bb.2.else has two successors and bb.3.merge has two predecessors, so else→merge is a critical edge. A copy placed directly in else would also affect the path to bb.4.other. PHI elimination splits the edge when the copy could conflict with another path; this demo forces it with -phi-elim-split-all-critical-edges=1, creating a jump-only bb.5.crit and rewriting the PHI incoming edge.',
        },
        {
          title: 'Step 2 · PHIs become COPYs in predecessors',
          note: 'A PHI is not a machine instruction and AArch64 has no φ. It is deleted, and each predecessor copies its value into the same destination virtual register %2 before leaving; merge now has an ordinary use. The function is no longer SSA: %2 is defined once in two different blocks.',
        },
      ],
    },
  },
  { format: 'mir' },
);
