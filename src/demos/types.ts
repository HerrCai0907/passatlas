/**
 * 演示数据模型。
 *
 * 作者只写「前 / 后两段 IR 文本」，makeStep() 在构建期做行级 diff，
 * 把新增行标成 add、消失行标成 del，浏览器端只负责播放。
 * 这样内容作者不需要手写 mark，也不会出现标注和代码不一致。
 */

export type Mark = 'keep' | 'add' | 'del' | 'focus';

export interface IRLine {
  text: string;
  mark: Mark;
}

export interface DemoStep {
  title: string;
  note: string;
  before: IRLine[];
  after: IRLine[];
}

export interface Demo {
  id: string;
  label: string;
  steps: DemoStep[];
  /**
   * 所有步骤、前后两侧 IR 的最大行数，构建期算好。
   * 播放器据此为 IR 面板预留固定高度，切步时按钮不会上下跳动。
   */
  maxLines: number;
}

export interface StepSource {
  /** 这一步在做什么，显示在播放器标题栏 */
  title: string;
  /** 一句话解释，支持纯文本 */
  note: string;
  before: string;
  after: string;
  /** 需要在前后两个面板同时高亮的行（用于「这一步只是观察，没有改写」的场景） */
  focus?: string[];
}

const dedent = (lines: string[]): string[] => {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^[ \t]*/) ?? [''])[0].length);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(min).replace(/[ \t]+$/, ''));
};

const toLines = (source: string): string[] => {
  const lines = dedent(source.replace(/\t/g, '  ').split('\n'));
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
};

/** 经典 LCS 行 diff；演示用 IR 都很短，O(n·m) 足够 */
const diff = (
  before: string[],
  after: string[],
): { before: IRLine[]; after: IRLine[] } => {
  const n = before.length;
  const m = after.length;
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] =
        before[i] === after[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const beforeLines: IRLine[] = [];
  const afterLines: IRLine[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (before[i] === after[j]) {
      beforeLines.push({ text: before[i], mark: 'keep' });
      afterLines.push({ text: after[j], mark: 'keep' });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      beforeLines.push({ text: before[i], mark: 'del' });
      i += 1;
    } else {
      afterLines.push({ text: after[j], mark: 'add' });
      j += 1;
    }
  }

  while (i < n) {
    beforeLines.push({ text: before[i], mark: 'del' });
    i += 1;
  }
  while (j < m) {
    afterLines.push({ text: after[j], mark: 'add' });
    j += 1;
  }

  return { before: beforeLines, after: afterLines };
};

export function makeStep(source: StepSource): DemoStep {
  const { before, after } = diff(toLines(source.before), toLines(source.after));
  // 作者写的 focus 行不带缩进；IRLine 保留缩进，比较前统一 trim
  const focus = new Set((source.focus ?? []).map((line) => line.trim()));

  const applyFocus = (lines: IRLine[]): IRLine[] =>
    lines.map((line) =>
      line.mark === 'keep' && focus.has(line.text.trim()) ? { ...line, mark: 'focus' } : line,
    );

  return {
    title: source.title,
    note: source.note,
    before: applyFocus(before),
    after: applyFocus(after),
  };
}

export function makeDemo(
  id: string,
  label: string,
  sources: StepSource[],
): Demo {
  const steps = sources.map(makeStep);
  const maxLines = steps.reduce(
    (max, step) => Math.max(max, step.before.length, step.after.length),
    0,
  );

  return { id, label, steps, maxLines };
}
