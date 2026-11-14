/**
 * 两种 IR 的语法高亮器。
 *
 * - LLVM IR：`%value` / `@global`、类型、标签、终结指令各有一套颜色；
 * - Machine IR：虚拟寄存器、物理寄存器、寄存器类、机器基本块和 target opcode
 *   分别着色，YAML 头部则退到元数据色。
 *
 * token 类名是共享的，format 作用域类（is-llvm / is-mir）在 `styles/ir.css`
 * 里换掉调色板，所以同一套 class 能呈现两种不同的高亮方案。
 */
import type { IRFormat } from './format.ts';
import { isLLVMTerminator } from './parse.ts';
import { isMIRTerminator } from '../mir/opcodes.ts';

export type IRTokenKind =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'type'
  | 'value'
  | 'label'
  | 'number'
  | 'opcode'
  | 'control'
  | 'meta'
  | 'string'
  | 'punct'
  | 'register'
  | 'class';

export interface IRToken {
  text: string;
  kind: IRTokenKind;
}

const LLVM_TYPES =
  /^(i\d+|void|ptr|float|double|half|bfloat|fp128|x86_fp80|ppc_fp128|label|token|metadata|opaque|type|x86_mmx|x86_amx|vscale)$/;

const LLVM_KEYWORDS = new Set([
  'define',
  'declare',
  'global',
  'constant',
  'private',
  'internal',
  'external',
  'available_externally',
  'linkonce',
  'weak',
  'common',
  'appending',
  'extern_weak',
  'linkonce_odr',
  'weak_odr',
  'dllimport',
  'dllexport',
  'unnamed_addr',
  'local_unnamed_addr',
  'thread_local',
  'zeroext',
  'signext',
  'inreg',
  'byval',
  'byref',
  'noalias',
  'nocapture',
  'noundef',
  'nonnull',
  'dereferenceable',
  'dereferenceable_or_null',
  'readonly',
  'readnone',
  'writeonly',
  'argmemonly',
  'inaccessiblememonly',
  'inaccessiblemem_or_argmemonly',
  'nounwind',
  'willreturn',
  'mustprogress',
  'alwaysinline',
  'noinline',
  'cold',
  'hot',
  'optnone',
  'optsize',
  'minsize',
  'ssp',
  'sspstrong',
  'sspreq',
  'naked',
  'returns_twice',
  'noreturn',
  'convergent',
  'speculatable',
  'strictfp',
  'immarg',
  'align',
  'nsw',
  'nuw',
  'exact',
  'inbounds',
  'volatile',
  'atomic',
  'unordered',
  'monotonic',
  'acquire',
  'release',
  'acq_rel',
  'seq_cst',
  'syncscope',
  'fast',
  'ninf',
  'nnan',
  'nsz',
  'arcp',
  'contract',
  'afn',
  'reassoc',
  'nofree',
  'nosync',
  'noduplicate',
  'noimplicitfloat',
  'norecurse',
  'noredzone',
  'noprofile',
  'skipprofile',
  'sanitize_address',
  'sanitize_memory',
  'sanitize_thread',
  'sanitize_hwaddress',
  'sanitize_memtag',
  'shadowcallstack',
  'speculative_load_hardening',
  'null_pointer_is_valid',
  'poison',
  'undef',
  'zeroinitializer',
  'catch',
  'filter',
  'cleanup',
  'none',
]);

const LLVM_TAIL = new Set(['tail', 'musttail', 'notail']);

const MIR_KEYWORDS = new Set([
  'liveins',
  'successors',
  'predecessors',
  'implicit',
  'implicit-def',
  'implicit-use',
  'dead',
  'killed',
  'undef',
  'renamable',
  'early-clobber',
  'internal',
  'virtual',
  'bbsections',
  'Cold',
  'Hot',
]);

const MIR_CLASSES = new Set([
  'gr8',
  'gr16',
  'gr32',
  'gr64',
  'gpr8',
  'gpr16',
  'gpr32',
  'gpr64',
  'fpr8',
  'fpr16',
  'fpr32',
  'fpr64',
  'fpr128',
  'ccr',
  'ccr32',
  'ccr64',
  'ptr32',
  'ptr64',
]);

function pushToken(tokens: IRToken[], text: string, kind: IRTokenKind): void {
  if (text === '') return;
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) {
    last.text += text;
    return;
  }
  tokens.push({ text, kind });
}

/** 取从末尾数第 n 个非空白 token（1 = 最近一个） */
function previousToken(tokens: IRToken[], offset: number): IRToken | undefined {
  let remaining = offset;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]!;
    if (token.kind === 'plain') continue;
    remaining -= 1;
    if (remaining === 0) return token;
  }
  return undefined;
}

/**
 * `%0:gr32` 的寄存器类只出现在寄存器后面的冒号之后；YAML 的 `name: lea`
 * 也在冒号后面，所以要同时看冒号前一 token 的种类。
 */
function isMIRClassPosition(tokens: IRToken[]): boolean {
  if (previousToken(tokens, 1)?.text !== ':') return false;
  const before = previousToken(tokens, 2);
  return before?.kind === 'value' || (before?.kind === 'meta' && before.text === 'class');
}

function tokenizeLLVMIR(line: string): IRToken[] {
  const tokens: IRToken[] = [];
  let index = 0;
  let expectOpcode = true;

  while (index < line.length) {
    const rest = line.slice(index);
    const ch = line[index]!;

    if (ch === ' ' || ch === '\t') {
      const match = /^[ \t]+/.exec(rest);
      pushToken(tokens, match![0], 'plain');
      index += match![0].length;
      continue;
    }

    if (ch === ';') {
      pushToken(tokens, rest, 'comment');
      break;
    }

    if (ch === '"') {
      const match = /^"(?:\\.|[^"\\])*"/.exec(rest);
      pushToken(tokens, match?.[0] ?? ch, match ? 'string' : 'punct');
      index += match?.[0].length ?? 1;
      continue;
    }

    if (ch === '%' || ch === '@') {
      const match = /^[%@][-\w.$]+/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'value');
        index += match[0].length;
        continue;
      }
    }

    if (ch === '!') {
      const match = /^![-$\w.]+/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'meta');
        index += match[0].length;
        continue;
      }
    }

    if (ch === '#') {
      const match = /^#[-\w.]+/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'meta');
        index += match[0].length;
        continue;
      }
    }

    if (/[-\d]/.test(ch) && /^-?\d/.test(rest)) {
      const match = /^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'number');
        index += match[0].length;
        continue;
      }
    }

    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][\w.]*/.exec(rest);
      const word = match?.[0] ?? ch;
      const next = line[index + word.length];

      if (LLVM_TAIL.has(word)) {
        pushToken(tokens, word, 'keyword');
      } else if (next === ':') {
        pushToken(tokens, word, 'label');
      } else if (LLVM_TYPES.test(word)) {
        pushToken(tokens, word, 'type');
      } else if (LLVM_KEYWORDS.has(word)) {
        pushToken(tokens, word, 'keyword');
      } else if (expectOpcode) {
        pushToken(tokens, word, isLLVMTerminator(word) ? 'control' : 'opcode');
        expectOpcode = false;
      } else {
        pushToken(tokens, word, 'plain');
      }

      index += word.length;
      continue;
    }

    if (ch === '=') {
      pushToken(tokens, ch, 'punct');
      expectOpcode = true;
      index += 1;
      continue;
    }

    pushToken(tokens, ch, 'punct');
    index += 1;
  }

  return tokens;
}

function tokenizeMIR(line: string): IRToken[] {
  const tokens: IRToken[] = [];
  let index = 0;
  let expectOpcode = true;

  while (index < line.length) {
    const rest = line.slice(index);
    const ch = line[index]!;

    if (ch === ' ' || ch === '\t') {
      const match = /^[ \t]+/.exec(rest);
      pushToken(tokens, match![0], 'plain');
      index += match![0].length;
      continue;
    }

    if (ch === '#' || ch === ';') {
      pushToken(tokens, rest, 'comment');
      break;
    }

    if (rest.startsWith('---')) {
      pushToken(tokens, '---', 'punct');
      index += 3;
      continue;
    }

    if (ch === '"') {
      const match = /^"(?:\\.|[^"\\])*"/.exec(rest);
      pushToken(tokens, match?.[0] ?? ch, match ? 'string' : 'punct');
      index += match?.[0].length ?? 1;
      continue;
    }

    if (ch === '%') {
      const match = /^%(?:bb\.[\w.]+|[-\w.$]+)/.exec(rest);
      if (match) {
        const isBlock = match[0].startsWith('%bb.');
        pushToken(tokens, match[0], isBlock ? 'label' : 'value');
        index += match[0].length;
        continue;
      }
    }

    if (ch === '$') {
      const match = /^\$[-\w.$]+/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'register');
        index += match[0].length;
        continue;
      }
    }

    if (rest.startsWith('bb.')) {
      const match = /^bb\.[\w.]+/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'label');
        index += match[0].length;
        continue;
      }
    }

    if (/[-\d]/.test(ch) && /^-?\d/.test(rest)) {
      const match = /^-?\d+(?:\.\d+)?/.exec(rest);
      if (match) {
        pushToken(tokens, match[0], 'number');
        index += match[0].length;
        continue;
      }
    }

    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][\w.]*/.exec(rest);
      const word = match?.[0] ?? ch;
      const next = line[index + word.length];

      if (MIR_KEYWORDS.has(word)) {
        pushToken(tokens, word, 'keyword');
        expectOpcode = false;
      } else if (next === ':') {
        pushToken(tokens, word, 'meta');
        expectOpcode = false;
      } else if (MIR_CLASSES.has(word) || isMIRClassPosition(tokens)) {
        pushToken(tokens, word, 'class');
      } else if (expectOpcode) {
        pushToken(tokens, word, isMIRTerminator(word) ? 'control' : 'opcode');
        expectOpcode = false;
      } else {
        pushToken(tokens, word, 'plain');
      }

      index += word.length;
      continue;
    }

    if (ch === '=') {
      pushToken(tokens, ch, 'punct');
      expectOpcode = true;
      index += 1;
      continue;
    }

    pushToken(tokens, ch, 'punct');
    index += 1;
  }

  return tokens;
}

export function tokenizeIR(line: string, format: IRFormat): IRToken[] {
  return format === 'mir' ? tokenizeMIR(line) : tokenizeLLVMIR(line);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 服务端（Astro / MachineTrack）用：把一段 IR 转成已转义的 token span。
 * 调用方负责把结果放进带 `ir-text is-llvm|is-mir` 类名的容器。
 */
export function highlightToHtml(source: string, format: IRFormat): string {
  return source
    .split('\n')
    .map((line) =>
      tokenizeIR(line, format)
        .map((token) =>
          token.kind === 'plain'
            ? escapeHtml(token.text)
            : `<span class="ir-tok ir-tok--${token.kind}">${escapeHtml(token.text)}</span>`,
        )
        .join(''),
    )
    .join('\n');
}
