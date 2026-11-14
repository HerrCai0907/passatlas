/**
 * 按 IR 格式选择解析器。展示层只关心「这一段是 LLVM IR 还是 Machine IR」，
 * 不该自己判断语法，也不该把一种 IR 喂给另一种解析器。
 */
import { defaultLocale, type Locale } from '../../i18n/config.ts';
import { parseMIR } from '../mir/parse.ts';
import type { IRFormat } from './format.ts';
import { parseIR } from './parse.ts';
import type { IRParseResult } from './parse.ts';

export function parseSource(
  source: string,
  format: IRFormat,
  locale: Locale = defaultLocale,
): IRParseResult {
  return format === 'mir' ? parseMIR(source, locale) : parseIR(source, locale);
}
