/**
 * 演示数据模型。
 *
 * 作者只写「前 / 后两段 IR 文本」，makeStep() 在构建期做行级 diff，
 * 把新增行标成 add、消失行标成 del，浏览器端只负责播放。
 * 这样内容作者不需要手写 mark，也不会出现标注和代码不一致。
 */

import { defaultLocale, type Locale } from '../i18n/config.ts';

export type Mark = 'keep' | 'add' | 'del' | 'focus';

export interface IRLine {
  text: string;
  mark: Mark;
}

/** 作者写的 cursor：当前正在处理的那条指令 */
export interface StepCursor {
  /** 指令文本；比较时忽略两侧缩进 */
  line: string;
  /** 箭头画在 before 还是 after 一侧；默认 before */
  side?: 'before' | 'after';
  /** 同一行出现多次时选第几个（从 1 开始）；默认 1 */
  occurrence?: number;
}

/** 构建期解析后的 cursor：直接指向某个面板里的行号 */
export interface DemoCursor {
  line: string;
  side: 'before' | 'after';
  index: number;
}

export interface DemoStep {
  title: string;
  note: string;
  before: IRLine[];
  after: IRLine[];
  /**
   * 算法内部状态快照。播放器只展示这一步的状态，新增行标绿；
   * 它让「算法怎么跑」和「IR 怎么变」出现在同一帧里。
   */
  state?: IRLine[];
  /** 这一步正在处理的那条指令；一步最多一个 */
  cursor?: DemoCursor;
}

/** 一种语言的标题与说明；IR 本身不需要翻译，所以只覆盖文案 */
export interface DemoLocalization {
  label?: string;
  steps: Array<{ title: string; note: string }>;
}

export type DemoFormat = 'llvm-ir' | 'mir';

export interface Demo {
  id: string;
  label: string;
  steps: DemoStep[];
  /**
   * 面板里放的是 LLVM IR 还是 Machine IR。
   * MIR 不是 LLVM IR：播放器不解析 CFG，也不做指令级 diff，只做行级文本 diff。
   */
  format: DemoFormat;
  /**
   * 所有步骤、前后两侧 IR 的最大行数，构建期算好。
   * 播放器据此为 IR 面板预留固定高度，切步时按钮不会上下跳动。
   */
  maxLines: number;
  /** 所有步骤里算法状态快照的最大行数；没有状态时为 0 */
  stateMaxLines: number;
  /** 除默认语言（中文）之外的界面文案 */
  localizations?: Partial<Record<Locale, DemoLocalization>>;
}

export interface StepSource {
  /** 这一步在做什么，显示在播放器标题栏 */
  title: string;
  /** 一句话解释，支持纯文本 */
  note: string;
  before: string;
  after: string;
  /**
   * 这一步需要重点关注的 IR 行，可以在前后两个面板同时高亮。
   * 它不表示「当前指令」；当前指令用 `cursor` 单独标出。
   */
  focus?: string[];
  /**
   * 当前正在处理的那条指令。箭头画在 IR 最左边，一步只能有一个。
   * 用 `side` 指定画在 before 还是 after；默认 before。
   */
  cursor?: StepCursor;
  /**
   * 算法内部状态快照，写这一步结束时的完整状态。
   * `makeDemo()` 会把它和上一步做行级 diff，新增行标绿；
   * 没有变动的行保持普通样式。内容用标识符、数字和符号，避免语言依赖。
   */
  state?: string;
  /** 状态快照里只观察、没有改写的行 */
  stateFocus?: string[];
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

const focusSet = (lines?: string[]): Set<string> =>
  new Set((lines ?? []).map((line) => line.trim()));

const applyFocus = (lines: IRLine[], focus: Set<string>): IRLine[] =>
  lines.map((line) =>
    line.mark === 'keep' && focus.has(line.text.trim()) ? { ...line, mark: 'focus' } : line,
  );

/** 把作者写的 cursor 解析成具体面板里的行号；找不到就是内容错误，构建期直接报错 */
function resolveCursor(source: StepCursor, before: IRLine[], after: IRLine[]): DemoCursor {
  const side = source.side ?? 'before';
  const lines = side === 'after' ? after : before;
  const wanted = source.line.trim();
  const occurrence = source.occurrence ?? 1;

  if (occurrence < 1 || !Number.isInteger(occurrence)) {
    throw new Error(`[demo] cursor occurrence must be a positive integer: ${source.line}`);
  }

  let seen = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].text.trim() !== wanted) continue;
    seen += 1;
    if (seen === occurrence) return { line: lines[index].text, side, index };
  }

  throw new Error(
    `[demo] cursor not found on ${side} (occurrence ${occurrence}): ${wanted}`,
  );
}

export function makeStep(source: StepSource): DemoStep {
  const { before, after } = diff(toLines(source.before), toLines(source.after));
  // 作者写的 focus 行不带缩进；IRLine 保留缩进，比较前统一 trim
  const state = source.state
    ? applyFocus(
        toLines(source.state).map((text) => ({ text, mark: 'keep' as Mark })),
        focusSet(source.stateFocus),
      )
    : undefined;
  const cursor = source.cursor ? resolveCursor(source.cursor, before, after) : undefined;

  return {
    title: source.title,
    note: source.note,
    before: applyFocus(before, focusSet(source.focus)),
    after: applyFocus(after, focusSet(source.focus)),
    ...(state ? { state } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

export function makeDemo(
  id: string,
  label: string,
  sources: StepSource[],
  localizations?: Partial<Record<Locale, DemoLocalization>>,
  options?: { format?: DemoFormat },
): Demo {
  const steps = sources.map(makeStep);

  // 状态快照按步 diff：只保留当前步的行，把相对上一步新增的行标绿。
  // 删除的行从面板里消失（说明文字负责解释），这样状态变化始终只占一张快照的高度。
  let previousState: string[] | undefined;
  steps.forEach((step, index) => {
    if (!step.state) {
      previousState = undefined;
      return;
    }

    if (previousState) {
      const next = diff(previousState, step.state.map((line) => line.text));
      step.state = applyFocus(next.after, focusSet(sources[index].stateFocus));
    }
    previousState = step.state.map((line) => line.text);
  });

  const maxLines = steps.reduce(
    (max, step) => Math.max(max, step.before.length, step.after.length),
    0,
  );
  const stateMaxLines = steps.reduce((max, step) => Math.max(max, step.state?.length ?? 0), 0);

  return {
    id,
    label,
    steps,
    format: options?.format ?? 'llvm-ir',
    maxLines,
    stateMaxLines,
    localizations,
  };
}

/** 取某种语言的演示；没有翻译时回退到默认文案，保证页面永远有内容 */
export function localizeDemo(demo: Demo, locale: Locale = defaultLocale): Demo {
  const copy = demo.localizations?.[locale];
  if (!copy) return demo;

  return {
    ...demo,
    label: copy.label ?? demo.label,
    steps: demo.steps.map((step, index) => ({
      ...step,
      title: copy.steps[index]?.title ?? step.title,
      note: copy.steps[index]?.note ?? step.note,
    })),
  };
}
