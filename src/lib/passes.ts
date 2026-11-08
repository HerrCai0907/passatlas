import type { CollectionEntry } from 'astro:content';
import { defaultLocale, isLocale, type Locale } from '../i18n/config.ts';

export type PassEntry = CollectionEntry<'passes'>;

/** 内容集合的 id 形如 `zh/mem2reg`；URL 和文件名只取最后一段 */
export function passSlug(pass: { id: string }): string {
  const parts = pass.id.split('/');
  return parts[parts.length - 1] ?? pass.id;
}

/** 从内容 id 推断语言；不在语言子目录里的旧文件按默认语言处理 */
export function passLocale(pass: { id: string }): Locale {
  const [first] = pass.id.split('/');
  return isLocale(first) ? first : defaultLocale;
}

/** 一行的本地化短名。schema 同时接受 subtitle 与旧的 zh 字段。 */
export function passSubtitle(pass: { data: { subtitle?: string; zh?: string } }): string {
  return pass.data.subtitle ?? pass.data.zh ?? '';
}

export function sortPasses(passes: PassEntry[]): PassEntry[] {
  return [...passes].sort((a, b) => a.data.order - b.data.order);
}

export function passesForLocale(passes: PassEntry[], locale: Locale): PassEntry[] {
  return sortPasses(passes.filter((pass) => passLocale(pass) === locale));
}
