import { makeDemo } from './types';

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
  %dead = mul i32 %x, 7          ; dead：没人用，也没有副作用
  %live = add i32 %x, 1          ; live：被 ret 直接使用
  %cmp = icmp sgt i32 %live, 0   ; dead：结果没人用
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
]);
