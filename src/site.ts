import type { Locale } from './i18n/config';

/**
 * 全站唯一的事实来源：站点信息、仓库地址、外部链接。
 * 新增外部链接时先加到这里，不要在组件里硬编码 URL。
 * 面向读者的文案按语言分开；标识符、版本号、仓库地址不翻译。
 */
const repoFromEnv = import.meta.env.PUBLIC_REPO_URL as string | undefined;

export const site = {
  name: 'PassAtlas',
  nameZh: 'LLVM Pass 图鉴',
  nameEn: 'LLVM Pass Atlas',
  tagline: {
    zh: '每一个 pass，都是一次变形。',
    en: 'Every pass is a transformation.',
  },
  description: {
    zh: '用可单步、可回退的动画拆解 LLVM 优化管线中的各个 pass：输入 IR、判定逻辑、输出 IR，以及它在 -O2 里的位置。全站静态，无需登录。',
    en: 'Step-by-step, reversible animations break down the passes in the LLVM optimisation pipeline: input IR, decision logic, output IR, and where the pass sits in -O2. Fully static, no sign-in.',
  },
  llvmVersion: 'LLVM 21',
  github: repoFromEnv || 'https://github.com/passatlas/passatlas',
  llvmDocs: 'https://llvm.org/docs/Passes.html',
  llvmSource: 'https://github.com/llvm/llvm-project',
  license: 'MIT',
} as const;

export function siteTitle(locale: Locale): string {
  return locale === 'zh' ? `${site.name} · ${site.nameZh}` : `${site.name} · ${site.nameEn}`;
}

export function siteDescription(locale: Locale): string {
  return site.description[locale];
}

/** 主导航。href 不带语言前缀，渲染时交给 url(href, locale)。 */
export const nav = [
  { href: '/passes/', label: { zh: '图鉴', en: 'Passes' } },
  { href: '/ir/', label: { zh: '实验室', en: 'Lab' } },
  { href: '/about/', label: { zh: '关于', en: 'About' } },
] as const;
