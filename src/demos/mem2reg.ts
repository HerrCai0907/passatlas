import { makeDemo } from './types';

const inputIR = `
define i32 @pick(i1 %c) {
entry:
  %slot = alloca i32, align 4
  br i1 %c, label %then, label %else
then:
  store i32 1, ptr %slot, align 4
  br label %merge
else:
  store i32 2, ptr %slot, align 4
  br label %merge
merge:
  %v = load i32, ptr %slot, align 4
  ret i32 %v
}
`;

const withPhiIR = `
define i32 @pick(i1 %c) {
entry:
  %slot = alloca i32, align 4
  br i1 %c, label %then, label %else
then:
  store i32 1, ptr %slot, align 4
  br label %merge
else:
  store i32 2, ptr %slot, align 4
  br label %merge
merge:
  %slot.0 = phi i32 [ 1, %then ], [ 2, %else ]
  %v = load i32, ptr %slot, align 4
  ret i32 %v
}
`;

const outputIR = `
define i32 @pick(i1 %c) {
entry:
  br i1 %c, label %then, label %else
then:
  br label %merge
else:
  br label %merge
merge:
  %v = phi i32 [ 1, %then ], [ 2, %else ]
  ret i32 %v
}
`;

export const mem2regDemo = makeDemo('mem2reg', 'mem2reg', [
  {
    title: '第 1 步 · 找出可提升的 alloca（只观察）',
    note: '%slot 只被 store / load 直接引用，地址没有逃逸，也没有 volatile —— 可以提升。地址一旦被传给函数或存进别的指针，就只能继续留在内存里。',
    before: inputIR,
    after: inputIR,
    focus: ['%slot = alloca i32, align 4'],
  },
  {
    title: '第 2 步 · 在支配边界插入 φ',
    note: 'then 和 else 都定义了 %slot，而它们在 merge 汇合，所以 merge 是二者的支配边界。插入 φ 后，每个前驱带上自己那条路径上的定义值。',
    before: inputIR,
    after: withPhiIR,
    focus: ['%slot.0 = phi i32 [ 1, %then ], [ 2, %else ]'],
  },
  {
    title: '第 3 步 · 沿支配树重命名并清理',
    note: '按支配树 DFS，把每个 load 替换成当前到达定义 φ 的值；store 和 alloca 随后变成无用指令被删除，函数进入 SSA 形式。',
    before: withPhiIR,
    after: outputIR,
  },
]);
