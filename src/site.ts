/**
 * 全站唯一的事实来源：站点信息、仓库地址、外部链接。
 * 新增外部链接时先加到这里，不要在组件里硬编码 URL。
 */
const repoFromEnv = import.meta.env.PUBLIC_REPO_URL as string | undefined;

export const site = {
  name: 'PassAtlas',
  nameZh: 'LLVM Pass 图鉴',
  tagline: '每一个 pass，都是一次变形。',
  description:
    '用可单步、可回退的动画拆解 LLVM 优化管线中的各个 pass：输入 IR、判定逻辑、输出 IR，以及它在 -O2 里的位置。全站静态，无需登录。',
  locale: 'zh-CN',
  llvmVersion: 'LLVM 21',
  github: repoFromEnv || 'https://github.com/passatlas/passatlas',
  llvmDocs: 'https://llvm.org/docs/Passes.html',
  llvmSource: 'https://github.com/llvm/llvm-project',
  license: 'MIT',
} as const;

export const nav = [
  { href: '/passes/', label: '图鉴' },
  { href: '/ir/', label: '实验室' },
  { href: '/about/', label: '关于' },
] as const;
