/**
 * 站点里出现的两种 IR：LLVM IR 与 Machine IR（MIR）。
 *
 * 它们共享「函数 / 基本块 / 指令 / 控制流边」这套展示模型，但文本语法完全不同：
 * 解析器、语法高亮和 CFG 的边语义都按 format 分开实现。
 */
export type IRFormat = 'llvm-ir' | 'mir';

/** 交给 CSS 的作用域类：同一套 token 类在不同 format 下换一套配色 */
export function formatClass(format: IRFormat): 'is-llvm' | 'is-mir' {
  return format === 'mir' ? 'is-mir' : 'is-llvm';
}
