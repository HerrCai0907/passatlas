import { makeDemo } from './types.ts';

const input = `
define i32 @caller(i32 %x) {
entry:
  %r = call i32 @pick(i32 %x)
  %s = add i32 %r, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %a = mul i32 %x, 3
  %b = add i32 %a, 1
  ret i32 %b
}
`;

const split = `
define i32 @caller(i32 %x) {
entry:
  %r = call i32 @pick(i32 %x)
  br label %cont
cont:
  %s = add i32 %r, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %a = mul i32 %x, 3
  %b = add i32 %a, 1
  ret i32 %b
}
`;

const clonedA = `
define i32 @caller(i32 %x) {
entry:
  %a.i = mul i32 %x, 3
  %r = call i32 @pick(i32 %x)
  br label %cont
cont:
  %s = add i32 %r, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %a = mul i32 %x, 3
  %b = add i32 %a, 1
  ret i32 %b
}
`;

const clonedB = `
define i32 @caller(i32 %x) {
entry:
  %a.i = mul i32 %x, 3
  %b.i = add i32 %a.i, 1
  %r = call i32 @pick(i32 %x)
  br label %cont
cont:
  %s = add i32 %r, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %a = mul i32 %x, 3
  %b = add i32 %a, 1
  ret i32 %b
}
`;

const inlined = `
define i32 @caller(i32 %x) {
entry:
  %a.i = mul i32 %x, 3
  %b.i = add i32 %a.i, 1
  br label %cont
cont:
  %s = add i32 %b.i, 10
  ret i32 %s
}

define internal i32 @pick(i32 %x) {
entry:
  %a = mul i32 %x, 3
  %b = add i32 %a, 1
  ret i32 %b
}
`;

const output = `
define i32 @caller(i32 %x) {
entry:
  %a.i = mul i32 %x, 3
  %b.i = add i32 %a.i, 1
  br label %cont
cont:
  %s = add i32 %b.i, 10
  ret i32 %s
}
`;

const checked = [
  'callee    pick  internal  blocks 1  returns 1',
  'decision  inline  cost below threshold',
  'call      %r = call @pick(i32 %x)',
].join('\n');

const splitState = [
  'split     entry -> cont (after the call)',
  'call      %r = call @pick(i32 %x)',
  'returns   1',
].join('\n');

const mapA = [
  'valuemap  %a -> %a.i   %x -> %x',
  'call      %r = call @pick(i32 %x)',
  'returns   1',
].join('\n');

const mapB = [
  'valuemap  %a -> %a.i   %b -> %b.i',
  'call      %r = call @pick(i32 %x)',
  'returns   1',
].join('\n');

const returnState = [
  'return    %r -> %b.i',
  'call      erased',
  'blocks    entry, cont',
].join('\n');

const removed = [
  'callee    pick removed (internal, no callers)',
  'return    %r -> %b.i',
].join('\n');

export const inlineFunctionDemo = makeDemo('inline-function', 'inline function', [
  {
    title: '第 1 步 · 检查 call site 能不能内联',
    note: '决策已经做完，InlineFunction 做落地前的检查：callee 有定义、不是 noinline / optnone、不在 !inline_history 里、没有无法展开的 operand bundle。pick 是单块函数、只有一个 ret，记录一个返回点。',
    before: input,
    after: input,
    cursor: { line: '%r = call i32 @pick(i32 %x)' },
    focus: ['%r = call i32 @pick(i32 %x)'],
    state: checked,
  },
  {
    title: '第 2 步 · 在 call 处拆开 caller 的基本块',
    note: 'call 之后还有 %s 和 ret，不能直接往 entry 里塞更多指令。InlineFunction 把 entry 拆成两段：entry 保留 call，后续指令移到 %cont，中间用 br 连接。',
    before: input,
    after: split,
    cursor: { line: '%r = call i32 @pick(i32 %x)' },
    focus: ['%r = call i32 @pick(i32 %x)', 'br label %cont'],
    state: splitState,
  },
  {
    title: '第 3 步 · 克隆第一条指令 %a = mul',
    note: 'callee 的第一条指令被复制到 call 之前，名字加 .i 后缀；参数 %x 通过 ValueMap 映射到调用点的 %x，所以操作数不变。call 先留着，%r 仍由它定义。',
    before: split,
    after: clonedA,
    cursor: { line: '%a.i = mul i32 %x, 3', side: 'after' },
    focus: ['%a.i = mul i32 %x, 3'],
    state: mapA,
  },
  {
    title: '第 4 步 · 克隆第二条指令 %b = add',
    note: '继续克隆 %b，它的操作数 %a 通过 ValueMap 改写成克隆后的 %a.i。callee 的单块体到这里就复制完了，还差把返回值送回 caller。',
    before: clonedA,
    after: clonedB,
    cursor: { line: '%b.i = add i32 %a.i, 1', side: 'after' },
    focus: ['%b.i = add i32 %a.i, 1'],
    state: mapB,
  },
  {
    title: '第 5 步 · 用 %b.i 替换 %r 并删除 call',
    note: 'callee 的 ret 值在 ValueMap 里对应 %b.i。InlineFunction 把所有 %r 的使用者改成 %b.i，再把 call 删掉；callee 只有一条返回路径，所以不需要 φ，也不需要额外的 ret 块。',
    before: clonedB,
    after: inlined,
    cursor: { line: '%r = call i32 @pick(i32 %x)' },
    focus: ['%r = call i32 @pick(i32 %x)', '%s = add i32 %b.i, 10'],
    state: returnState,
  },
  {
    title: '第 6 步 · 删除已经没有调用者的 pick',
    note: 'pick 是 internal，唯一调用点在第 5 步消失了，也没有别的 live use，于是被判定为 trivially dead 并从模块删除。caller 现在只剩自己的代码。',
    before: inlined,
    after: output,
    cursor: { line: 'define internal i32 @pick(i32 %x) {' },
    state: removed,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Check that the call site can be inlined',
        note: 'The decision is already made; InlineFunction runs the pre-flight checks: the callee has a definition, is not noinline / optnone, is not in !inline_history, and has no operand bundle that cannot be expanded. pick is a single-block function with one ret, so there is one return site to record.',
      },
      {
        title: 'Step 2 · Split the caller block at the call',
        note: 'More instructions follow the call (%s and ret), so they cannot simply be appended to entry. InlineFunction splits entry in two: entry keeps the call, the instructions after it move to %cont, and a br connects the halves.',
      },
      {
        title: 'Step 3 · Clone the first instruction, %a = mul',
        note: 'The first callee instruction is copied in front of the call with an .i suffix; the argument %x maps to the caller %x through the ValueMap, so its operand is unchanged. The call stays for now and %r is still defined by it.',
      },
      {
        title: 'Step 4 · Clone the second instruction, %b = add',
        note: 'Clone %b next; its operand %a is rewritten through the ValueMap to the cloned %a.i. The single-block callee body is now fully copied; only the return value still has to travel back to the caller.',
      },
      {
        title: 'Step 5 · Replace %r with %b.i and erase the call',
        note: 'The callee ret value maps to %b.i. InlineFunction rewrites every user of %r to %b.i and deletes the call. Because the callee has one return path, no φ and no extra return block are needed.',
      },
      {
        title: 'Step 6 · Delete pick, which has no callers',
        note: 'pick is internal, its only call site disappeared in step 5, and it has no other live uses, so it is trivially dead and removed from the module. The caller now contains only its own code.',
      },
    ],
  },
});
