import type { CollectionEntry } from 'astro:content';
import { defaultLocale, isLocale, type Locale } from '../i18n/config.ts';

export type PgoEntry = CollectionEntry<'pgo'>;

/** 内容集合的 id 形如 `zh/function-entry`；URL 和文件名只取最后一段。 */
export function pgoSlug(entry: { id: string }): string {
  const parts = entry.id.split('/');
  return parts[parts.length - 1] ?? entry.id;
}

/** 从内容 id 推断语言；文件放错目录时页面会报错。 */
export function pgoLocale(entry: { id: string }): Locale {
  const [first] = entry.id.split('/');
  return isLocale(first) ? first : defaultLocale;
}

export function sortPgo(entries: PgoEntry[]): PgoEntry[] {
  return [...entries].sort((a, b) => a.data.order - b.data.order);
}

export function pgoForLocale(entries: PgoEntry[], locale: Locale): PgoEntry[] {
  return sortPgo(entries.filter((entry) => pgoLocale(entry) === locale));
}
