/**
 * 与框架无关的路径助手：不读取 BASE_URL，因此 Node 测试可以直接 import。
 * 带 base path 的版本在 src/lib/url.ts 里。
 */
import { defaultLocale, isLocale, type Locale } from './config.ts';

/** 把「语言无关的站内路径」加上语言前缀，始终返回以 / 开头的路径 */
export function localizedPath(path: string, locale: Locale): string {
  const clean = path.replace(/^\/+/, '');
  const prefix = locale === defaultLocale ? '' : `${locale}/`;
  return `/${prefix}${clean}`;
}

/**
 * 去掉语言前缀，得到语言无关的路径。
 * 只用于已经去掉 base path 的路径（src/lib/url.ts 会负责剥 base）。
 */
export function pathWithoutLocale(path: string, locale: Locale): string {
  const clean = path.replace(/^\/+/, '');
  if (locale === defaultLocale) return `/${clean}`;
  if (clean === locale) return '/';
  if (clean.startsWith(`${locale}/`)) return `/${clean.slice(locale.length + 1)}`;
  return `/${clean}`;
}

/** 从一段「已经去掉 base path」的路径里识别语言，识别不了就是默认语言 */
export function localeFromRelativePath(pathname: string): Locale {
  const first = pathname.replace(/^\/+/, '').split('/')[0];
  return isLocale(first) ? first : defaultLocale;
}
