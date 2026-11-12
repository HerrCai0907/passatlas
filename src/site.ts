import type { Locale } from './i18n/config';

/**
 * 全站唯一的事实来源：站点信息、仓库地址、外部链接。
 * 新增外部链接时先加到这里，不要在组件里硬编码 URL。
 * 面向读者的文案按语言分开；标识符、版本号、仓库地址不翻译。
 */
/**
 * 部署时由 GitHub Actions 注入 PUBLIC_REPO_URL（见 .github/workflows/deploy.yml）；
 * 本地 dev / preview 没有这个变量，回退到仓库本身，否则「在 GitHub 上编辑这一页」
 * 会指向一个不存在的仓库。
 */
const repoFromEnv = import.meta.env.PUBLIC_REPO_URL as string | undefined;
const repoUrl = repoFromEnv || 'https://github.com/HerrCai0907/passatlas';

/** LLVM 23.1.4 release commit (llvmorg-23.1.4^{}). Pin every source link to it. */
const llvmCommit = '7a941dfb2877a0b8cf30323fefa85ad019e0b0f5';

export const site = {
  name: 'PassAtlas',
  nameZh: 'LLVM Pass 图鉴',
  nameEn: 'LLVM Pass Atlas',
  description: {
    zh: '用可单步、可回退的动画拆解 LLVM 优化管线中的各个 pass：输入 IR、判定逻辑、输出 IR，以及它在 -O2 里的位置。',
    en: 'Step-by-step, reversible animations break down the passes in the LLVM optimisation pipeline: input IR, decision logic, output IR, and where the pass sits in -O2.',
  },
  llvmVersion: 'LLVM 23.1.4',
  llvmCommit,
  github: repoUrl,
  llvmDocs: 'https://llvm.org/docs/Passes.html',
  llvmSource: 'https://github.com/llvm/llvm-project',
  llvmTree: `https://github.com/llvm/llvm-project/tree/${llvmCommit}`,
  license: 'MIT',
} as const;

/** Permanent link to one LLVM source file: a commit hash, never a moving branch. */
export function llvmSourceUrl(path: string): string {
  return `${site.llvmSource}/blob/${site.llvmCommit}/${path}`;
}

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
