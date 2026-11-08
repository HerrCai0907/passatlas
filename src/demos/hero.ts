import { makeDemo } from './types';

/**
 * 首页 hero 用的短演示：去掉分支，只保留「栈上变量 → 常量 → 一条 ret」的骨架，
 * 让 480px 宽的控制台里每行都能完整显示。
 */
const step0 = `
define i32 @one() {
  %x = alloca i32
  store i32 1, ptr %x
  %v = load i32, ptr %x
  ret i32 %v
}
`;

const step1 = `
define i32 @one() {
  %x = alloca i32
  store i32 1, ptr %x
  ret i32 1
}
`;

const step2 = `
define i32 @one() {
  ret i32 1
}
`;

export const heroDemo = makeDemo('mem2reg', 'mem2reg', [
  {
    title: '第 1 步 · 找到栈上的变量（只观察）',
    note: '%x 只有一次 store、一次 load，地址没有逃逸 —— mem2reg 可以把它提升成寄存器里的值。',
    before: step0,
    after: step0,
    focus: ['%x = alloca i32'],
  },
  {
    title: '第 2 步 · 把 load 换成唯一到达的定义',
    note: '沿支配树做重命名：这条 load 只会读到常量 1，于是所有使用者直接换成 1。',
    before: step0,
    after: step1,
  },
  {
    title: '第 3 步 · 清掉失去使用者的指令',
    note: 'alloca 与 store 不再被使用，作为死指令删除。函数进入 SSA 形式，只剩一条 ret。',
    before: step1,
    after: step2,
  },
]);
