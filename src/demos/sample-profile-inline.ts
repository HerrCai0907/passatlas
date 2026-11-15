import { makeDemo } from './types.ts';

const input = `
; main 100k / foo 98k / bar 95k
define i32 @main() {
entry:
  %a = call i32 @foo(i32 7)
  ret i32 %a
}

define i32 @foo(i32 %v) {
entry:
  %r = call i32 @bar(i32 %v)
  ret i32 %r
}

define i32 @bar(i32 %v) {
entry:
  %t = mul i32 %v, 2
  ret i32 %t
}
`;

const inlinedFoo = `
; main 100k / foo 98k / bar 95k
define i32 @main() {
entry:
  %r.i = call i32 @bar(i32 7)
  ret i32 %r.i
}

define i32 @foo(i32 %v) {
entry:
  %r = call i32 @bar(i32 %v)
  ret i32 %r
}

define i32 @bar(i32 %v) {
entry:
  %t = mul i32 %v, 2
  ret i32 %t
}
`;

const inlinedBar = `
; main 100k / foo 98k / bar 95k
define i32 @main() {
entry:
  %t.i = mul i32 7, 2
  ret i32 %t.i
}

define i32 @foo(i32 %v) {
entry:
  %r = call i32 @bar(i32 %v)
  ret i32 %r
}

define i32 @bar(i32 %v) {
entry:
  %t = mul i32 %v, 2
  ret i32 %t
}
`;

const queued = [
  'queue    samples  context  action',
  'foo      98000    main     push (only call in main)',
  'bar      -        -        not reached yet',
].join('\n');

const hot = [
  'queue    samples  context  action',
  'foo      98000    main     pop',
  'threshold 3000   hot: yes   inline: yes',
].join('\n');

const fooInlined = [
  'queue    samples  context  action',
  '-        -        -        empty',
  'inlined  main:foo  98000  outline copy: no samples',
].join('\n');

const barQueued = [
  'queue    samples  context    action',
  'bar      95000    main:foo   push (exposed by inlining foo)',
].join('\n');

const barInlined = [
  'queue    samples  context        action',
  '-        -        -              empty',
  'inlined  main:foo:bar  95000   outline copy: no samples',
].join('\n');

const done = [
  'queue    samples  context  action',
  '-        -        -        done',
  'next     instcombine folds mul i32 7, 2',
].join('\n');

export const sampleProfileInlineDemo = makeDemo('sample-profile-inline', 'sample-profile-inline', [
  {
    title: '第 1 步 · 把 main 的调用点放进队列',
    note: 'sample-profile 按函数处理，先把 main 里的每条 call 变成 InlineCandidate：callee 的样本数、按重复调用点分摊后的 CallsiteCount、以及分摊系数。@foo 有 98000 个样本，是当前唯一的候选。',
    before: input,
    after: input,
    cursor: { line: '%a = call i32 @foo(i32 7)' },
    focus: ['%a = call i32 @foo(i32 7)'],
    state: queued,
  },
  {
    title: '第 2 步 · 和热调用点阈值比较',
    note: '98000 远高于热调用点阈值 3000，所以这个调用点不需要做完整的 cost 比较：只要 getInlineCost 不报 noinline / optnone 这类硬拒绝，就可以直接内联。',
    before: input,
    after: input,
    cursor: { line: '%a = call i32 @foo(i32 7)' },
    focus: ['%a = call i32 @foo(i32 7)'],
    state: hot,
  },
  {
    title: '第 3 步 · 展开 foo',
    note: 'loader 调用 InlineFunction 把 foo 展开进 main。foo 的 main:foo 上下文被标记为已内联，之后 outline 出来的 foo 副本不再有样本；main 里原本的返回关系变成对 %r.i 的 return。',
    before: input,
    after: inlinedFoo,
    cursor: { line: '%a = call i32 @foo(i32 7)' },
    focus: ['%r.i = call i32 @bar(i32 7)'],
    state: fooInlined,
  },
  {
    title: '第 4 步 · 新暴露的 bar 调用点带着更长的上下文入队',
    note: '内联把 @bar 的调用暴露在 main 里：上下文从 bar 变成 main:foo，样本仍是 95000，依然是最热的候选，于是入队。上下文越长，profile 的区分度越高，这正是 CSSPGO 的核心。',
    before: inlinedFoo,
    after: inlinedFoo,
    cursor: { line: '%r.i = call i32 @bar(i32 7)' },
    focus: ['%r.i = call i32 @bar(i32 7)'],
    state: barQueued,
  },
  {
    title: '第 5 步 · 展开 bar',
    note: 'queue 里只剩 bar，它同样超过阈值，被展开成 main:foo:bar 上下文。bar 的函数体只有一条 mul，内联后参数 %v 被替换成常量 7。',
    before: inlinedFoo,
    after: inlinedBar,
    cursor: { line: '%r.i = call i32 @bar(i32 7)' },
    focus: ['%t.i = mul i32 7, 2'],
    state: barInlined,
  },
  {
    title: '第 6 步 · 队列清空',
    note: '没有新的调用点暴露出来，队列空了，这个函数处理结束。常量乘法 mul i32 7, 2 不会留在这里，后面的 instcombine 会把它折成 14。',
    before: inlinedBar,
    after: inlinedBar,
    cursor: { line: '%t.i = mul i32 7, 2' },
    focus: ['%t.i = mul i32 7, 2'],
    state: done,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Queue the call site in main',
        note: 'sample-profile works per function and turns each call in main into an InlineCandidate: the callee samples, the prorated CallsiteCount and the distribution factor. @foo has 98000 samples and is the only candidate here.',
      },
      {
        title: 'Step 2 · Compare with the hot-callsite threshold',
        note: '98000 is far above the 3000 hot-callsite threshold, so this call site does not need a full cost comparison: as long as getInlineCost does not report a hard reject such as noinline / optnone, it can be inlined directly.',
      },
      {
        title: 'Step 3 · Expand foo',
        note: 'The loader calls InlineFunction to expand foo into main. The main:foo context is marked inlined, so the outlined copy of foo has no samples afterwards; the original return through %a becomes a return of %r.i.',
      },
      {
        title: 'Step 4 · The newly exposed bar call queues with a longer context',
        note: 'Inlining exposes the @bar call inside main: its context changes from bar to main:foo, its 95000 samples still make it the hottest candidate, so it is queued. A longer context is exactly what gives CSSPGO its extra precision.',
      },
      {
        title: 'Step 5 · Expand bar',
        note: 'Only bar is left in the queue; it also exceeds the threshold and is expanded into the main:foo:bar context. bar has a single mul, so after inlining its argument %v is replaced by the constant 7.',
      },
      {
        title: 'Step 6 · The queue drains',
        note: 'No new call sites are exposed and the queue is empty, so this function is done. The constant multiply mul i32 7, 2 does not stay here: the later instcombine folds it to 14.',
      },
    ],
  },
});
