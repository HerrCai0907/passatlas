import { makeDemo } from './types.ts';

const input = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  %mul = mul i64 %i, 3
  %p = getelementptr i32, ptr %a, i64 %mul
  store i32 7, ptr %p, align 4
  %i.next = add nsw i64 %i, 1
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

const withPhi = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  %lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]
  %mul = mul i64 %i, 3
  %p = getelementptr i32, ptr %a, i64 %mul
  store i32 7, ptr %p, align 4
  %i.next = add nsw i64 %i, 1
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

const withStep = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  %lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]
  %mul = mul i64 %i, 3
  %p = getelementptr i32, ptr %a, i64 %mul
  store i32 7, ptr %p, align 4
  %i.next = add nsw i64 %i, 1
  %scevgep = getelementptr i8, ptr %lsr.iv, i64 12
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

const withStore = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  %lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]
  %mul = mul i64 %i, 3
  %p = getelementptr i32, ptr %a, i64 %mul
  store i32 7, ptr %lsr.iv, align 4
  %i.next = add nsw i64 %i, 1
  %scevgep = getelementptr i8, ptr %lsr.iv, i64 12
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

const afterP = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  %lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]
  %mul = mul i64 %i, 3
  store i32 7, ptr %lsr.iv, align 4
  %i.next = add nsw i64 %i, 1
  %scevgep = getelementptr i8, ptr %lsr.iv, i64 12
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

const output = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  %lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]
  store i32 7, ptr %lsr.iv, align 4
  %i.next = add nsw i64 %i, 1
  %scevgep = getelementptr i8, ptr %lsr.iv, i64 12
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

const analyzed = [
  'expr   base  scale  imm  kind',
  '%p     %a    12     0    affine',
  '%mul   %i    3      0    affine',
].join('\n');

const candidates = [
  'candidate           base  step  cost',
  'ptr IV {a,+,12}     %a    12    1',
  'i IV, mul by 12     %i    1     2',
  'recompute %p        %a    -     3',
].join('\n');

const chosen = [
  'chosen   ptr IV {a,+,12}',
  'phi      %lsr.iv  %a -> %scevgep',
  'step     12 bytes',
].join('\n');

const stepped = [
  'chosen   ptr IV {a,+,12}',
  'phi      %lsr.iv  %a -> %scevgep',
  'step     %scevgep = %lsr.iv + 12',
].join('\n');

const stored = [
  'chosen   ptr IV {a,+,12}',
  'phi      %lsr.iv  %a -> %scevgep',
  'step     %scevgep = %lsr.iv + 12',
  'use      store %p -> %lsr.iv',
].join('\n');

const deadP = [
  'chosen   ptr IV {a,+,12}',
  'phi      %lsr.iv  %a -> %scevgep',
  'use      store -> %lsr.iv',
  'dead     %p',
].join('\n');

const deadMul = [
  'chosen   ptr IV {a,+,12}',
  'phi      %lsr.iv  %a -> %scevgep',
  'use      store -> %lsr.iv',
  'dead     %mul %p',
].join('\n');

export const loopReduceDemo = makeDemo('loop-reduce', 'loop-reduce', [
  {
    title: '第 1 步 · 把地址看成归纳变量的仿射函数',
    note: 'LSR 先问 ScalarEvolution：%p 的地址是什么形状？%mul = 3 * %i，%p = %a + 4 * %mul，合起来就是 %a + 12 * %i。每轮只前进固定的 12 字节，却要重新算一次乘法和地址。',
    before: input,
    after: input,
    cursor: { line: '%p = getelementptr i32, ptr %a, i64 %mul' },
    focus: ['%mul = mul i64 %i, 3', '%p = getelementptr i32, ptr %a, i64 %mul'],
    state: analyzed,
  },
  {
    title: '第 2 步 · 枚举公式并比较代价',
    note: 'LSR 会枚举「基址 + scale * IV + 偏移」的各种组合，再按目标寻址模式和寄存器压力估代价。这里指针 IV {a,+,12} 只要一个寄存器、一条带立即数的 GEP，最便宜。',
    before: input,
    after: input,
    cursor: { line: '%mul = mul i64 %i, 3' },
    focus: ['%mul = mul i64 %i, 3'],
    state: candidates,
  },
  {
    title: '第 3 步 · 在循环头插入指针 IV',
    note: '选中 {a,+,12} 后，在循环头插入一个指针 φ：初值 %a，回边值来自循环末尾的 %scevgep。注意这个 φ 引用的是同一条回边上的定义，SSA 合法。',
    before: input,
    after: withPhi,
    cursor: { line: '%lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]', side: 'after' },
    focus: ['%lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]'],
    state: chosen,
  },
  {
    title: '第 4 步 · 在回边计算下一轮地址',
    note: '%scevgep 用 i8 指针把步长写成 12 字节；这样无论元素类型是什么，增量都是固定的字节数。它定义在 store 之后、回到 φ 之前。',
    before: withPhi,
    after: withStep,
    cursor: { line: '%scevgep = getelementptr i8, ptr %lsr.iv, i64 12', side: 'after' },
    focus: ['%scevgep = getelementptr i8, ptr %lsr.iv, i64 12'],
    state: stepped,
  },
  {
    title: '第 5 步 · 把 store 的地址换成指针 IV',
    note: 'store 不再通过 %p 寻址，直接用 %lsr.iv。这一步只改这一个使用者；%p 和 %mul 暂时还在，但已经没人用了。',
    before: withStep,
    after: withStore,
    cursor: { line: 'store i32 7, ptr %p, align 4' },
    focus: ['store i32 7, ptr %p, align 4'],
    state: stored,
  },
  {
    title: '第 6 步 · 删掉不再使用的 %p',
    note: '%p 是 GEP 的结果，删除它不会改变行为；它的操作数 %mul 随即也失去最后一个使用者。',
    before: withStore,
    after: afterP,
    cursor: { line: '%p = getelementptr i32, ptr %a, i64 %mul' },
    state: deadP,
  },
  {
    title: '第 7 步 · 删掉 %mul，乘法从循环里消失',
    note: '最后删掉 %mul。循环体只剩一次带立即数 12 的指针加法；出口比较仍然用 %i，LSR 没有改写循环条件。这就是 LSR 在 AArch64 上把乘加地址变成一条 post-index 寻址的 IR 形态。',
    before: afterP,
    after: output,
    cursor: { line: '%mul = mul i64 %i, 3' },
    state: deadMul,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · View the address as an affine function of the induction variable',
        note: 'LSR first asks ScalarEvolution what shape the address of %p has: %mul = 3 * %i and %p = %a + 4 * %mul, which combine into %a + 12 * %i. The address advances by a fixed 12 bytes per iteration, yet the multiply and the GEP are recomputed.',
      },
      {
        title: 'Step 2 · Enumerate formulas and compare their cost',
        note: 'LSR enumerates combinations of base + scale * IV + displacement and estimates their cost from the target addressing modes and register pressure. Here the pointer IV {a,+,12} needs one register and one GEP with an immediate, so it is the cheapest.',
      },
      {
        title: 'Step 3 · Insert the pointer IV in the loop header',
        note: 'Having chosen {a,+,12}, LSR inserts a pointer φ: the initial value is %a and the back-edge value comes from %scevgep at the end of the body. It references a definition on the same back edge, which is valid SSA.',
      },
      {
        title: 'Step 4 · Compute the next address on the back edge',
        note: '%scevgep uses an i8 pointer so the step is exactly 12 bytes regardless of the element type. It is defined after the store and before the branch back to the φ.',
      },
      {
        title: 'Step 5 · Use the pointer IV for the store',
        note: 'The store no longer addresses through %p; it uses %lsr.iv directly. Only this one use changes; %p and %mul are still present but already unused.',
      },
      {
        title: 'Step 6 · Delete the now-unused %p',
        note: '%p is the result of a GEP, so deleting it cannot change behaviour; its operand %mul then loses its last user as well.',
      },
      {
        title: 'Step 7 · Delete %mul and remove the multiply from the loop',
        note: 'Delete %mul last. The loop body is left with one pointer add by an immediate 12; the exit test still uses %i, and LSR does not rewrite the loop condition. This is the IR shape that becomes an AArch64 post-indexed addressing mode.',
      },
    ],
  },
});
