/**
 * 默认展示模式：CFG 图只在「有多个基本块可看」时才比 IR 文本更有信息量。
 *
 * - 单基本块输入（含空输入）画出来只有一张卡片，默认 IR 文本；
 * - 任一个函数有两个以上基本块时，默认 CFG。
 *
 * 这只决定默认值，用户仍然可以随时用 [CFG | IR] 切换。
 */
import type { IRParseResult } from './parse.ts';

export function prefersIRView(result: IRParseResult): boolean {
  return result.functions.every((fn) => fn.blocks.length <= 1);
}
