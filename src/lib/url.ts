import { defaultLocale, type Locale } from '../i18n/config';
import {
  localeFromRelativePath,
  localizedPath,
  pathWithoutLocale,
} from '../i18n/paths';

/**
 * 站点可能部署在 GitHub Pages 的子路径下（如 /passatlas/），
 * 因此所有站内链接必须经过 url()，永远不要写死以 / 开头的绝对路径。
 *
 * 语言前缀也由 url() 负责：默认语言（中文）没有前缀，英文是 /en/。
 * 例：url('/passes/', 'en') → /passatlas/en/passes/
 */
const base = import.meta.env.BASE_URL;

/** 去掉部署 base，得到以 / 开头（或空串）的路径 */
function stripBase(pathname: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  let relative = pathname;
  if (cleanBase && (relative === cleanBase || relative.startsWith(`${cleanBase}/`))) {
    relative = relative.slice(cleanBase.length);
  }
  return relative.replace(/^\/+/, '');
}

export function url(path = '/', locale: Locale = defaultLocale): string {
  const localised = localizedPath(path, locale);
  return `${base}${localised.replace(/^\//, '')}`;
}

/** 从当前 URL 判断语言。传入 Astro.url.pathname 即可。 */
export function getLocaleFromPath(pathname: string): Locale {
  return localeFromRelativePath(stripBase(pathname));
}

/** 当前路径去掉语言前缀后的版本（不含 base），用于生成另一种语言的链接 */
export function pathWithoutLocaleUrl(pathname: string): string {
  const relative = stripBase(pathname);
  return pathWithoutLocale(relative, localeFromRelativePath(relative));
}

/** 语言切换器：保持当前页面不变，只替换语言前缀 */
export function switchLocaleUrl(pathname: string, locale: Locale): string {
  return url(pathWithoutLocaleUrl(pathname), locale);
}

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

export function isActive(
  currentPath: string,
  href: string,
  locale: Locale = defaultLocale,
): boolean {
  const target = url(href, locale);
  // 首页要精确匹配，否则 /passes/ 也会被当成「在首页」
  if (href === '/' || href === '') {
    return withTrailingSlash(currentPath) === withTrailingSlash(target);
  }
  const current = withTrailingSlash(currentPath);
  const normalisedTarget = withTrailingSlash(target);
  return current === normalisedTarget || current.startsWith(normalisedTarget);
}
