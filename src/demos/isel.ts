import { makeDemo } from './types.ts';

const header = `---
name: scale
tracksRegLiveness: true
body: |
  bb.0:
    liveins: $rdi, $esi
`;

const generic = `${header}    %0:_(s64) = COPY $rdi
    %1:_(s32) = COPY $esi
    %2:_(s64) = G_SEXT %1
    %3:_(s32) = G_LOAD %0, %2
    %4:_(s32) = G_MUL %3, 3
    %5:_(s32) = G_ADD %4, 1
    $eax = COPY %5
    RET64 $eax
`;

const swap = (text: string, from: string, to: string): string => {
  if (!text.includes(from)) throw new Error(`[isel demo] missing line: ${from}`);
  return text.replace(from, to);
};

const bank0 = swap(generic, '%0:_(s64) = COPY $rdi', '%0:gpr(p0) = COPY $rdi');
const bank1 = swap(bank0, '%1:_(s32) = COPY $esi', '%1:gpr(s32) = COPY $esi');
const bank2 = swap(bank1, '%2:_(s64) = G_SEXT %1', '%2:gpr(s64) = G_SEXT %1');
const bank3 = swap(bank2, '%3:_(s32) = G_LOAD %0, %2', '%3:gpr(s32) = G_LOAD %0, %2');
const bank4 = swap(bank3, '%4:_(s32) = G_MUL %3, 3', '%4:gpr(s32) = G_MUL %3, 3');
const bank5 = bank4;
const banked = swap(bank5, '%5:_(s32) = G_ADD %4, 1', '%5:gpr(s32) = G_ADD %4, 1');

const copy0 = swap(banked, '%0:gpr(p0) = COPY $rdi', '%0:gr64 = COPY $rdi');
const copy1 = swap(copy0, '%1:gpr(s32) = COPY $esi', '%1:gr32 = COPY $esi');
const sext = swap(copy1, '%2:gpr(s64) = G_SEXT %1', '%2:gr64 = MOVSX64rr32 %1');
const load = swap(sext, '%3:gpr(s32) = G_LOAD %0, %2', '%3:gr32 = MOV32rm %0, 4, %2, 0, _');
const mul = swap(load, '%4:gpr(s32) = G_MUL %3, 3', '%4:gr32 = LEA32r %3, 2, %3, 0, _');
const selected = swap(mul, '%5:gpr(s32) = G_ADD %4, 1', '%5:gr32 = INC32r %4, implicit-def dead $eflags');

const vregs = [
  { reg: '%0', type: 'p0', original: 'COPY $rdi' },
  { reg: '%1', type: 's32', original: 'COPY $esi' },
  { reg: '%2', type: 's64', original: 'G_SEXT' },
  { reg: '%3', type: 's32', original: 'G_LOAD' },
  { reg: '%4', type: 's32', original: 'G_MUL' },
  { reg: '%5', type: 's32', original: 'G_ADD' },
];

const render = (bank: Record<string, string>, selected: Record<string, string>): string =>
  [
    'vreg  type  bank  selected',
    ...vregs.map(
      (v) =>
        `${v.reg.padEnd(5)} ${v.type.padEnd(5)} ${(bank[v.reg] ?? '-').padEnd(5)} ${selected[v.reg] ?? v.original}`,
    ),
  ].join('\n');

const bank = (patch: Record<string, string>): Record<string, string> => patch;
const sel = (patch: Record<string, string>): Record<string, string> => patch;

const state1 = render(bank({ '%0': 'gpr' }), sel({}));
const state2 = render(bank({ '%0': 'gpr', '%1': 'gpr' }), sel({}));
const state3 = render(bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr' }), sel({}));
const state4 = render(bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr' }), sel({}));
const state5 = render(bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr' }), sel({}));
const state6 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({}),
);
const state7 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({ '%0': 'gr64' }),
);
const state8 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({ '%0': 'gr64', '%1': 'gr32' }),
);
const state9 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({ '%0': 'gr64', '%1': 'gr32', '%2': 'MOVSX64rr32' }),
);
const state10 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({ '%0': 'gr64', '%1': 'gr32', '%2': 'MOVSX64rr32', '%3': 'MOV32rm' }),
);
const state11 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({ '%0': 'gr64', '%1': 'gr32', '%2': 'MOVSX64rr32', '%3': 'MOV32rm', '%4': 'LEA32r' }),
);
const state12 = render(
  bank({ '%0': 'gpr', '%1': 'gpr', '%2': 'gpr', '%3': 'gpr', '%4': 'gpr', '%5': 'gpr' }),
  sel({
    '%0': 'gr64',
    '%1': 'gr32',
    '%2': 'MOVSX64rr32',
    '%3': 'MOV32rm',
    '%4': 'LEA32r',
    '%5': 'INC32r',
  }),
);

export const iselDemo = makeDemo(
  'isel',
  'isel · GlobalISel',
  [
    {
      title: '第 1 步 · 给指针值 %0 选寄存器组',
      note: 'G_* 还是 target-independent 指令，虚拟寄存器只有类型 `_(s64)`。regbankselect 先给 %0 选 gpr；`p0` 表示它是指针类型的 64 位值。此时还没有决定指令。',
      before: generic,
      after: bank0,
      cursor: { line: '%0:_(s64) = COPY $rdi' },
      focus: ['%0:gpr(p0) = COPY $rdi'],
      state: state1,
    },
    {
      title: '第 2 步 · 给 %1 选 gpr',
      note: '%1 来自 $esi，是 32 位标量，同样落在 gpr。寄存器组是一个粗粒度的划分，gpr 里还可以是 gr32 或 gr64。',
      before: bank0,
      after: bank1,
      cursor: { line: '%1:_(s32) = COPY $esi' },
      focus: ['%1:gpr(s32) = COPY $esi'],
      state: state2,
    },
    {
      title: '第 3 步 · 给 %2 选 gpr',
      note: '%2 是 G_SEXT 的 64 位结果，也放在 gpr。G_SEXT 的操作数 %1 是 32 位，bank 选择只保证两者属于同一个寄存器组，具体宽度要到 instruction-select 才定。',
      before: bank1,
      after: bank2,
      cursor: { line: '%2:_(s64) = G_SEXT %1' },
      focus: ['%2:gpr(s64) = G_SEXT %1'],
      state: state3,
    },
    {
      title: '第 4 步 · 给 %3 选 gpr',
      note: 'G_LOAD 的结果是 32 位值，也进 gpr；指针操作数 %0 已经在 gpr 里。到这里还没有任何真实机器指令，MIR 只多了寄存器组标注。',
      before: bank2,
      after: bank3,
      cursor: { line: '%3:_(s32) = G_LOAD %0, %2' },
      focus: ['%3:gpr(s32) = G_LOAD %0, %2'],
      state: state4,
    },
    {
      title: '第 5 步 · 给 %4 选 gpr',
      note: '%4 = G_MUL %3, 3 是纯标量运算，gpr 是唯一合理的选择。注意 G_MUL 还没有变成 LEA：寄存器组不等于指令。',
      before: bank3,
      after: bank4,
      cursor: { line: '%4:_(s32) = G_MUL %3, 3' },
      focus: ['%4:gpr(s32) = G_MUL %3, 3'],
      state: state5,
    },
    {
      title: '第 6 步 · 给 %5 选 gpr，寄存器组完成',
      note: '最后一个值 %5 也进 gpr。六个虚拟寄存器都有了寄存器组，regbankselect 结束；接下来 instruction-select 才把每条 G_* 换成目标指令。',
      before: bank4,
      after: banked,
      cursor: { line: '%5:_(s32) = G_ADD %4, 1' },
      focus: ['%5:gpr(s32) = G_ADD %4, 1'],
      state: state6,
    },
    {
      title: '第 7 步 · 选 COPY $rdi，类收窄到 gr64',
      note: 'COPY 本来就是机器指令，instruction-select 只需把寄存器类从 gpr 收窄成 gr64。物理寄存器 $rdi 是 64 位，所以 %0 定为 gr64。',
      before: banked,
      after: copy0,
      cursor: { line: '%0:gpr(p0) = COPY $rdi' },
      focus: ['%0:gr64 = COPY $rdi'],
      state: state7,
    },
    {
      title: '第 8 步 · 选 COPY $esi，类收窄到 gr32',
      note: '同理，%1 从 $esi 复制，收窄到 gr32。两个参数搬移指令已经就位，剩下的 G_* 还等着选择。',
      before: copy0,
      after: copy1,
      cursor: { line: '%1:gpr(s32) = COPY $esi' },
      focus: ['%1:gr32 = COPY $esi'],
      state: state8,
    },
    {
      title: '第 9 步 · G_SEXT 变成 MOVSX64rr32',
      note: '把 32 位的 %1 符号扩展到 64 位，x86-64 的对应指令是 MOVSX64rr32。G_SEXT 的语义被一条目标指令完整覆盖。',
      before: copy1,
      after: sext,
      cursor: { line: '%2:gpr(s64) = G_SEXT %1' },
      focus: ['%2:gr64 = MOVSX64rr32 %1'],
      state: state9,
    },
    {
      title: '第 10 步 · G_LOAD 变成带寻址模式的 MOV32rm',
      note: 'G_LOAD 的地址是 %0 + 4 * %2。x86 的 MOV32rm 能直接表达 base + index*scale + disp，于是寻址模式被折进这一条指令，不需要单独的地址计算。',
      before: sext,
      after: load,
      cursor: { line: '%3:gpr(s32) = G_LOAD %0, %2' },
      focus: ['%3:gr32 = MOV32rm %0, 4, %2, 0, _'],
      state: state10,
    },
    {
      title: '第 11 步 · G_MUL 变成 LEA32r',
      note: '%4 = %3 * 3。x86 的 LEA 可以算 base + index*scale，取 %3 作 base、%3 作 index、scale 2，就得到 3 * %3；一条 LEA 替代乘法，还绕开了乘法端口。',
      before: load,
      after: mul,
      cursor: { line: '%4:gpr(s32) = G_MUL %3, 3' },
      focus: ['%4:gr32 = LEA32r %3, 2, %3, 0, _'],
      state: state11,
    },
    {
      title: '第 12 步 · G_ADD 1 变成 INC32r',
      note: '加 1 有专门的 INC32r，比通用 ADD 更短；implicit-def dead $eflags 表示标志位结果没人使用，可以丢弃。至此所有泛化指令都变成了 x86-64 机器指令。',
      before: mul,
      after: selected,
      cursor: { line: '%5:gpr(s32) = G_ADD %4, 1' },
      focus: ['%5:gr32 = INC32r %4, implicit-def dead $eflags'],
      state: state12,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Pick a register bank for the pointer %0',
          note: 'G_* operations are still target-independent and virtual registers only have types (`_(s64)`). regbankselect picks gpr for %0; `p0` marks it as a 64-bit pointer value. No instruction has been chosen yet.',
        },
        {
          title: 'Step 2 · Pick gpr for %1',
          note: '%1 comes from $esi and is a 32-bit scalar, so it also lands in gpr. A register bank is a coarse split; within gpr the class can still be gr32 or gr64.',
        },
        {
          title: 'Step 3 · Pick gpr for %2',
          note: '%2 is the 64-bit result of G_SEXT and also goes to gpr. Its operand %1 is 32-bit; the bank choice only guarantees that both belong to the same bank, and the exact width is decided during instruction selection.',
        },
        {
          title: 'Step 4 · Pick gpr for %3',
          note: 'G_LOAD produces a 32-bit value, so it enters gpr as well, and its pointer operand %0 is already there. No real machine instruction exists yet; MIR only gained bank annotations.',
        },
        {
          title: 'Step 5 · Pick gpr for %4',
          note: '%4 = G_MUL %3, 3 is pure scalar arithmetic, so gpr is the only sensible bank. Note that G_MUL has not become LEA yet: a bank is not an instruction.',
        },
        {
          title: 'Step 6 · Pick gpr for %5 and finish regbankselect',
          note: 'The last value %5 also enters gpr. All six virtual registers have a bank and regbankselect is done; instruction selection now replaces each G_* with a target instruction.',
        },
        {
          title: 'Step 7 · Select COPY $rdi and narrow the class to gr64',
          note: 'COPY is already a machine instruction, so instruction selection only narrows the class from gpr to gr64. The physical register $rdi is 64-bit, so %0 becomes gr64.',
        },
        {
          title: 'Step 8 · Select COPY $esi and narrow the class to gr32',
          note: 'Likewise %1 is copied from $esi and narrows to gr32. Both argument moves are in place; the remaining G_* operations are still waiting.',
        },
        {
          title: 'Step 9 · G_SEXT becomes MOVSX64rr32',
          note: 'Sign-extending 32-bit %1 to 64 bits maps to x86-64 MOVSX64rr32. One target instruction covers the whole G_SEXT semantics.',
        },
        {
          title: 'Step 10 · G_LOAD becomes MOV32rm with an addressing mode',
          note: 'The G_LOAD address is %0 + 4 * %2. x86 MOV32rm can express base + index*scale + disp directly, so the addressing mode folds into the instruction and no separate address computation is needed.',
        },
        {
          title: 'Step 11 · G_MUL becomes LEA32r',
          note: '%4 = %3 * 3. x86 LEA can compute base + index*scale: use %3 as base, %3 as index and scale 2 to get 3 * %3. One LEA replaces the multiply and avoids the multiplier port.',
        },
        {
          title: 'Step 12 · G_ADD 1 becomes INC32r',
          note: 'Adding 1 has a dedicated INC32r, shorter than a general ADD; implicit-def dead $eflags says the flags result is unused and can be dropped. Every generic operation is now an x86-64 machine instruction.',
        },
      ],
    },
  },
  { format: 'mir' },
);
