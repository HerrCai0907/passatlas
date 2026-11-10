import { makeDemo } from './types.ts';

const generic = `
---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $rdi, $esi
    %0:_(s64) = COPY $rdi
    %1:_(s32) = COPY $esi
    %2:_(s64) = G_SEXT %1
    %3:_(s32) = G_LOAD %0, %2
    %4:_(s32) = G_MUL %3, 3
    %5:_(s32) = G_ADD %4, 1
    $eax = COPY %5
    RET64 $eax
`;

const banked = `
---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $rdi, $esi
    %0:gpr(p0) = COPY $rdi
    %1:gpr(s32) = COPY $esi
    %2:gpr(s64) = G_SEXT %1
    %3:gpr(s32) = G_LOAD %0, %2
    %4:gpr(s32) = G_MUL %3, 3
    %5:gpr(s32) = G_ADD %4, 1
    $eax = COPY %5
    RET64 $eax
`;

const selected = `
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
`;

export const iselDemo = makeDemo(
  'isel',
  'isel · GlobalISel',
  [
    {
      title: '第 1 步 · 先选寄存器组，不选指令',
      note: 'G_* 还是目标无关的泛化指令，虚拟寄存器只有类型 `_(s64)`。regbankselect 给每个值选寄存器组（gpr），但还没有决定用 gr32 还是 gr64，也没有决定用哪条机器指令。',
      before: generic,
      after: banked,
      focus: ['%2:_(s64) = G_SEXT %1'],
    },
    {
      title: '第 2 步 · 泛化指令变成目标指令',
      note: 'instruction-select 把 G_SEXT / G_LOAD / G_MUL / G_ADD 换成 MOVSX64rr32、MOV32rm、LEA32r、INC32r。注意寻址模式被折进 MOV32rm，三个操作数的乘加被压成一条 LEA；寄存器类也从 gpr 细化为 gr32 / gr64。',
      before: banked,
      after: selected,
      focus: ['%3:gpr(s32) = G_LOAD %0, %2', '%4:gpr(s32) = G_MUL %3, 3', '%5:gpr(s32) = G_ADD %4, 1'],
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Choose register banks, not instructions yet',
          note: 'G_* operations are still target-independent and virtual registers only have types (`_(s64)`). regbankselect picks the gpr bank for each value, but has not chosen gr32 vs gr64 or any real machine instruction.',
        },
        {
          title: 'Step 2 · Generic operations become target instructions',
          note: 'instruction-select turns G_SEXT / G_LOAD / G_MUL / G_ADD into MOVSX64rr32, MOV32rm, LEA32r and INC32r. The addressing mode is folded into MOV32rm, the three-operand multiply-add collapses into one LEA, and classes narrow from gpr to gr32 / gr64.',
        },
      ],
    },
  },
  { format: 'mir' },
);
