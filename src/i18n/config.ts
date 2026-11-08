/**
 * 全站 i18n 的唯一配置源。
 *
 * 默认语言（中文）没有 URL 前缀，其它语言使用 /<locale>/ 前缀：
 *   /passes/mem2reg/      中文
 *   /en/passes/mem2reg/   英文
 *
 * 新增语言时：在 locales 里加一项、在 localeMeta 里补元数据、
 * 在 messages 里补一份文案，再在 content/passes/<locale>/ 下补内容。
 * 路由、语言切换器和 hreflang 都由这里推导，不需要改页面文件。
 */
export const locales = ['zh', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh';

export interface LocaleMeta {
  /** 语言切换器里显示的名字，用该语言自身书写 */
  label: string;
  /** 空间紧张时显示的短标签 */
  short: string;
  /** <html lang> 与 hreflang 使用 */
  htmlLang: string;
  /** Open Graph 的 og:locale */
  ogLocale: string;
}

export const localeMeta: Record<Locale, LocaleMeta> = {
  zh: {
    label: '中文',
    short: '中',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
  },
  en: {
    label: 'English',
    short: 'EN',
    htmlLang: 'en',
    ogLocale: 'en_US',
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** 用于语言切换器：拿到「另一种语言」 */
export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}
