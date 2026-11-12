/**
 * loop-reduce 的「公式求解」示意图文案。
 * 组件只负责布局与步进状态，公式、判定和解释都放在这里，中英文共用同一份数据结构。
 */
import type { Locale } from './config.ts';

export type LsrTone = 'ok' | 'bad' | 'warn';

export interface LsrFactorRow {
  /** 因式分解后的公式，例如 4 × {0,+,1} */
  formula: string;
  /** 短判定，例如「✓ 合法」 */
  tag: string;
  tone: LsrTone;
  /** 为什么合法 / 不合法 / 没被枚举 */
  detail: string;
}

export interface LsrColumnText {
  badge: string;
  code: string[];
  scev: string;
  scevNote: string;
  factors: LsrFactorRow[];
  cost: {
    /** 循环里新增的 phi 数 */
    phis: number;
    /** 每轮新增的地址推进指令数 */
    adds: number;
    note: string;
  };
  resultTag: string;
  result: string[];
}

export interface LsrPhaseText {
  title: string;
  note: string;
}

export interface LsrLabText {
  kicker: string;
  title: string;
  lead: string;
  groupAria: string;
  scevTitle: string;
  factorsTitle: string;
  costTitle: string;
  resultTitle: string;
  newPhis: string;
  newAdds: string;
  columns: [LsrColumnText, LsrColumnText];
  phases: LsrPhaseText[];
  footnote: string;
  play: string;
  pause: string;
  prev: string;
  next: string;
  restart: string;
  stepAria: (n: number, title: string) => string;
  counter: (i: number, total: number) => string;
  meterAria: (label: string, value: number) => string;
  autoplayOff: string;
  autoplayOffTitle: string;
}

const CODE_STRIDE_1 = [
  '; a[i]',
  '  %p = getelementptr i32, ptr %a, i64 %i',
  '  store i32 7, ptr %p, align 4',
  '  %i.next = add nsw i64 %i, 1',
];

const CODE_STRIDE_3 = [
  '; a[3*i]',
  '  %mul = mul i64 %i, 3',
  '  %p = getelementptr i32, ptr %a, i64 %mul',
  '  store i32 7, ptr %p, align 4',
  '  %i.next = add nsw i64 %i, 1',
];

const RESULT_STRIDE_1 = [
  '%0 = shl i64 %i, 2',
  '%scevgep = getelementptr i8, ptr %a, i64 %0',
  'store i32 7, ptr %scevgep, align 4',
];

const RESULT_STRIDE_3 = [
  '%lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]',
  'store i32 7, ptr %lsr.iv, align 4',
  '%scevgep = getelementptr i8, ptr %lsr.iv, i64 12',
];

const zh: LsrLabText = {
  kicker: '公式求解 · formula search',
  title: '步长怎样决定 LSR 的答案',
  lead:
    '同一个地址表达式可以拆成许多种 base / scale / 偏移组合。LSR 先按 SCEV 拆开，再用目标的寻址模式筛掉不合法的，最后按代价挑一个。下面两个循环只差索引。',
  groupAria: 'LSR 公式求解示意：对比 stride 1 与 stride 3 的地址变换',
  scevTitle: '地址的 SCEV',
  factorsTitle: '因式分解与合法性',
  costTitle: '代价',
  resultTitle: '展开后的 IR',
  newPhis: '新增 phi',
  newAdds: '每轮新增寻址',
  columns: [
    {
      badge: 'stride = 1',
      code: CODE_STRIDE_1,
      scev: '{a,+,4} = a + 4·i',
      scevNote: '步长 = 元素大小 4 × 索引步长 1。',
      factors: [
        {
          formula: '4 × {0,+,1}',
          tag: '✓ 合法',
          tone: 'ok',
          detail: 'scale 4 是 AArch64 和 x86-64 都能编码的变址；{0,+,1} 就是已有的 %i。',
        },
        {
          formula: '1 × {a,+,4}',
          tag: '✓ 合法',
          tone: 'ok',
          detail: '把整个 addrec 当一个指针 phi。也合法，但要在循环里新增一个寄存器。',
        },
      ],
      cost: {
        phis: 0,
        adds: 0,
        note: '复用 %i：不新增 phi，缩放由 load/store 的寻址模式吸收。',
      },
      resultTag: '保留 scaled index',
      result: RESULT_STRIDE_1,
    },
    {
      badge: 'stride = 3',
      code: CODE_STRIDE_3,
      scev: '{a,+,12} = a + 12·i',
      scevNote: '步长 = 4 × 3；SCEV 把 mul 折进了 addrec，%mul 不再单独出现。',
      factors: [
        {
          formula: '12 × {0,+,1}',
          tag: '✗ 不合法',
          tone: 'bad',
          detail:
            '12 不是可编码的 scale：AArch64 的 64 位变址只有 LSL #0–#3，x86-64 只有 1/2/4/8。',
        },
        {
          formula: '4 × {0,+,3}',
          tag: '✗ 没被枚举',
          tone: 'warn',
          detail: 'IVUsers 里没有 3·i：它已经被折进步长 12，LSR 不会把 %mul 当成候选寄存器。',
        },
        {
          formula: '1 × {a,+,12}',
          tag: '✓ 合法',
          tone: 'ok',
          detail: 'addrec 本身作为一个 phi 维护，每轮 +12；scale 1 不再单独缩放。',
        },
      ],
      cost: {
        phis: 1,
        adds: 1,
        note: '新增一个指针 phi 和一条推进指令；比再维护一个 3·i 寄存器更便宜。',
      },
      resultTag: '生成指针 IV',
      result: RESULT_STRIDE_3,
    },
  ],
  phases: [
    {
      title: '从 IR 到 SCEV',
      note: '两个循环只差索引。LSR 不看 mul / gep 的形状，而是从 IVUsers 拿到地址的 SCEV：步长 4 和步长 12。',
    },
    {
      title: '拆成 base + scale·reg + 偏移',
      note: '仿射地址可以写成 a + scale × reg。scale 能取什么值不是代数问题，而是目标寻址模式的编码问题。',
    },
    {
      title: '因式分解，先过合法性',
      note: '把步长拆成 scale 和寄存器：合法的进入代价比较，不合法的直接出局；没进 IVUsers 的表达式根本不在候选里。',
    },
    {
      title: '比较新增的寄存器与指令',
      note: '左边复用 %i，右边新增一个 phi 和一条推进指令。代价模型按 target 的排序把这两类成本放在一起比，再和 baseline 比一次。',
    },
    {
      title: '展开',
      note: '同一个数学变换因为步长不同，落成两种 IR：一边保留 shl + gep，一边变成 %lsr.iv。',
    },
  ],
  footnote:
    '图中是两个单 use 循环。真实循环里，LSR 还会把只差常量偏移的 use 合并成 fixup，并在 SolveRecurse 里跨 use 复用寄存器。stride = 2 时 AArch64 选指针 phi、x86-64 保留 scale 8：区别不在合法性，而在排序——x86-64 把指令数放第一位，AArch64 先看寄存器与 scale 代价。',
  play: '播放',
  pause: '暂停',
  prev: '上一步',
  next: '下一步',
  restart: '回到第一步',
  stepAria: (n, title) => `第 ${n} 步：${title}`,
  counter: (i, total) => `${i} / ${total}`,
  meterAria: (label, value) => `${label}：${value}`,
  autoplayOff: '系统偏好减少动态效果，自动播放已关闭；仍可用 ← → 手动步进。',
  autoplayOffTitle: '系统开启了 prefers-reduced-motion，播放按钮已停用',
};

const en: LsrLabText = {
  kicker: 'formula search · LSR',
  title: 'How the stride decides LSR’s answer',
  lead:
    'One address expression has many base / scale / offset decompositions. LSR splits it along SCEV, drops the forms the target cannot encode, then picks one by cost. These two loops differ only in the index.',
  groupAria: 'LSR formula search: how stride 1 and stride 3 produce different address forms',
  scevTitle: 'Address SCEV',
  factorsTitle: 'Factorizations and legality',
  costTitle: 'Cost',
  resultTitle: 'Expanded IR',
  newPhis: 'new phis',
  newAdds: 'new addressing / iter',
  columns: [
    {
      badge: 'stride = 1',
      code: CODE_STRIDE_1,
      scev: '{a,+,4} = a + 4·i',
      scevNote: 'Stride = element size 4 × index step 1.',
      factors: [
        {
          formula: '4 × {0,+,1}',
          tag: '✓ legal',
          tone: 'ok',
          detail: 'Scale 4 is a scaled index on both AArch64 and x86-64, and {0,+,1} is already %i.',
        },
        {
          formula: '1 × {a,+,4}',
          tag: '✓ legal',
          tone: 'ok',
          detail: 'Treat the whole addrec as a pointer phi. Legal, but it adds a register inside the loop.',
        },
      ],
      cost: {
        phis: 0,
        adds: 0,
        note: 'Reuses %i: no new phi, and the scaling folds into the load/store addressing mode.',
      },
      resultTag: 'keeps the scaled index',
      result: RESULT_STRIDE_1,
    },
    {
      badge: 'stride = 3',
      code: CODE_STRIDE_3,
      scev: '{a,+,12} = a + 12·i',
      scevNote: 'Stride = 4 × 3; SCEV folds the mul into the addrec, so %mul no longer appears on its own.',
      factors: [
        {
          formula: '12 × {0,+,1}',
          tag: '✗ illegal',
          tone: 'bad',
          detail:
            '12 is not an encodable scale: AArch64’s 64-bit index allows only LSL #0–#3, and x86-64 allows only 1/2/4/8.',
        },
        {
          formula: '4 × {0,+,3}',
          tag: '✗ not enumerated',
          tone: 'warn',
          detail:
            'IVUsers has no 3·i: it was folded into the stride of 12, so LSR never treats %mul as a candidate register.',
        },
        {
          formula: '1 × {a,+,12}',
          tag: '✓ legal',
          tone: 'ok',
          detail: 'The addrec itself becomes one phi, +12 per iteration; scale 1 means no separate scaling.',
        },
      ],
      cost: {
        phis: 1,
        adds: 1,
        note: 'Adds one pointer phi and one advance; cheaper than maintaining a 3·i register as well.',
      },
      resultTag: 'creates a pointer IV',
      result: RESULT_STRIDE_3,
    },
  ],
  phases: [
    {
      title: 'From IR to SCEV',
      note: 'The loops differ only in the index. LSR ignores the mul / gep shapes and asks IVUsers for the address SCEV: strides 4 and 12.',
    },
    {
      title: 'Split into base + scale·reg + offset',
      note: 'An affine address is a + scale × reg. Which scales exist is not algebra — it is an encoding question for the target’s addressing modes.',
    },
    {
      title: 'Factorize, then check legality',
      note: 'Split the stride into a scale and a register: legal forms go to the cost model, illegal ones are dropped, and expressions that never reach IVUsers are not candidates at all.',
    },
    {
      title: 'Compare the new registers and instructions',
      note: 'The left reuses %i; the right adds a phi and one advance. The cost model orders those costs with target-specific tie-breakers, then compares the result against the baseline.',
    },
    {
      title: 'Expand',
      note: 'The same algebra lands in two different IR shapes because the stride changed: one keeps shl + gep, the other becomes %lsr.iv.',
    },
  ],
  footnote:
    'The figure uses single-use loops. A real loop also merges uses that differ only by a constant into fixups, and SolveRecurse reuses registers across uses. At stride = 2, AArch64 picks the pointer phi while x86-64 keeps scale 8: both forms are legal, but the ordering differs — x86-64 compares instruction count first, while AArch64 compares registers and scale cost first.',
  play: 'Play',
  pause: 'Pause',
  prev: 'Previous step',
  next: 'Next step',
  restart: 'Back to the first step',
  stepAria: (n, title) => `Step ${n}: ${title}`,
  counter: (i, total) => `${i} / ${total}`,
  meterAria: (label, value) => `${label}: ${value}`,
  autoplayOff:
    'Autoplay is off because the system prefers reduced motion; use ← → to step through.',
  autoplayOffTitle: 'prefers-reduced-motion is on, so the play button is disabled',
};

export const lsrLabText: Record<Locale, LsrLabText> = { zh, en };
