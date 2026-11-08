// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { paperTheme } from './src/lib/paper-theme.mjs';

/**
 * 站点是 100% 静态的：没有 adapter、没有 SSR、没有运行期数据请求。
 * 部署到 GitHub Pages 时由 workflow 注入 SITE_URL 与 BASE_PATH，
 * 本地开发默认使用根路径。
 */
const repoName = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? '';
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'passatlas';

/**
 * 保证 base 以 / 开头、以 / 结尾
 * @param {string} value
 * @returns {string}
 */
const normaliseBase = (value) => {
  let base = value.trim();
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
};

const isUserPage = repoName.endsWith('.github.io');
const base = normaliseBase(
  process.env.BASE_PATH ?? (repoName && !isUserPage ? repoName : '/'),
);
const site = process.env.SITE_URL ?? `https://${owner}.github.io`;

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
      // 同一页面的中英文版本在 sitemap 里互相声明 hreflang
      i18n: {
        defaultLocale: 'zh',
        locales: { zh: 'zh-CN', en: 'en' },
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: paperTheme,
      wrap: true,
    },
  },
});
