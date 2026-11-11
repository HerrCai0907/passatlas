import { makeDemo } from './types.ts';

const beforeIR = `
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

const afterIR = `
target triple = "aarch64-unknown-linux-gnu"

define void @fill(ptr %a, i64 %n) {
entry:
  br label %loop
loop:
  %lsr.iv = phi ptr [ %scevgep, %loop ], [ %a, %entry ]
  %i = phi i64 [ 0, %entry ], [ %i.next, %loop ]
  store i32 7, ptr %lsr.iv, align 4
  %i.next = add nsw i64 %i, 1
  %scevgep = getelementptr i8, ptr %lsr.iv, i64 12
  %cmp = icmp slt i64 %i.next, %n
  br i1 %cmp, label %loop, label %exit
exit:
  ret void
}
`;

export const loopReduceDemo = makeDemo(
  'loop-reduce',
  'loop-reduce',
  [
    {
      title: '第 1 步 · 地址是归纳变量的仿射函数',
      note: '%p 实际是 a + 12*i：每轮只前进 12 字节，却要重新算一次 mul 和 getelementptr。因子 3 和元素大小 4 都能折进 scale 或偏移。',
      before: beforeIR,
      after: beforeIR,
      focus: ['%mul = mul i64 %i, 3', '%p = getelementptr i32, ptr %a, i64 %mul'],
    },
    {
      title: '第 2 步 · 用指针 IV 吃掉乘法',
      note: '在 AArch64 目标上，codegen（llc -O2）会在 CodeGenPrepare 之前运行 loop-reduce：%lsr.iv 从 %a 出发，每轮推进 12 字节；store 直接写它，%mul 和 %p 变成死代码被删除。%i 只留给出口比较，LSR 不改写循环条件。',
      before: beforeIR,
      after: afterIR,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · The address is affine in the induction variable',
          note: '%p is really a + 12*i: it advances by a fixed 12 bytes every iteration, yet mul and getelementptr are recomputed. Both the factor 3 and the element size 4 can be folded into a scale or a displacement.',
        },
        {
          title: 'Step 2 · A pointer IV eats the multiply',
          note: 'On an AArch64 target, codegen (llc -O2) runs loop-reduce before CodeGenPrepare: %lsr.iv starts at %a and advances by 12 bytes per iteration; the store writes through it, and %mul and %p become dead and are deleted. %i survives only for the exit test, which LSR leaves alone.',
        },
      ],
    },
  },
);
