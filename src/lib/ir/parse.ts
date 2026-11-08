/**
 * 一个够用的 LLVM 文本 IR 解析器：只关心「函数 → 基本块 → 指令 → 控制流边」。
 *
 * 设计约束：
 * - 不依赖 LLVM、不在浏览器里编译任何东西，纯字符串解析，几微秒级；
 * - 只解析展示所需的信息，遇到不认识的语法退化为普通指令，不抛异常；
 * - 所有问题通过 issues 返回，UI 决定怎么展示。
 */

export type EdgeKind =
  | 'branch'
  | 'true'
  | 'false'
  | 'switch'
  | 'default'
  | 'normal'
  | 'unwind'
  | 'indirect';

export interface IRInstruction {
  /** 去掉注释、trim 之后的整行文本 */
  text: string;
  /** 操作码，如 load / br / phi */
  opcode: string;
  /** 是否终结指令（br、ret、switch……） */
  terminator: boolean;
}

export interface IRBlock {
  id: string;
  label: string;
  instructions: IRInstruction[];
  terminator: IRInstruction | null;
}

export interface IREdge {
  from: string;
  to: string;
  label?: string;
  kind: EdgeKind;
}

export interface IRFunction {
  name: string;
  blocks: IRBlock[];
  edges: IREdge[];
}

export interface IRParseIssue {
  line: number;
  message: string;
}

export interface IRParseResult {
  functions: IRFunction[];
  issues: IRParseIssue[];
}

const TERMINATORS = new Set([
  'ret',
  'br',
  'switch',
  'indirectbr',
  'invoke',
  'callbr',
  'resume',
  'unreachable',
  'cleanupret',
  'catchret',
  'catchswitch',
]);

const TAIL_PREFIX = new Set(['tail', 'musttail', 'notail']);

/** 去掉行内注释，跳过字符串字面量里的分号 */
function stripComment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ';' && !quoted) return line.slice(0, i);
  }
  return line;
}

/** switch / callbr 这类指令的标签数组会跨行，用方括号是否配平来判断 */
function bracketBalance(text: string): number {
  let balance = 0;
  for (const ch of text) {
    if (ch === '[') balance += 1;
    else if (ch === ']') balance -= 1;
  }
  return balance;
}

function normaliseLabel(raw: string): string {
  return raw.trim().replace(/^%/, '').replace(/^"(.*)"$/, '$1');
}

function opcodeOf(text: string): string {
  const withResult = /^%[^\s=]+\s*=\s*([a-z]+)\b/.exec(text);
  if (withResult?.[1]) return withResult[1];
  const plain = /^([a-z]+)\b/.exec(text);
  const op = plain?.[1] ?? '';
  return TAIL_PREFIX.has(op) ? 'call' : op;
}

function makeInstruction(text: string): IRInstruction {
  const opcode = opcodeOf(text);
  return { text, opcode, terminator: TERMINATORS.has(opcode) };
}

const LABEL_PATTERN = /^%?("[^"]+"|[-$\w.]+):$/;
const LABEL_REF = /label\s+%?("[^"]+"|[-$\w.]+)/g;

function labelsIn(text: string): string[] {
  return [...text.matchAll(LABEL_REF)].map((match) => normaliseLabel(match[1] ?? ''));
}

function edgesOf(block: IRBlock): IREdge[] {
  const term = block.terminator;
  if (!term) return [];

  const labels = labelsIn(term.text);
  const edge = (to: string, kind: EdgeKind, label?: string): IREdge => ({
    from: block.id,
    to,
    kind,
    ...(label ? { label } : {}),
  });

  switch (term.opcode) {
    case 'br': {
      if (labels.length >= 2) {
        return [edge(labels[0]!, 'true', 'true'), edge(labels[1]!, 'false', 'false')];
      }
      return labels[0] ? [edge(labels[0], 'branch')] : [];
    }

    case 'switch': {
      const edges: IREdge[] = [];
      if (labels[0]) edges.push(edge(labels[0], 'default', 'default'));

      const casePattern = /i32\s+(-?\d+)\s*,\s*label\s+%?("[^"]+"|[-$\w.]+)/g;
      for (const match of term.text.matchAll(casePattern)) {
        edges.push(edge(normaliseLabel(match[2] ?? ''), 'switch', match[1] ?? 'case'));
      }
      return edges;
    }

    case 'invoke': {
      const edges: IREdge[] = [];
      if (labels[0]) edges.push(edge(labels[0], 'normal', 'normal'));
      if (labels[1]) edges.push(edge(labels[1], 'unwind', 'unwind'));
      return edges;
    }

    case 'callbr': {
      const edges: IREdge[] = [];
      if (labels[0]) edges.push(edge(labels[0], 'normal', 'fallthrough'));
      for (const label of labels.slice(1)) edges.push(edge(label, 'indirect', 'indirect'));
      return edges;
    }

    case 'indirectbr':
      return labels.map((label) => edge(label, 'indirect'));

    case 'catchswitch': {
      const unwindAt = term.text.indexOf('unwind label');
      const edges: IREdge[] = [];
      for (const label of labels) {
        const index = term.text.indexOf(`%${label}`);
        const kind: EdgeKind = unwindAt >= 0 && index > unwindAt ? 'unwind' : 'indirect';
        edges.push(edge(label, kind, kind === 'unwind' ? 'unwind' : undefined));
      }
      return edges;
    }

    default:
      return [];
  }
}

export function parseIR(source: string): IRParseResult {
  const issues: IRParseIssue[] = [];
  const functions: IRFunction[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  let index = 0;
  while (index < lines.length) {
    const raw = lines[index] ?? '';

    if (!/^\s*define\b/.test(raw)) {
      index += 1;
      continue;
    }

    const defineLine = index + 1;
    const nameMatch = /define\b[^@]*@("([^"]+)"|[-$\w.]+)/.exec(raw);
    const name = nameMatch
      ? normaliseLabel(nameMatch[2] ?? nameMatch[1] ?? 'anonymous')
      : `fn_${functions.length}`;

    index += 1;
    const blocks: IRBlock[] = [];
    const seen = new Set<string>();
    let current: IRBlock | null = null;
    let closed = false;

    const startBlock = (label: string): IRBlock => {
      if (current) blocks.push(current);
      const block: IRBlock = { id: label, label, instructions: [], terminator: null };
      current = block;
      seen.add(label);
      return block;
    };

    while (index < lines.length) {
      const lineIndex = index + 1;
      const line = stripComment(lines[index] ?? '').trim();
      index += 1;

      if (line === '') continue;

      if (line === '}') {
        closed = true;
        break;
      }

      const labelMatch = LABEL_PATTERN.exec(line);
      if (labelMatch) {
        const label = normaliseLabel(labelMatch[1] ?? '');
        if (seen.has(label)) {
          issues.push({ line: lineIndex, message: `基本块 ${label} 重复定义` });
        }
        startBlock(label);
        continue;
      }

      const block = current ?? startBlock('entry');

      // 把跨行的 switch / callbr 合并成一条指令，行内换行保留给渲染层
      const parts = [line];
      while (bracketBalance(parts.join('\n')) > 0 && index < lines.length) {
        const next = stripComment(lines[index] ?? '').trim();
        index += 1;
        if (next === '') continue;
        if (next === '}') {
          closed = true;
          break;
        }
        parts.push(next);
      }

      const instruction = makeInstruction(parts.join('\n'));
      block.instructions.push(instruction);
      if (instruction.terminator) block.terminator = instruction;
    }

    if (current) blocks.push(current);

    if (!closed) {
      issues.push({ line: defineLine, message: `函数 @${name} 缺少结尾的 }` });
    }

    if (blocks.length === 0) {
      issues.push({ line: defineLine, message: `函数 @${name} 里没有基本块` });
      continue;
    }

    const byId = new Map(blocks.map((block) => [block.id, block]));
    const edges: IREdge[] = [];

    for (const block of blocks) {
      if (!block.terminator) {
        issues.push({
          line: defineLine,
          message: `基本块 ${block.label} 没有终结指令（br / ret / switch…）`,
        });
      }

      for (const edge of edgesOf(block)) {
        if (!byId.has(edge.to)) {
          issues.push({
            line: defineLine,
            message: `基本块 ${block.label} 跳转到了不存在的 ${edge.to}`,
          });
          continue;
        }
        edges.push(edge);
      }
    }

    functions.push({ name, blocks, edges });
  }

  if (functions.length === 0 && source.trim() !== '') {
    issues.push({ line: 1, message: '没有找到 define 定义的函数' });
  }

  return { functions, issues };
}
