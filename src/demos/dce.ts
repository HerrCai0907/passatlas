import { makeDemo } from './types.ts';

const inputIR = `
define i32 @f(i32 %x) {
  %dead = mul i32 %x, 7
  %live = add i32 %x, 1
  %cmp = icmp sgt i32 %live, 0
  ret i32 %live
}
`;

const annotatedIR = `
define i32 @f(i32 %x) {
  %dead = mul i32 %x, 7          ; dead: no users, no side effects
  %live = add i32 %x, 1          ; live: used directly by ret
  %cmp = icmp sgt i32 %live, 0   ; dead: the result has no users
  ret i32 %live
}
`;

const outputIR = `
define i32 @f(i32 %x) {
  %live = add i32 %x, 1
  ret i32 %live
}
`;

export const dceDemo = makeDemo('dce', 'dce', [
  {
    title: '第 1 步 · 从「有副作用」的指令反向标记',
    note: '活跃性从根出发反推：ret、store、call 等有副作用的指令是根，它们用到的操作数也活跃，如此沿 use 链回溯。注释只是讲解标记，不是编译器输出。',
    before: inputIR,
    after: annotatedIR,
  },
  {
    title: '第 2 步 · 清扫未被标记的指令',
    note: '%dead 与 %cmp 从未被标记为活跃，直接删除。ADCE 会多做一步：同时把不可达的基本块从 CFG 里摘掉，并合并空块。',
    before: annotatedIR,
    after: outputIR,
  },
],
  {
    en: {
      steps: [
      {
        title: 'Step 1 · Mark backwards from instructions with side effects',
        note: 'Liveness starts from the roots and walks backwards: ret, store, call and other instructions with observable side effects are roots, and their operands are live too, so we follow the use chain. The comments are teaching annotations, not compiler output.',
      },
      {
        title: 'Step 2 · Sweep unmarked instructions',
        note: '%dead and %cmp were never marked live, so they are deleted. ADCE does one more thing: it removes unreachable basic blocks from the CFG and merges empty ones.',
      },
      ],
    },
  },
);
