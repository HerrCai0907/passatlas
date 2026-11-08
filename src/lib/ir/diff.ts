/**
 * 指令级 diff：为 CFG 视图标出「这一步新增 / 删除 / 需要关注」的指令。
 *
 * 和 `demos/types.ts` 里的行级 diff 分开：
 * - 行 diff 用于 IR 文本视图，保留注释、空行和标点变化；
 * - 指令 diff 只比较解析后的指令文本，注释增删不会让整段基本块变红变绿。
 *
 * 输出按「基本块 id + 指令下标」索引，和 `CFGCanvas` 的渲染单位一致。
 */
import type { IRFunction } from './parse.ts';

export type InstructionMark = 'add' | 'del' | 'focus';

export interface InstructionDiff {
  /** before 图里要标红的指令 */
  before: ReadonlyMap<string, InstructionMark>;
  /** after 图里要标绿的指令 */
  after: ReadonlyMap<string, InstructionMark>;
  added: number;
  removed: number;
}

interface FlatInstruction {
  key: string;
  text: string;
}

/** CFGCanvas 用同一个键把标记贴回指令行 */
export function instructionKey(blockId: string, index: number): string {
  return `${blockId}#${index}`;
}

function flatten(fn: IRFunction): FlatInstruction[] {
  const items: FlatInstruction[] = [];
  for (const block of fn.blocks) {
    block.instructions.forEach((instruction, index) => {
      items.push({ key: instructionKey(block.id, index), text: instruction.text });
    });
  }
  return items;
}

/**
 * 对指令文本做 LCS，得到两侧的标记。
 * `focus` 是内容作者写的关注行；只有两侧都保留的指令才会升级成 focus，
 * 新增 / 删除的优先级更高，和 IR 文本视图的行 diff 保持一致。
 */
export function diffInstructions(
  before: IRFunction,
  after: IRFunction,
  focus: readonly string[] = [],
): InstructionDiff {
  const a = flatten(before);
  const b = flatten(after);
  const n = a.length;
  const m = b.length;

  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i]!.text === b[j]!.text
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i][j + 1]!);
    }
  }

  const focusTexts = new Set(focus.map((line) => line.trim()));
  const beforeMarks = new Map<string, InstructionMark>();
  const afterMarks = new Map<string, InstructionMark>();
  let added = 0;
  let removed = 0;

  const markKept = (left: FlatInstruction, right: FlatInstruction) => {
    if (!focusTexts.has(left.text)) return;
    beforeMarks.set(left.key, 'focus');
    afterMarks.set(right.key, 'focus');
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]!.text === b[j]!.text) {
      markKept(a[i]!, b[j]!);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      beforeMarks.set(a[i]!.key, 'del');
      removed += 1;
      i += 1;
    } else {
      afterMarks.set(b[j]!.key, 'add');
      added += 1;
      j += 1;
    }
  }

  while (i < n) {
    beforeMarks.set(a[i]!.key, 'del');
    removed += 1;
    i += 1;
  }
  while (j < m) {
    afterMarks.set(b[j]!.key, 'add');
    added += 1;
    j += 1;
  }

  return { before: beforeMarks, after: afterMarks, added, removed };
}
