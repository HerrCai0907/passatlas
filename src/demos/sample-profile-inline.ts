import { makeDemo } from './types.ts';

const inputIR = `
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

const inlinedFooIR = `
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

const inlinedBarIR = `
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

export const sampleProfileInlineDemo = makeDemo('sample-profile-inline', 'sample-profile-inline', [
  {
    title: '第 1 步 · 把 call site 排进候选队列',
    note: 'main 里的每条 call 都变成一个 InlineCandidate：记下 callee 的样本指针、按重复调用点分摊后的 CallsiteCount，以及分摊系数。@foo 有 98000 个样本，排在队列最前面。',
    before: inputIR,
    after: inputIR,
    focus: ['%a = call i32 @foo(i32 7)'],
  },
  {
    title: '第 2 步 · 热调用点直接展开',
    note: '98000 远高于热调用点阈值 3000。getInlineCost 只负责确认它不是 noinline / optnone 这类硬拒绝，于是 loader 直接调 InlineFunction。foo 的 main:foo 上下文被标记为已内联，outline 副本从此没有样本。',
    before: inputIR,
    after: inlinedFooIR,
  },
  {
    title: '第 3 步 · 新调用点带着更长的上下文入队',
    note: '内联把 @bar 的 call 暴露在 main 里：上下文从 bar 变成 main:foo，95000 个样本仍然最热，于是入队并继续展开。队列空了，这个函数处理结束；后面还有 instcombine 会把 mul 折成 14。',
    before: inlinedFooIR,
    after: inlinedBarIR,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Queue every call site',
        note: 'Each call in main becomes an InlineCandidate: the callee\'s samples, the prorated CallsiteCount and the distribution factor. @foo has 98000 samples and takes the front of the queue.',
      },
      {
        title: 'Step 2 · Expand the hot call site',
        note: '98000 is far above the 3000 hot-callsite threshold. getInlineCost is only asked whether the call is a hard reject (noinline, optnone), so the loader calls InlineFunction directly. The main:foo context is marked inlined and the outlined copy of foo is left without samples.',
      },
      {
        title: 'Step 3 · The new call site queues with a longer context',
        note: 'Inlining exposes the @bar call inside main: its context is now main:foo and its 95000 samples are still the hottest candidate, so it is queued and expanded too. The queue drains and the function is done; instcombine will later fold mul into 14.',
      },
    ],
  },
});
