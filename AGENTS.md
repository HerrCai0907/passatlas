# AGENTS.md

Guidance for AI coding agents (and humans) working in **PassAtlas**, an interactive atlas of
LLVM passes: 「LLVM Pass 图鉴」.

## 1. What this project is

A **fully static** learning site. Every pass gets one page: the problem it solves, the algorithm,
a step-by-step IR animation, its cost, and a command the reader can run themselves.

Hard constraints — do not break these without an explicit decision from the maintainer:

1. **Static output only.** `output: 'static'`, no adapter, no SSR, no server endpoints at
   request time, no API routes that are not prerendered.
2. **No runtime data fetching.** No client-side calls to third-party APIs, no analytics, no
   tracking scripts, no remote fonts. Everything ships in the build.
3. **Base-path safe.** The site is served from `/<repo-name>/` on GitHub Pages. Every internal
   link must go through `url()` from `src/lib/url.ts`. Never hardcode `href="/..."`.
4. **Content is Chinese, identifiers are English.** UI copy, explanations and headings are
   Simplified Chinese; pass names, flags, code and type names stay in English.
5. **Accessibility is part of "done".** Keyboard operable, visible focus, `prefers-reduced-motion`
   respected, semantic headings, sufficient contrast.

## 2. Stack and commands

- Astro 7 (static), MDX content collections, React 19 islands, plain CSS with design tokens.
- Node `>= 22.23.4` (see `.nvmrc`, currently 24).
- Deployment: GitHub Actions → GitHub Pages, on every push to `main`.

```bash
npm install        # install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
npm run check      # astro check (TypeScript + templates)
npm run test:ir    # IR parser + CFG layout assertions (Node runs the .ts directly)
```

Always run `npm run build` before handing work back. Run `npm run check` when you touched
TypeScript, Astro components, or the content schema.

After the checks pass, start a local server and leave it running so the maintainer can review
the change in a browser. This is part of the acceptance criteria in §10, not an optional extra.

## 3. Repository map

```
src/
  pages/                路由
    index.astro         首页：hero + 分步演示 + 精选卡片
    passes/index.astro  图鉴目录（按 category 分组 + 路线图）
    passes/[...slug].astro  pass 详情（getStaticPaths）
    ir/index.astro      CFG 实验室（可编辑 IR + 实时图）
    about.astro / 404.astro / robots.txt.ts
  layouts/              BaseLayout（head/meta）· PassLayout（详情页骨架）
  components/           SiteHeader · SiteFooter · PassCard · PassRow · PipelineStrip
    StepPlayer.tsx      分步 IR 播放器（唯一的播放器）
    CFGViewer.tsx       IR → 基本块有向图（含 CFG / IR 模式切换）
    CFGCanvas.tsx       纯渲染层：节点 + SVG 连边，被 viewer 与播放器复用
    CFGLab.tsx          实验室：textarea + CFGViewer，实时解析
    ViewModeSwitch.tsx  「CFG | IR」切换控件
  content/passes/       每篇一个 .mdx（frontmatter 由 content.config.ts 校验）
  demos/                分步演示数据：types.ts + 每个 pass 一个文件 + registry.ts
  lib/                  url() / categories / 站点常量
    ir/parse.ts         IR → 函数 / 基本块 / 边（纯函数，无依赖）
    ir/layout.ts        分层布局 + 回边识别（纯函数，输出坐标）
  data/roadmap.ts       尚未上线的 pass（不生成页面）
  styles/               tokens.css（设计令牌）· global.css（基础与 prose）
```

## 4. Adding a pass page (the main workflow)

Two files and one registry entry. Copy an existing pass instead of starting from scratch.

### 4.1 Write the animation data — `src/demos/<id>.ts`

```ts
import { makeDemo } from './types';

export const exampleDemo = makeDemo('example', 'example', [
  {
    title: '第 1 步 · …',
    note: '一句话解释这一步在做什么。',
    before: `
define i32 @f(i32 %x) {
  ret i32 %x
}
`,
    after: `
define i32 @f(i32 %x) {
  %v = add i32 %x, 0
  ret i32 %v
}
`,
    // 可选：这一步只观察、不改写时，高亮同一行
    focus: ['ret i32 %x'],
  },
]);
```

- `before` / `after` are **raw IR strings**; indentation is dedented automatically.
- Do **not** hand-write diff marks. `makeStep()` computes an LCS line diff at build time and
  marks added / removed lines.
- Keep each step focused on one change. 2–4 steps per pass, 5–16 lines per side.
- The `after` of step *n* should be the `before` of step *n + 1* — the reader may replay it.
- Register it in `src/demos/registry.ts` under the same id.

### 4.2 Write the page — `src/content/passes/<id>.mdx`

```mdx
---
title: example
zh: 一句话中文名
summary: 一到两句，会出现在卡片和 meta description 里。
category: scalar          # dataflow | scalar | loop | interproc | vectorize | codegen
difficulty: 2             # 1–3
status: ready             # draft 不会生成页面
order: 10                 # 目录排序
stage: ['-O1', '-O2']
tags: ['Worklist', 'SSA']
demo: example             # 对应 demos/registry.ts 的 key
cfg: diamond              # 可选，对应 data/cfg-samples.ts 的 id
source: llvm/lib/Transforms/.../X.cpp
updated: 2026-11-01
---

## 它解决什么问题
## 算法
## 代价与坑
## 在管线里的位置
## 自己跑一遍
```

- `##` headings are auto-numbered by CSS (01, 02, …). Do not type numbers into headings.
- Keep the five sections, in that order. A missing section is a content bug, not a style choice.
- Code fences: use ```llvm for IR, ```bash for commands, ```text for pseudo-code.
- Every page ends with a runnable `opt` command. If you cannot verify it, say so in the text
  rather than inventing flags.
- Add the pass to `src/data/roadmap.ts`'s removal list: when it ships, delete its roadmap entry
  and add it to the collection.

### 4.3 Definition of done

- [ ] `npm run build` passes, page appears under `/passes/<id>/`
- [ ] local review server is running and the URL is reported (see §10)
- [ ] animation has ≥ 2 steps, each step's IR is valid-looking LLVM (opaque `ptr`, `phi`, …)
- [ ] frontmatter `demo` matches a registry key
- [ ] prev/next navigation works (automatic via `order`)
- [ ] page renders at 390px, 768px and 1440px without horizontal scroll
- [ ] keyboard: `←` `→` step, `Space` play/pause, focus ring visible
- [ ] if `cfg` is set: no node overlap, no edge crossing a node, 4+ blocks still readable

## 5. CFG viewer & IR parser

`CFGViewer` turns IR text into a layered directed graph. The pipeline is
**parse → layout → render**, and the first two stages are pure and run at build time too.

**Every IR display defaults to CFG mode and offers an IR text toggle.** This is a product rule,
not a per-page choice: `StepPlayer` and `CFGViewer` both use `ViewModeSwitch` and pass
`defaultMode="cfg"`. If you add a new IR surface, wire the same switch and keep CFG as default.

- `src/lib/ir/parse.ts`: functions → blocks → instructions → edges (`br`, `br i1`, `switch`,
  `invoke`, `callbr`, `indirectbr`, `catchswitch`). Never throw: report problems via `issues`.
- `src/lib/ir/layout.ts`: DFS back-edge detection, longest-path ranks, barycentre ordering,
  content-based node widths. Returns plain coordinates; no DOM.
- Multi-line instructions (e.g. `switch` label arrays) are joined with a literal newline and rendered with `white-space: pre-wrap`; height estimation must use the same per-line counting.
- Geometry constants (`NODE_LINE`, `NODE_CHAR`, paddings) must stay in sync with
  `CFGCanvas.css`, otherwise text gets clipped. If you change one, change both.
- Edges: solid = forward, dashed accent = back edge, teal/red labels = true/false branch.
- Interactive requirements: nodes are keyboard focusable (`role="button"`, Enter/Space),
  fit-to-width on first render, zoom range 0.25–1.5.
- `npm run test:ir` must pass. Add a case when you teach the parser new syntax.

When embedding a graph in a pass page, prefer the frontmatter field (`cfg: <sample-id>`) over
importing the component into MDX: it keeps full-width layout and one implementation. The section
is only rendered when the page has no step demo (`demo`), because the player already shows a CFG.

## 6. Animation rules

`StepPlayer` (`src/components/StepPlayer.tsx`) plays the before/after states. Its contract:

| prop | meaning |
| --- | --- |
| `demo` | `Demo` object from `makeDemo()` |
| `compact` | smaller type for the home hero |
| `autoplay` / `loop` | hero only; never autoplay on a content page |
| `caption` | small label next to the demo id (e.g. 自动播放) |
| `defaultMode` | `cfg` (default) or `ir`; CFG must stay the default in production |

Rules:

- One player per page. It is a teaching device, not decoration.
- IR mode keeps the diff colours: green = added line, red = removed, amber = "look at this"
  (`focus`). CFG mode shows the same steps as before/after graphs; do not drop either mode.
- CFG mode reuses `CFGCanvas` (non-interactive) so node geometry stays identical to `CFGViewer`.
- Do not add new semantic colours without changing `tokens.css` and this file.
- No layout shift between steps: panes have a `min-height`; keep IR snippets within it.
- Respect `prefers-reduced-motion`: autoplay must stop, and line-in animations are disabled in CSS.
- Never require a mouse: every control has a keyboard path and an `aria-label`.

## 7. Styling rules

- Use tokens from `src/styles/tokens.css` (`--ink`, `--paper`, `--accent`, `--cat-*`).
  Hardcoded hex values in components are a review error, except inside the `tokens.css` file.
- Category colours are applied via the `cat-<id>` class, which sets `--cat`. A component that
  needs a category tint must be wrapped in or carry that class.
- Astro scoped styles are preferred; global CSS is for resets, prose, buttons, chips and layout
  primitives only.
- Typography: `--font-display` (serif) for headings, `--font-sans` for body, `--font-mono` for
  pass names, IR and metadata labels.
- Cards are for the home page; the atlas index uses rows (`PassRow`). Keep that distinction.

## 8. Deployment

- `.github/workflows/deploy.yml` builds on push to `main` and publishes `dist/` with
  `actions/deploy-pages`.
- `BASE_PATH` and `SITE_URL` are computed in the workflow from the repository name, so any repo
  name works without editing config. `PUBLIC_REPO_URL` is injected for the GitHub links.
- Repository setting required once: **Settings → Pages → Build and deployment → Source:
  GitHub Actions**. Without it the deploy job fails by design.
- Do not add `astro.config` values that hardcode one owner or one repo name.

## 9. Git

- Conventional commits: `feat: add licm page`, `fix: correct phi incoming edge`, `docs: …`.
- One pass page per commit. Do not reformat unrelated files in the same commit.
- Never commit `dist/`, `.astro/`, `node_modules/`, or editor state.

## 10. Code-change acceptance（代码修改验收）

Every change that affects the built site must pass this checklist before it is handed back.
“It builds” is not acceptance; the maintainer must be able to open the result.

- [ ] `npm run build` passes.
      Run `npm run check` as well when TypeScript, Astro components or the content schema
      changed, and `npm run test:ir` when the IR parser, layout or demo diff changed.
- [ ] **A local server is running and left running for human review.**
      Start `npm run dev` (default <http://localhost:4321>) or `npm run preview` (serves the
      built `dist/`). If the default port is occupied, use another port rather than skipping
      this step.
- [ ] The hand-off names the exact URL and the page / step / control the reviewer should look
      at. A statement like “it works locally” without a reachable URL does not count.
- [ ] Visual or interactive changes list what was checked manually: the 390 / 768 / 1440 px
      breakpoints, keyboard navigation (`←` `→` `Space`), the CFG / IR switch, and
      `prefers-reduced-motion` where relevant.
- [ ] Commit the change before handing it over, and keep the review server pointed at that
      commit. If the reviewer requests revisions, update the same server and re-report the URL.

## 11. Things this project deliberately does not do

- No dark mode yet (the paper/ink identity is the brand). If added, do it via tokens, not
  per-component overrides.
- No backend: no accounts, no progress sync, no comments. Collaboration happens on GitHub.
- No live LLVM execution in the browser. The animations are authored data, not a compiled
  playground. Revisit only with a concrete design for sandboxing and bundle size.
