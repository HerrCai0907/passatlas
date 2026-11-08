import { makeDemo } from './types';

const step0 = `
define i32 @scale(i32 %x) {
  %a = add i32 %x, 0
  %b = mul i32 %a, 8
  %c = sub i32 %b, %b
  %d = or i32 %c, 0
  ret i32 %d
}
`;

const step1 = `
define i32 @scale(i32 %x) {
  %b = mul i32 %x, 8
  %c = sub i32 %b, %b
  ret i32 %c
}
`;

const step2 = `
define i32 @scale(i32 %x) {
  %b = shl i32 %x, 3
  %c = sub i32 %b, %b
  ret i32 %c
}
`;

const step3 = `
define i32 @scale(i32 %x) {
  %b = shl i32 %x, 3
  ret i32 0
}
`;

export const instcombineDemo = makeDemo('instcombine', 'instcombine', [
  {
    title: '第 1 步 · 消掉恒等运算',
    note: 'add x, 0 与 or x, 0 不改变值，直接用操作数替换所有使用者，指令本身随即删除。这类改写不需要额外分析，纯模式匹配即可。',
    before: step0,
    after: step1,
  },
  {
    title: '第 2 步 · 乘以 2 的幂变成左移',
    note: '常量 8 是 2 的幂，乘法可以换成移位。指令更便宜，也给后端的指令选择留下更明确的形状。',
    before: step1,
    after: step2,
  },
  {
    title: '第 3 步 · x - x 折叠成 0',
    note: 'sub %b, %b 恒为 0，ret 直接返回常量。注意 %b 已经没人使用，但 instcombine 只做局部化简，这条死代码要留给 DCE。',
    before: step2,
    after: step3,
    focus: ['%b = shl i32 %x, 3'],
  },
]);
