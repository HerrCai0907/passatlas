import { makeDemo } from './types.ts';

const input = `
define i32 @scale(i32 %x) {
entry:
  %a = add i32 %x, 0
  %b = mul i32 %a, 8
  %c = sub i32 %b, %b
  %d = or i32 %c, 0
  ret i32 %d
}
`;

const afterAdd = `
define i32 @scale(i32 %x) {
entry:
  %b = mul i32 %x, 8
  %c = sub i32 %b, %b
  %d = or i32 %c, 0
  ret i32 %d
}
`;

const afterMul = `
define i32 @scale(i32 %x) {
entry:
  %b = shl i32 %x, 3
  %c = sub i32 %b, %b
  %d = or i32 %c, 0
  ret i32 %d
}
`;

const afterSub = `
define i32 @scale(i32 %x) {
entry:
  %b = shl i32 %x, 3
  %d = or i32 0, 0
  ret i32 %d
}
`;

const afterOr = `
define i32 @scale(i32 %x) {
entry:
  %b = shl i32 %x, 3
  ret i32 0
}
`;

const addState = [
  'worklist        current  rule              result',
  '%a %b %c %d ret  %a      add X, 0 -> X     %a -> %x',
].join('\n');

const mulState = [
  'worklist        current  rule              result',
  '%b %c %d ret    %b      mul 2^3 -> shl     %b -> shl',
].join('\n');

const subState = [
  'worklist        current  rule              result',
  '%c %d ret       %c      X - X -> 0         %c -> 0',
].join('\n');

const orState = [
  'worklist        current  rule              result',
  '%d ret          %d      or X, 0 -> X       %d -> 0',
].join('\n');

const doneState = [
  'worklist        current  rule              result',
  '%b              %b      no users, left to DCE  -',
].join('\n');

export const instcombineDemo = makeDemo('instcombine', 'instcombine', [
  {
    title: '第 1 步 · add X, 0 直接用 X 替换',
    note: 'InstCombine 从 worklist 弹出 %a，命中恒等模式：add 的右操作数是 0，结果就是 %x。所有使用者被改成 %x，%a 删除；%b 因为操作数变了，被重新压回 worklist。',
    before: input,
    after: afterAdd,
    cursor: { line: '%a = add i32 %x, 0' },
    focus: ['%a = add i32 %x, 0'],
    state: addState,
  },
  {
    title: '第 2 步 · 乘 2 的幂改成左移',
    note: '处理 %b：8 是 2^3，mul 换成 shl %x, 3。这条指令的 def-use 没变，但指令本身进了 worklist；新形态可能再触发别的模式。',
    before: afterAdd,
    after: afterMul,
    cursor: { line: '%b = mul i32 %x, 8' },
    focus: ['%b = mul i32 %x, 8'],
    state: mulState,
  },
  {
    title: '第 3 步 · X - X 折叠成 0',
    note: '处理 %c：两个操作数相同，sub 恒为 0。指令被常量 0 替换并删除，%d 的操作数立刻变成 or 0, 0。',
    before: afterMul,
    after: afterSub,
    cursor: { line: '%c = sub i32 %b, %b' },
    focus: ['%c = sub i32 %b, %b'],
    state: subState,
  },
  {
    title: '第 4 步 · or 0, 0 折叠成 0',
    note: 'x | 0 等于 x，所以 or 0, 0 等于 0；ret 直接返回常量。注意这一步只处理 %d，%b 现在没有任何使用者，但 instcombine 不会替 DCE 做全局清扫。',
    before: afterSub,
    after: afterOr,
    cursor: { line: '%d = or i32 0, 0' },
    focus: ['%d = or i32 0, 0'],
    state: orState,
  },
  {
    title: '第 5 步 · worklist 清空，死代码留给 DCE',
    note: 'worklist 里最后剩下重新入队的 %b。它没有使用者，但 instcombine 的职责是模式匹配，不是删除所有死指令；随后的 DCE / ADCE 会把 %b 清掉。',
    before: afterOr,
    after: afterOr,
    cursor: { line: '%b = shl i32 %x, 3' },
    focus: ['%b = shl i32 %x, 3'],
    state: doneState,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Replace add X, 0 with X',
        note: 'InstCombine pops %a from the worklist and matches an identity: the right operand of the add is 0, so the result is %x. Every use is rewritten to %x and %a is erased; %b is pushed back onto the worklist because its operand changed.',
      },
      {
        title: 'Step 2 · Turn multiply by a power of two into a shift',
        note: 'Processing %b: 8 is 2^3, so the mul becomes shl %x, 3. The def-use chain is unchanged, but the new instruction is put back on the worklist because its new shape may match another pattern.',
      },
      {
        title: 'Step 3 · Fold X - X to 0',
        note: 'Processing %c: both operands are the same value, so the sub is always 0. The instruction is replaced by the constant 0 and erased, and the operand of %d immediately becomes or 0, 0.',
      },
      {
        title: 'Step 4 · Fold or 0, 0 to 0',
        note: 'x | 0 equals x, so or 0, 0 equals 0 and ret returns a constant. This step only processes %d; %b now has no users, but instcombine does not run a global sweep in place of DCE.',
      },
      {
        title: 'Step 5 · Empty worklist, dead code left to DCE',
        note: 'The last worklist entry is %b, pushed back earlier. It has no users, but instcombine is a pattern engine, not a pass that deletes every dead instruction; the following DCE / ADCE removes %b.',
      },
    ],
  },
});
