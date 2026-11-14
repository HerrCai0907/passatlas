/**
 * MIR（Machine IR）文本解析器。
 *
 * 与 LLVM IR 解析器分开：MIR 是 YAML 文档（`---` / `name:` / `body: |`）里嵌
 * 机器基本块（`bb.0.entry:`）、虚拟寄存器、寄存器类和 target opcode。
 * 这里只抽取展示 CFG 所需的部分：
 *
 * - 机器函数 → 机器基本块 → 指令；
 * - `successors:` 行或 `JMP_1 %bb.N` / `JCC_1 %bb.N` / `B %bb.N` 里的跳转目标；
 * - 条件跳转的目标标 `taken`，顺序落下的边标 `fallthrough`。
 *
 * 和 LLVM IR 解析器一样：不抛异常，问题通过 issues 返回。
 */

import { defaultLocale, type Locale } from '../../i18n/config.ts';
import { t } from '../../i18n/ui.ts';
import type {
  IRBlock,
  IREdge,
  IRFunction,
  IRInstruction,
  IRParseIssue,
  IRParseResult,
} from '../ir/parse.ts';
import { isMIRConditionalBranch, isMIRTerminator, mirBlockRefs, mirOpcode } from './opcodes.ts';

const DOC_SEPARATOR = /^\s*---\s*$/;
const NAME_KEY = /^name:\s*(.*)$/;
const BODY_KEY = /^body:\s*\|?\s*$/;
const BLOCK_HEADER = /^(bb\.[\w.]+?)(?:\s+\(([^)]*)\))?:$/;
const SUCCESSORS_KEY = /^successors:\s*(.*)$/;
const BLOCK_METADATA = /^(liveins|successors|predecessors|stack|frameInfo|registers|fixedStack|machineFunctionInfo|constants):/;

/** 去掉 MIR 的行内注释；YAML 用 #，MIR 指令里也常见 ; */
function stripComment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '#' || ch === ';')) return line.slice(0, i);
  }
  return line;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function normaliseName(raw: string): string {
  return raw.trim().replace(/^"(.*)"$/, '$1');
}

function makeInstruction(text: string): IRInstruction {
  const opcode = mirOpcode(text);
  return { text, opcode, terminator: isMIRTerminator(opcode) };
}

interface MIRDocument {
  lines: string[];
  /** 文档第一行在源文本里的下标，用于 issue 行号 */
  start: number;
}

/** 按顶格的 `---` 切文档；没有分隔符时整段当成一个文档 */
function splitDocuments(lines: string[]): MIRDocument[] {
  const documents: MIRDocument[] = [];
  let start = 0;
  let separated = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (indentOf(lines[index] ?? '') !== 0 || !DOC_SEPARATOR.test(lines[index] ?? '')) continue;
    if (separated) documents.push({ lines: lines.slice(start, index), start });
    start = index;
    separated = true;
  }

  if (separated) documents.push({ lines: lines.slice(start), start });
  else documents.push({ lines, start: 0 });

  return documents.filter((document) => document.lines.some((line) => line.trim() !== ''));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

interface BlockBody {
  blocks: IRBlock[];
  /** successors: 行是权威的后继列表，优先于从跳转指令推导 */
  successors: Map<string, string[]>;
}

function parseBody(
  entries: Array<{ text: string; line: number }>,
  locale: Locale,
  issues: IRParseIssue[],
  functionName: string,
): BlockBody {
  const blocks: IRBlock[] = [];
  const successors = new Map<string, string[]>();
  const seen = new Set<string>();
  let current: IRBlock | null = null;

  for (const entry of entries) {
    const text = stripComment(entry.text).trim();
    if (text === '') continue;

    const header = BLOCK_HEADER.exec(text);
    if (header) {
      const id = header[1] ?? '';
      const attributes = header[2];
      if (seen.has(id)) {
        issues.push({
          line: entry.line,
          message: t(locale, 'parse.mirDuplicateBlock', { label: id }),
        });
      }
      current = {
        id,
        label: attributes ? `${id} (${attributes})` : id,
        instructions: [],
        terminator: null,
      };
      blocks.push(current);
      seen.add(id);
      continue;
    }

    if (!current) continue;

    const successorLine = SUCCESSORS_KEY.exec(text);
    if (successorLine) {
      successors.set(current.id, mirBlockRefs(successorLine[1] ?? ''));
      continue;
    }

    // liveins / frameInfo 等是块的元数据，不是指令
    if (BLOCK_METADATA.test(text)) continue;

    const instruction = makeInstruction(text);
    current.instructions.push(instruction);
    if (instruction.terminator) current.terminator = instruction;
  }

  if (blocks.length === 0) {
    issues.push({
      line: entries[0]?.line ?? 1,
      message: t(locale, 'parse.mirEmptyFunction', { name: functionName }),
    });
  }

  return { blocks, successors };
}

function parseDocument(
  document: MIRDocument,
  documentIndex: number,
  locale: Locale,
  issues: IRParseIssue[],
): IRFunction | null {
  const { lines, start } = document;
  let name = `mir_${documentIndex}`;
  let bodyIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    if (indentOf(raw) !== 0) continue;
    const text = raw.trim();

    if (text === '...') break;

    const nameMatch = NAME_KEY.exec(text);
    if (nameMatch) {
      name = normaliseName(nameMatch[1] ?? '') || name;
      continue;
    }

    if (BODY_KEY.test(text)) {
      bodyIndex = index;
      break;
    }
  }

  if (bodyIndex < 0) {
    issues.push({
      line: start + 1,
      message: t(locale, 'parse.mirNoBody', { name }),
    });
    return null;
  }

  // body: | 之后、顶格键之前的内容；按最小缩进统一去掉一层
  const body: Array<{ text: string; line: number }> = [];
  for (let index = bodyIndex + 1; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    if (raw.trim() !== '' && indentOf(raw) <= indentOf(lines[bodyIndex] ?? '')) break;
    body.push({ text: raw, line: start + index + 1 });
  }

  const indents = body
    .filter((entry) => entry.text.trim() !== '')
    .map((entry) => indentOf(entry.text));
  const baseIndent = indents.length > 0 ? Math.min(...indents) : 0;
  const entries = body.map((entry) => ({
    text: entry.text.slice(baseIndent).replace(/[ \t]+$/, ''),
    line: entry.line,
  }));

  const { blocks, successors } = parseBody(entries, locale, issues, name);

  if (blocks.length === 0) {
    return {
      name,
      header: lines[0]?.trim() ?? '---',
      source: lines.join('\n'),
      blocks,
      edges: [],
    };
  }

  const byId = new Map(blocks.map((block) => [block.id, block]));
  const edges: IREdge[] = [];

  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    const branchInstructions = block.instructions.filter(
      (instruction) => instruction.terminator && mirBlockRefs(instruction.text).length > 0,
    );
    const conditionalTargets = new Set<string>();
    for (const instruction of branchInstructions) {
      if (!isMIRConditionalBranch(instruction.opcode)) continue;
      for (const target of mirBlockRefs(instruction.text)) conditionalTargets.add(target);
    }

    const lastBranch = branchInstructions[branchInstructions.length - 1];
    const fallsThrough = lastBranch
      ? isMIRConditionalBranch(lastBranch.opcode)
      : false;

    const explicit = successors.get(block.id) ?? [];
    const targets =
      explicit.length > 0
        ? explicit
        : unique(branchInstructions.flatMap((instruction) => mirBlockRefs(instruction.text)));

    const emitted = new Set<string>();
    const push = (to: string, kind: IREdge['kind'], label?: string) => {
      if (emitted.has(to)) return;
      if (!byId.has(to)) {
        issues.push({
          line: start + 1,
          message: t(locale, 'parse.mirUnknownTarget', {
            label: block.label,
            to: `%${to}`,
          }),
        });
        return;
      }
      emitted.add(to);
      edges.push({
        from: block.id,
        to,
        kind,
        ...(label ? { label } : {}),
      });
    };

    for (const target of targets) {
      if (conditionalTargets.has(target)) push(target, 'taken', 'taken');
      else if (fallsThrough && next && target === next.id) {
        push(target, 'fallthrough', 'fallthrough');
      } else push(target, 'branch');
    }

    // successors 行省略了顺序落下的块、或压根没有 successors 时，补一条落边
    if (fallsThrough && next && !emitted.has(next.id)) {
      push(next.id, 'fallthrough', 'fallthrough');
    }
  });

  return {
    name,
    header: lines[0]?.trim() ?? '---',
    source: lines.join('\n'),
    blocks,
    edges,
  };
}

export function parseMIR(source: string, locale: Locale = defaultLocale): IRParseResult {
  const issues: IRParseIssue[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const documents = splitDocuments(lines);
  const functions: IRFunction[] = [];

  documents.forEach((document, index) => {
    const fn = parseDocument(document, index, locale, issues);
    if (fn) functions.push(fn);
  });

  if (functions.length === 0 && source.trim() !== '') {
    issues.push({ line: 1, message: t(locale, 'parse.mirNoFunctions') });
  }

  return { functions, issues };
}
