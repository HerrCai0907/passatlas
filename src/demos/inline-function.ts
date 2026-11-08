import { makeDemo } from './types.ts';

const inputIR = `
define i32 @caller(i32 %x) {
entry:
  %r = call i32 @pick(i32 %x)
  %s = add i32 %r, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %pos, label %neg

pos:
  %p = add i32 %x, 1
  ret i32 %p

neg:
  %n = sub i32 %x, 1
  ret i32 %n
}
`;

const inlinedIR = `
define i32 @caller(i32 %x) {
entry:
  %c.i = icmp sgt i32 %x, 0
  br i1 %c.i, label %pos.i, label %neg.i

pos.i:
  %p.i = add i32 %x, 1
  br label %cont

neg.i:
  %n.i = sub i32 %x, 1
  br label %cont

cont:
  %r = phi i32 [ %p.i, %pos.i ], [ %n.i, %neg.i ]
  %s = add i32 %r, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %pos, label %neg

pos:
  %p = add i32 %x, 1
  ret i32 %p

neg:
  %n = sub i32 %x, 1
  ret i32 %n
}
`;

const cleanedIR = `
define i32 @caller(i32 %x) {
entry:
  %c.i = icmp sgt i32 %x, 0
  br i1 %c.i, label %pos.i, label %neg.i

pos.i:
  %p.i = add i32 %x, 1
  br label %cont

neg.i:
  %n.i = sub i32 %x, 1
  br label %cont

cont:
  %r = phi i32 [ %p.i, %pos.i ], [ %n.i, %neg.i ]
  %s = add i32 %r, 10
  ret i32 %s
}
`;

export const inlineFunctionDemo = makeDemo('inline-function', 'inline function', [
  {
    title: '第 1 步 · 先确认能不能内联',
    note: '决策已经做完，InlineFunction 先检查 call site：是否有定义、是否已经在 !inline_history 里、有没有不能展开的 operand bundle。然后记录两个返回点：pick 从 %pos 和 %neg 各 return 一次。',
    before: inputIR,
    after: inputIR,
    focus: [
      '  %r = call i32 @pick(i32 %x)',
      '  %c = icmp sgt i32 %x, 0',
      '  br i1 %c, label %pos, label %neg',
      '  ret i32 %p',
      '  ret i32 %n',
    ],
  },
  {
    title: '第 2 步 · 拆分 call site，克隆并缝合 CFG',
    note: 'caller 的 entry 在 call 处拆成前后两段。pick 的三个块被克隆进来并加上 .i 后缀；两个 ret 改写成跳到 %cont 的 br，%cont 再用 phi 把 %r 的两个可能值合起来。',
    before: inputIR,
    after: inlinedIR,
  },
  {
    title: '第 3 步 · 清理 callee',
    note: 'pick 是 internal、唯一调用点已经消失、零 live use，于是被判定为 trivially dead 并从模块中删除。块名和合并策略只是示意，实际 CLI 输出可能因版本而异。',
    before: inlinedIR,
    after: cleanedIR,
  },
],
  {
    en: {
      steps: [
      {
        title: 'Step 1 · Check that it can be inlined',
        note: 'The decision is already made. InlineFunction checks the call site: does the callee have a definition, is it already in !inline_history, does it have an operand bundle that cannot be expanded. Then it records two return points: pick returns from %pos and from %neg.',
      },
      {
        title: 'Step 2 · Split the call site, clone and stitch the CFG',
        note: "caller's entry is split at the call. pick's three blocks are cloned with a .i suffix; both rets become branches to %cont, and %cont uses a phi to merge the two possible values of %r.",
      },
      {
        title: 'Step 3 · Clean up the callee',
        note: 'pick is internal, its only call site is gone and it has no live uses, so it is trivially dead and removed from the module. Block names and merge strategy are illustrative; real CLI output varies by version.',
      },
      ],
    },
  },
);
