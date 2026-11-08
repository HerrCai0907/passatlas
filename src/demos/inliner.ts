import { makeDemo } from './types';

const inputIR = `
define i32 @total(i32 %x) {
entry:
  %sum = call i32 @scale(i32 %x)
  %res = add i32 %sum, 1
  ret i32 %res
}

define internal i32 @scale(i32 %x) {
entry:
  %mul = mul i32 %x, 3
  ret i32 %mul
}
`;

const inlineIR = `
define i32 @total(i32 %x) {
entry:
  %mul.i = mul i32 %x, 3
  %res = add i32 %mul.i, 1
  ret i32 %res
}

define internal i32 @scale(i32 %x) {
entry:
  %mul = mul i32 %x, 3
  ret i32 %mul
}
`;

const cleanedIR = `
define i32 @total(i32 %x) {
entry:
  %mul.i = mul i32 %x, 3
  %res = add i32 %mul.i, 1
  ret i32 %res
}
`;

export const inlinerDemo = makeDemo('inliner', 'cgscc inline', [
  {
    title: '第 1 步 · 先看代价，不急着改',
    note: '内联器先过属性闸门，再分析 scale 的代价：两条指令加调用开销，远低于默认阈值 225。下面接着看真正的改写；注释是讲解标记，不是编译器输出。',
    before: inputIR,
    after: inputIR,
    focus: ['  %sum = call i32 @scale(i32 %x)', '  %mul = mul i32 %x, 3'],
  },
  {
    title: '第 2 步 · 克隆 callee，替换参数与返回值',
    note: 'InlineFunction 把 scale 的函数体克隆进 total：实参 %x 替换形参，克隆出的 %mul 带上 .i 后缀（避免与 caller 的名字冲突），ret 的值接过 %sum 的所有使用。call 指令消失。',
    before: inputIR,
    after: inlineIR,
  },
  {
    title: '第 3 步 · 清扫死函数',
    note: 'scale 是 internal、唯一调用点刚被内联、零 live use，于是被判定为 trivially dead：函数体被掏空并排队，最后随 CGSCC 的 dead function 列表一起删除。',
    before: inlineIR,
    after: cleanedIR,
  },
]);
