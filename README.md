# PassAtlas · LLVM Pass 图鉴

> 每一个 pass，都是一次变形。

一个用**可交互动画**讲清 LLVM 优化 pass 的静态学习站。每篇图鉴固定回答五件事：它解决什么问题、算法怎么走、IR 怎么被改写、代价在哪、以及一条你能自己跑的命令。

![首页预览](docs/preview-home.png)

## 特性

- **分步动画**：before / after 双栏对照，构建期自动做行级 diff；绿线是新增、红线是删除、琥珀色是「看这里」。支持 `←` `→` 单步、`空格` 播放、速度调节与跳步。
- **100% 静态**：构建产物是纯 HTML / CSS / JS，无后端、无数据库、无追踪脚本，扔进任何静态托管都能跑，也可以完全离线阅读。
- **内容即代码**：每篇 pass 是一个 MDX 文件，frontmatter 由 Zod 校验；写错字段、写错分类，构建直接失败。
- **零配置部署**：push 到 `main` 自动构建并发布到 GitHub Pages，项目站点子路径（`/repo-name/`）自动处理。
- **可访问**：键盘全可操作、focus 可见、`prefers-reduced-motion` 下自动停播并关闭动画。

## 快速开始

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # 静态产物输出到 dist/
npm run preview   # 本地预览 dist/
npm run check     # TypeScript / Astro 模板类型检查
```

要求 Node `>= 22.23.4`，版本见 `.nvmrc`。

## 目录结构

```text
src/
├── pages/                 路由
│   ├── index.astro        首页：hero 动画 + 精选图鉴
│   ├── passes/index.astro 图鉴目录（分类 + 路线图）
│   ├── passes/[...slug].astro  pass 详情（构建期生成）
│   ├── about.astro        方法论与贡献说明
│   └── 404.astro / robots.txt.ts
├── layouts/               BaseLayout（head / meta / 页头页脚）
│                          PassLayout（详情页骨架 + 上一篇/下一篇）
├── components/
│   ├── StepPlayer.tsx     唯一交互岛：分步 IR 播放器
│   ├── PassCard/PassRow   卡片（首页）与行（目录）
│   └── ...                页头、页脚、管线标记
├── content/passes/        每篇一个 .mdx
├── demos/                 演示数据：types.ts（diff 引擎）+ 每个 pass 一份
├── lib/                   url() 助手、分类定义
├── data/roadmap.ts        尚未上线的 pass 清单
└── styles/                tokens.css（设计令牌）· global.css（基础 + prose）
```

## 新增一篇 pass

完整规范见 [`AGENTS.md`](AGENTS.md)，核心只有三步：

1. **写演示数据** `src/demos/<id>.ts`：只提供 `before` / `after` 两段 IR，行级 diff 由 `makeStep()` 在构建期计算。

   ```ts
   import { makeDemo } from './types';

   export const exampleDemo = makeDemo('example', 'example', [
     {
       title: '第 1 步 · 消掉恒等运算',
       note: 'add x, 0 不改变值，直接用操作数替换使用者。',
       before: `
   %a = add i32 %x, 0
   ret i32 %a
   `,
       after: `
   ret i32 %x
   `,
     },
   ]);
   ```

2. **注册** `src/demos/registry.ts`：`example: exampleDemo`。
3. **写页面** `src/content/passes/<id>.mdx`，frontmatter 里 `demo: example`。

```yaml
---
title: example
zh: 一句话中文名
summary: 会显示在卡片与 meta description 里
category: scalar        # dataflow | scalar | loop | interproc | vectorize | codegen
difficulty: 2           # 1–3
status: ready           # draft 不会生成页面
order: 10
stage: ['-O1', '-O2']
tags: ['Worklist']
demo: example
source: llvm/lib/Transforms/.../X.cpp
---
```

正文固定五个 `##` 小节（编号由 CSS 自动生成）：它解决什么问题 / 算法 / 代价与坑 / 在管线里的位置 / 自己跑一遍。

## 部署到 GitHub Pages

工作流在 `.github/workflows/deploy.yml`：**push 到 `main` 即自动构建并发布**。

1. 把仓库推到 GitHub（建议仓库名就叫 `passatlas`，站点 URL 更干净）。
2. 打开 **Settings → Pages → Build and deployment**，把 **Source** 设为 **GitHub Actions**。只需设置一次。
3. push 到 `main`，在 **Actions** 里看 `Deploy to GitHub Pages` 跑完。
4. 站点地址：`https://<username>.github.io/<repo>/`。

细节：

- `BASE_PATH` 与 `SITE_URL` 由工作流根据 `github.repository` 自动推导，所以**换仓库名不用改配置**。仓库名为 `<user>.github.io` 时自动使用根路径。
- 站点是静态目录格式（`/passes/mem2reg/index.html`），刷新子页面不会 404，无需 `404.html` 兜底路由。
- 首次部署若报 `Pages site not found`，就是第 2 步没做。
- 自定义域名：在 Pages 设置里填域名，再给仓库加一个变量 `SITE_URL`（Settings → Secrets and variables → Actions → Variables），值填 `https://your.domain`，工作流会自动优先使用它。

本地模拟一次「项目站点」构建，确认子路径资源没问题：

```bash
BASE_PATH=/passatlas/ SITE_URL=https://example.github.io npm run build
npx serve dist   # 或任意静态服务器，访问 /passatlas/
```

## 设计约定

- 纸色底 + 墨色字 + 衬线标题，IR 控制台用深色反白；分类色通过 `--cat` 注入。
- 颜色、字体、圆角、阴影全部走 `src/styles/tokens.css`，组件里不写死色值。
- 所有站内链接必须经过 `src/lib/url.ts` 的 `url()`，否则部署到子路径会 404。
- 交互只有一个岛（`StepPlayer`），其余页面是纯静态 HTML。

更完整的约束、动画规范与「完成定义」见 [`AGENTS.md`](AGENTS.md)。

## 路线图

已上线：`mem2reg`、`instcombine`、`dce`。

排期中的见 [`src/data/roadmap.ts`](src/data/roadmap.ts)：SROA、GVN、SCCP、LICM、loop-unroll、inline、SLPVectorizer、loop-vectorize、isel。想加速某一个，直接提 PR。

## 许可

代码与内容以 [MIT](LICENSE) 许可发布。LLVM 是 UIUC 的商标，本项目与 LLVM 项目无隶属关系；文中引用的源码片段遵循 LLVM 自身的 Apache-2.0 WITH LLVM-exception 许可。
