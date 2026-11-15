import { makeDemo } from './types.ts';

const input = `
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

const withPhi = `
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
  %slot.0 = phi i32 [ undef, %then ], [ undef, %else ]
  %v = load i32, ptr %slot, align 4
  ret i32 %v
}
`;

const afterThen = `
define i32 @pick(i1 %c) {
entry:
  %slot = alloca i32, align 4
  br i1 %c, label %then, label %else
then:
  br label %merge
else:
  store i32 2, ptr %slot, align 4
  br label %merge
merge:
  %slot.0 = phi i32 [ 1, %then ], [ undef, %else ]
  %v = load i32, ptr %slot, align 4
  ret i32 %v
}
`;

const afterElse = `
define i32 @pick(i1 %c) {
entry:
  %slot = alloca i32, align 4
  br i1 %c, label %then, label %else
then:
  br label %merge
else:
  br label %merge
merge:
  %slot.0 = phi i32 [ 1, %then ], [ 2, %else ]
  %v = load i32, ptr %slot, align 4
  ret i32 %v
}
`;

const afterLoad = `
define i32 @pick(i1 %c) {
entry:
  %slot = alloca i32, align 4
  br i1 %c, label %then, label %else
then:
  br label %merge
else:
  br label %merge
merge:
  %slot.0 = phi i32 [ 1, %then ], [ 2, %else ]
  ret i32 %slot.0
}
`;

const output = `
define i32 @pick(i1 %c) {
entry:
  br i1 %c, label %then, label %else
then:
  br label %merge
else:
  br label %merge
merge:
  %slot.0 = phi i32 [ 1, %then ], [ 2, %else ]
  ret i32 %slot.0
}
`;

const eligible = [
  'alloca    promote  escape  volatile',
  '%slot     yes      no      no',
  'frontier  -',
  'phi       -',
  'rename    -',
].join('\n');

const frontier = [
  'alloca    promote  escape  volatile',
  '%slot     yes      no      no',
  'frontier  then else -> merge',
  'phi       %slot.0  [undef, undef]',
  'rename    entry',
].join('\n');

const renamedThen = [
  'alloca    promote  escape  volatile',
  '%slot     yes      no      no',
  'frontier  then else -> merge',
  'phi       %slot.0  [1, undef]',
  'rename    then  store 1 -> %slot.0',
].join('\n');

const renamedElse = [
  'alloca    promote  escape  volatile',
  '%slot     yes      no      no',
  'frontier  then else -> merge',
  'phi       %slot.0  [1, 2]',
  'rename    else  store 2 -> %slot.0',
].join('\n');

const renamedLoad = [
  'alloca    promote  escape  volatile',
  '%slot     yes      no      no',
  'phi       %slot.0  [1, 2]',
  'rename    merge  %v -> %slot.0',
  'loads     0 remaining',
].join('\n');

const cleaned = [
  'alloca    promote  escape  volatile',
  '%slot     yes      no      no',
  'phi       %slot.0  [1, 2]',
  'stores    0 remaining',
  'loads     0 remaining',
  'cleanup   erase %slot alloca',
].join('\n');

export const mem2regDemo = makeDemo('mem2reg', 'mem2reg', [
  {
    title: '第 1 步 · 判断 %slot 能不能提升',
    note: 'mem2reg 只看 alloca 的用途：它只被 load / store 直接引用，地址没有传给函数、没有存进别的指针，也不是 volatile。三条都满足，%slot 进入可提升集合。',
    before: input,
    after: input,
    cursor: { line: '%slot = alloca i32, align 4' },
    focus: ['%slot = alloca i32, align 4'],
    state: eligible,
  },
  {
    title: '第 2 步 · 在支配边界插入 φ',
    note: 'then 和 else 都定义了 %slot，它们在 merge 汇合，所以 merge 是 %slot 的支配边界。先插入一个占位 φ，入边暂时是 undef，等重命名时再填。',
    before: input,
    after: withPhi,
    cursor: { line: '%slot.0 = phi i32 [ undef, %then ], [ undef, %else ]', side: 'after' },
    focus: ['%slot.0 = phi i32 [ undef, %then ], [ undef, %else ]'],
    state: frontier,
  },
  {
    title: '第 3 步 · 重命名 then 里的 store',
    note: '按支配树进入 then。store 1 把值 1 写进 %slot，这个值在 merge 处到达，于是 φ 的 then 入边填 1；store 本身不再需要，同时删除。',
    before: withPhi,
    after: afterThen,
    cursor: { line: 'store i32 1, ptr %slot, align 4' },
    focus: ['store i32 1, ptr %slot, align 4'],
    state: renamedThen,
  },
  {
    title: '第 4 步 · 重命名 else 里的 store',
    note: 'else 的 store 2 同理：φ 的 else 入边填 2，store 删除。到这里两个前驱都把自己的定义值交给了 φ。',
    before: afterThen,
    after: afterElse,
    cursor: { line: 'store i32 2, ptr %slot, align 4' },
    focus: ['store i32 2, ptr %slot, align 4'],
    state: renamedElse,
  },
  {
    title: '第 5 步 · 用 φ 替换 merge 里的 load',
    note: '进入 merge 时当前定义就是 φ 的结果 %slot.0，load 被它替换、随后删除。这一步之后函数里只剩 φ 这一个汇聚点，不再有内存读写。',
    before: afterElse,
    after: afterLoad,
    cursor: { line: '%v = load i32, ptr %slot, align 4' },
    focus: ['%v = load i32, ptr %slot, align 4'],
    state: renamedLoad,
  },
  {
    title: '第 6 步 · 删除 alloca，进入 SSA',
    note: '没有任何 load / store 再引用 %slot，alloca 被删除。函数现在是 SSA：每个值只定义一次，%slot.0 把两条路径合起来。',
    before: afterLoad,
    after: output,
    cursor: { line: '%slot = alloca i32, align 4' },
    state: cleaned,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Decide whether %slot can be promoted',
        note: 'mem2reg only looks at how the alloca is used: it is referenced directly by load / store, its address is never passed to a function or stored into another pointer, and it is not volatile. All three hold, so %slot enters the promotable set.',
      },
      {
        title: 'Step 2 · Insert φ at the dominance frontier',
        note: 'Both then and else define %slot and they meet at merge, so merge is on the dominance frontier of %slot. Insert a placeholder φ with undef incoming values; renaming fills them in.',
      },
      {
        title: 'Step 3 · Rename the store in then',
        note: 'Walk the dominator tree into then. store 1 writes the value 1 into %slot, and that value reaches merge, so the then incoming edge of the φ becomes 1; the store is no longer needed and is deleted.',
      },
      {
        title: 'Step 4 · Rename the store in else',
        note: 'The store in else works the same way: the else incoming edge becomes 2 and the store is deleted. Both predecessors have now handed their definition to the φ.',
      },
      {
        title: 'Step 5 · Replace the load in merge with the φ',
        note: 'On entry to merge the current definition is the φ result %slot.0, so the load is replaced by it and then erased. After this step the function has a single merge point and no memory accesses left.',
      },
      {
        title: 'Step 6 · Delete the alloca and become SSA',
        note: 'No load or store references %slot any more, so the alloca is erased. The function is now SSA: every value is defined once, and %slot.0 joins the two paths.',
      },
    ],
  },
});
