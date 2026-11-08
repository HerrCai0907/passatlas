/**
 * UI 文案字典。所有出现在界面上的短文本都放这里，组件里不要再写死中文或英文。
 *
 * - 键用「区域.用途」命名，方便按页面查找。
 * - 允许 {name} 形式的占位符，由 t() 替换。
 * - 新增键时必须在两种语言里同时补齐，TypeScript 会检查 en 是否覆盖 zh 的所有键。
 * - 少量带 <em> / <code> 的文案由调用方用 set:html 渲染；内容全部来自本文件，不存在注入风险。
 */
import { defaultLocale, type Locale } from './config.ts';

const zh = {
  skip: '跳到正文',
  'lang.select': '选择语言',
  'lang.current': '当前语言',
  'site.homeAria': '{name} 首页',
  'nav.main': '主导航',
  'nav.passes': '图鉴',
  'nav.lab': '实验室',
  'nav.about': '关于',
  'nav.github': 'GitHub',

  'footer.nav': '页脚导航',
  'footer.passes': '图鉴目录',
  'footer.lab': 'CFG 实验室',
  'footer.about': '关于本站',
  'footer.docs': 'LLVM Pass 官方文档',
  'footer.source': 'LLVM 源码',
  'footer.note': '100% 静态 · 无后端 · 无跟踪脚本',
  'footer.version': '目标版本',
  'footer.license': '内容许可',
  'footer.build': '构建',
  'footer.bottom': '写给想知道「IR 为什么变了」的人。',

  'home.eyebrow': 'PassAtlas · Vol. 1',
  'home.titleEn': 'LLVM',
  'home.title': 'Pass 图鉴',
  'home.lead':
    '每一个 pass 都是一次变形。这里把输入 IR、判定逻辑、输出 IR 拆成可以单步回放的帧，让你看清它<em>为什么</em>这么改。',
  'home.start': '从 mem2reg 开始',
  'home.browse': '浏览图鉴',
  'home.stats.passes': '已上线',
  'home.stats.categories': '分类',
  'home.stats.backend': '后端依赖',
  'home.hint': '这是真实的 mem2reg 改写过程，点按或用键盘 ← → 单步。',
  'home.caption': '自动播放',
  'home.how.eyebrow': 'How to read',
  'home.how.title': '一页图鉴，三步读完',
  'home.how.lead': '不做流水账式的 pass 列表，每页都按同一套骨架组织，方便横向对比。',
  'home.how.step1.title': '先读问题',
  'home.how.step1.body': '「它解决什么问题」永远排在最前。不知道优化目标，算法细节只会变成记忆负担。',
  'home.how.step2.title': '再单步走',
  'home.how.step2.body':
    '在分步动画里逐帧看 IR：新增的行是绿色，消失的行是红色，高亮的是这一步的关注点。',
  'home.how.step3.title': '最后自己跑',
  'home.how.step3.body': '每页都附了 <code>opt</code> 命令。复制下来换个输入，比读十遍伪代码更有用。',
  'home.atlas.eyebrow': 'Atlas',
  'home.atlas.title': '图鉴目录',
  'home.atlas.all': '全部 {count} 篇',
  'home.atlas.browse': '按分类浏览',
  'home.atlas.roadmap': '路线图上还有 {count} 个 pass 正在绘制，',
  'home.atlas.roadmapLink': '查看完整路线图',
  'home.atlas.cfg': '读图比读文本快：',
  'home.atlas.cfgLink': '把任意 IR 摊成 CFG',

  'passes.metaTitle': '图鉴',
  'passes.metaDescription': '按算法族分类的 LLVM pass 目录，每篇都配一个可单步回放的 IR 动画。',
  'passes.eyebrow': 'Atlas · 目录',
  'passes.heading': '全部 Pass',
  'passes.lead':
    '按算法族分组，从「值在哪里」到「指令怎么选」。每篇都有一张可交互的 IR 对照图，以及一条能自己跑的命令。',
  'passes.jump': '跳转到分类',
  'passes.roadmap.eyebrow': 'Roadmap',
  'passes.roadmap.title': '正在绘制',
  'passes.roadmap.body':
    '下面这些 pass 已在排期里。想加速某一个？欢迎直接提 PR —— 新增一篇只需要一个 MDX 和一个分步演示。',
  'passes.roadmap.status': '规划中',
  'passes.roadmap.cta': '怎么贡献一篇',

  'pass.crumbs': '面包屑',
  'pass.atlas': '图鉴',
  'pass.difficulty': '难度 {level}',
  'pass.demoHeading': '分步动画',
  'pass.demoHint': '点按「下一步」，或用键盘 <kbd>←</kbd> <kbd>→</kbd> 单步，<kbd>空格</kbd> 播放。',
  'pass.cfgHeading': '控制流图',
  'pass.cfgHint': '基本块、跳转与分支条件的一张地图。',
  'pass.sourcePrefix': '在 LLVM 源码中：',
  'pass.pager': '上一篇 / 下一篇',
  'pass.prev': '← 上一篇',
  'pass.next': '下一篇 →',
  'pass.edit': '发现错误？在 GitHub 上编辑这一页 ↗',
  'pass.cfgTitle': '{title} 的控制流图',

  'card.difficultyTitle': '难度：{level}',
  'card.read': '阅读 →',
  'row.difficultyTitle': '难度：{level}',

  'pipeline.label': '启用级别',

  'player.group': '{name} 分步演示',
  'player.mode': '分步演示的展示模式',
  'player.cfgBefore': '改写前的控制流图',
  'player.cfgAfter': '改写后的控制流图',
  'player.irBefore': '改写前的 IR',
  'player.irAfter': '改写后的 IR',
  'player.blocks': '{count} 块',
  'player.lines': '{count} 行',
  'player.deltaAddTitle': '本步新增 {count} 条指令',
  'player.deltaDelTitle': '本步删除 {count} 条指令',
  'player.emptyCfg': '无法解析为基本块',
  'player.emptyIr': '（无指令）',
  'player.diffTitle': '指令 diff',
  'player.diffAdd': '新增',
  'player.diffDel': '删除',
  'player.diffFocus': '关注',
  'player.first': '回到第一步',
  'player.prev': '上一步',
  'player.play': '自动播放',
  'player.pause': '暂停',
  'player.next': '下一步',
  'player.prevTitle': '上一步（←）',
  'player.nextTitle': '下一步（→）',
  'player.playTitle': '自动播放（空格）',
  'player.pauseTitle': '暂停（空格）',
  'player.steps': '跳到指定步骤',
  'player.step': '第 {n} 步：{title}',
  'player.speed': '播放速度',

  'viewMode.group': '展示模式',
  'viewMode.cfgTitle': '按基本块显示为有向图',
  'viewMode.irTitle': '显示原始 IR 文本',

  'cfg.group': '控制流图',
  'cfg.functions': '函数',
  'cfg.mode': 'CFG 图或 IR 文本',
  'cfg.showInst': '显示指令',
  'cfg.hideInst': '只看控制流',
  'cfg.zoom': '缩放',
  'cfg.zoomOut': '缩小',
  'cfg.zoomIn': '放大',
  'cfg.fit': '适应',
  'cfg.fitWidth': '适应宽度',
  'cfg.copy': '复制 IR',
  'cfg.copied': '已复制',
  'cfg.issueLine': '第 {line} 行：{message}',
  'cfg.empty': '没有可展示的函数。粘贴一个包含 define 的 LLVM IR 试试。',
  'cfg.metaBlocks': '{blocks} 个基本块 · {edges} 条控制流边',
  'cfg.selected': '已选中 {block}，再次点击取消',
  'cfg.selectHint': '点击基本块可高亮它相关的边',
  'cfg.irRegion': '@{name} 的 IR 文本',
  'cfg.metaLines': '{blocks} 个基本块 · {lines} 行 IR',
  'cfg.irHint': '切回 CFG 可以看这些指令之间的跳转关系',

  'canvas.block': '基本块 {label}，{count} 条指令',
  'diff.add': '新增',
  'diff.del': '删除',
  'diff.focus': '关注',

  'lab.samples': '示例',
  'lab.stats': '{functions} 函数 · {blocks} 块 · {edges} 边',
  'lab.editorTitle': 'IR 输入',
  'lab.lines': '{count} 行',
  'lab.irLabel': 'LLVM IR 源码',
  'lab.custom': '自定义 IR',
  'lab.local': '· 全程在浏览器本地解析，不会上传',
  'lab.viewerTitle': '输入 IR 的控制流图',

  'ir.metaTitle': 'CFG 实验室',
  'ir.metaDescription':
    '把任意 LLVM IR 粘贴进来，按基本块切成有向图，直接在浏览器里看清控制流。全静态、纯前端解析。',
  'ir.eyebrow': 'Lab · CFG',
  'ir.heading': '把 IR 摊开看',
  'ir.lead':
    '一段 IR 读起来是线性的，跑起来却是跳来跳去的。把函数切成基本块、连成有向图，分支、汇合、循环和不可达代码就一眼可辨了。改左边的 IR，右边的图会跟着变。',
  'ir.tip1': '实线是顺序跳转，虚线是回边（循环）',
  'ir.tip2': '绿色 true / 红色 false 是条件分支的两条出边',
  'ir.tip3': '点击基本块，可以高亮与它相关的边',
  'ir.noteTitle': '它不是编译器',
  'ir.noteBody':
    '这里只做语法层面的切分：找函数、找标签、读终结指令，然后把跳转关系画出来。它不会验证这段 IR 是否真的合法，也不会执行任何优化——真正的检查交给 opt -verify。',

  'about.metaTitle': '关于',
  'about.metaDescription':
    'PassAtlas 的做法：用可单步的 IR 动画讲清 LLVM pass 的算法，全站静态，可离线阅读。',
  'about.eyebrow': 'About',
  'about.heading': '为什么做图鉴',
  'about.lead':
    'LLVM 的 pass 文档能告诉你「有什么」，源码能告诉你「怎么写的」，但很少有一个地方能让你<strong>看见</strong>一条 IR 被改写的那一瞬间。',
  'about.ctaPasses': '去看图鉴',
  'about.ctaGithub': 'GitHub 仓库 ↗',

  'notFound.metaDescription': '这一页不在图鉴里。',
  'notFound.eyebrow': '404 · Not in the atlas',
  'notFound.lead': '这条路径没有被任何 pass 处理过，或者它指向的页面还没画完。',
  'notFound.back': '回到图鉴',
  'notFound.home': '首页',

  'parse.duplicateBlock': '基本块 {label} 重复定义',
  'parse.missingBrace': '函数 @{name} 缺少结尾的 }',
  'parse.emptyFunction': '函数 @{name} 里没有基本块',
  'parse.missingTerminator': '基本块 {label} 没有终结指令（br / ret / switch…）',
  'parse.unknownTarget': '基本块 {label} 跳转到了不存在的 {to}',
  'parse.noFunctions': '没有找到 define 定义的函数',
} as const;

type ZhMessages = typeof zh;
type Messages = { readonly [K in keyof ZhMessages]: string };

const en: Messages = {
  skip: 'Skip to content',
  'lang.select': 'Select language',
  'lang.current': 'Current language',
  'site.homeAria': '{name} home',
  'nav.main': 'Main navigation',
  'nav.passes': 'Passes',
  'nav.lab': 'Lab',
  'nav.about': 'About',
  'nav.github': 'GitHub',

  'footer.nav': 'Footer navigation',
  'footer.passes': 'Pass index',
  'footer.lab': 'CFG lab',
  'footer.about': 'About this site',
  'footer.docs': 'LLVM pass documentation',
  'footer.source': 'LLVM source',
  'footer.note': '100% static · no backend · no trackers',
  'footer.version': 'Target version',
  'footer.license': 'License',
  'footer.build': 'Built with',
  'footer.bottom': 'For everyone who wants to know why the IR changed.',

  'home.eyebrow': 'PassAtlas · Vol. 1',
  'home.titleEn': 'LLVM',
  'home.title': 'Pass Atlas',
  'home.lead':
    'Every pass is a transformation. Here the input IR, the decision logic and the output IR are split into frames you can replay one at a time, so you can see <em>why</em> the IR changes.',
  'home.start': 'Start with mem2reg',
  'home.browse': 'Browse the atlas',
  'home.stats.passes': 'Passes',
  'home.stats.categories': 'Categories',
  'home.stats.backend': 'Backend',
  'home.hint': 'A real mem2reg rewrite. Click, or use the ← → keys to step through it.',
  'home.caption': 'Autoplay',
  'home.how.eyebrow': 'How to read',
  'home.how.title': 'One page, three steps',
  'home.how.lead':
    'No endless list of pass names. Every page follows the same skeleton so you can compare passes side by side.',
  'home.how.step1.title': 'Start with the problem',
  'home.how.step1.body':
    '"What does it solve?" always comes first. Without the goal, algorithm details are just things to memorise.',
  'home.how.step2.title': 'Then step through it',
  'home.how.step2.body':
    'Watch the IR frame by frame: added lines are green, removed lines are red, and the highlighted line is what this step is about.',
  'home.how.step3.title': 'Finally, run it yourself',
  'home.how.step3.body':
    'Every page ends with an <code>opt</code> command. Copy it, change the input, and learn more than from ten readings of the pseudocode.',
  'home.atlas.eyebrow': 'Atlas',
  'home.atlas.title': 'The atlas',
  'home.atlas.all': 'All passes ({count})',
  'home.atlas.browse': 'Browse by category',
  'home.atlas.roadmap': '{count} more passes are on the roadmap.',
  'home.atlas.roadmapLink': 'See the full roadmap',
  'home.atlas.cfg': 'A graph beats prose:',
  'home.atlas.cfgLink': 'Turn any IR into a CFG',

  'passes.metaTitle': 'Passes',
  'passes.metaDescription':
    'An LLVM pass index grouped by algorithm family, each with a step-by-step IR animation.',
  'passes.eyebrow': 'Atlas · Index',
  'passes.heading': 'All passes',
  'passes.lead':
    'Grouped by algorithm family, from "where does the value live" to "which instruction do we pick". Each page has an interactive IR view and a command you can run yourself.',
  'passes.jump': 'Jump to a category',
  'passes.roadmap.eyebrow': 'Roadmap',
  'passes.roadmap.title': 'In progress',
  'passes.roadmap.body':
    'These passes are scheduled. Want to speed one up? Send a PR — a new page needs one MDX file and one step-by-step demo.',
  'passes.roadmap.status': 'Planned',
  'passes.roadmap.cta': 'How to contribute a page',

  'pass.crumbs': 'Breadcrumb',
  'pass.atlas': 'Passes',
  'pass.difficulty': 'Level {level}',
  'pass.demoHeading': 'Step-by-step animation',
  'pass.demoHint':
    'Press Next, or use <kbd>←</kbd> <kbd>→</kbd> to step and <kbd>Space</kbd> to play.',
  'pass.cfgHeading': 'Control-flow graph',
  'pass.cfgHint': 'A map of basic blocks, branches and conditions.',
  'pass.sourcePrefix': 'In the LLVM source:',
  'pass.pager': 'Previous / next pass',
  'pass.prev': '← Previous',
  'pass.next': 'Next →',
  'pass.edit': 'Found an error? Edit this page on GitHub ↗',
  'pass.cfgTitle': 'Control-flow graph of {title}',

  'card.difficultyTitle': 'Difficulty: {level}',
  'card.read': 'Read →',
  'row.difficultyTitle': 'Difficulty: {level}',

  'pipeline.label': 'Enabled at',

  'player.group': '{name} step-by-step demo',
  'player.mode': 'Step player display mode',
  'player.cfgBefore': 'Control-flow graph before the rewrite',
  'player.cfgAfter': 'Control-flow graph after the rewrite',
  'player.irBefore': 'IR before the rewrite',
  'player.irAfter': 'IR after the rewrite',
  'player.blocks': 'Blocks: {count}',
  'player.lines': 'Lines: {count}',
  'player.deltaAddTitle': 'Instructions added in this step: {count}',
  'player.deltaDelTitle': 'Instructions removed in this step: {count}',
  'player.emptyCfg': 'Cannot parse into basic blocks',
  'player.emptyIr': '(no instructions)',
  'player.diffTitle': 'Instruction diff',
  'player.diffAdd': 'Added',
  'player.diffDel': 'Removed',
  'player.diffFocus': 'Focus',
  'player.first': 'Back to the first step',
  'player.prev': 'Previous step',
  'player.play': 'Play',
  'player.pause': 'Pause',
  'player.next': 'Next step',
  'player.prevTitle': 'Previous step (←)',
  'player.nextTitle': 'Next step (→)',
  'player.playTitle': 'Play (Space)',
  'player.pauseTitle': 'Pause (Space)',
  'player.steps': 'Jump to a step',
  'player.step': 'Step {n}: {title}',
  'player.speed': 'Playback speed',

  'viewMode.group': 'Display mode',
  'viewMode.cfgTitle': 'Show basic blocks as a directed graph',
  'viewMode.irTitle': 'Show raw IR text',

  'cfg.group': 'Control-flow graph',
  'cfg.functions': 'Functions',
  'cfg.mode': 'CFG graph or IR text',
  'cfg.showInst': 'Show instructions',
  'cfg.hideInst': 'Control flow only',
  'cfg.zoom': 'Zoom',
  'cfg.zoomOut': 'Zoom out',
  'cfg.zoomIn': 'Zoom in',
  'cfg.fit': 'Fit',
  'cfg.fitWidth': 'Fit width',
  'cfg.copy': 'Copy IR',
  'cfg.copied': 'Copied',
  'cfg.issueLine': 'Line {line}: {message}',
  'cfg.empty': 'No function to show. Paste LLVM IR containing a define.',
  'cfg.metaBlocks': 'Basic blocks: {blocks} · control-flow edges: {edges}',
  'cfg.selected': 'Selected {block}; click again to clear',
  'cfg.selectHint': 'Click a block to highlight its edges',
  'cfg.irRegion': 'IR text of @{name}',
  'cfg.metaLines': 'Basic blocks: {blocks} · IR lines: {lines}',
  'cfg.irHint': 'Switch back to CFG to see how these instructions branch',

  'canvas.block': 'Basic block {label}, {count} instructions',
  'diff.add': 'Added',
  'diff.del': 'Removed',
  'diff.focus': 'Focus',

  'lab.samples': 'Samples',
  'lab.stats': 'Functions: {functions} · blocks: {blocks} · edges: {edges}',
  'lab.editorTitle': 'IR input',
  'lab.lines': 'Lines: {count}',
  'lab.irLabel': 'LLVM IR source',
  'lab.custom': 'Custom IR',
  'lab.local': '· parsed locally in your browser; nothing is uploaded',
  'lab.viewerTitle': 'Control-flow graph of the input IR',

  'ir.metaTitle': 'CFG lab',
  'ir.metaDescription':
    'Paste any LLVM IR, split it into basic blocks and draw the control flow in your browser. Fully static, parsed on the client.',
  'ir.eyebrow': 'Lab · CFG',
  'ir.heading': 'Spread the IR out',
  'ir.lead':
    'IR reads linearly but runs by jumping around. Split a function into basic blocks, wire them into a directed graph, and branches, merges, loops and unreachable code become obvious. Edit the IR on the left and the graph follows.',
  'ir.tip1': 'Solid edges are fall-through and branches; dashed edges are back edges (loops)',
  'ir.tip2': 'Green true / red false are the two outgoing edges of a conditional branch',
  'ir.tip3': 'Click a basic block to highlight the edges around it',
  'ir.noteTitle': 'It is not a compiler',
  'ir.noteBody':
    'This only does a syntactic split: find functions, find labels, read terminators, then draw the edges. It does not verify that the IR is legal and does not run any optimisation — that is what opt -verify is for.',

  'about.metaTitle': 'About',
  'about.metaDescription':
    'How PassAtlas works: step-by-step IR animations that explain LLVM pass algorithms, fully static and readable offline.',
  'about.eyebrow': 'About',
  'about.heading': 'Why an atlas',
  'about.lead':
    'The LLVM pass documentation tells you what exists, and the source tells you how it is written. Rarely is there a place where you can actually <strong>see</strong> the moment an IR is rewritten.',
  'about.ctaPasses': 'Open the atlas',
  'about.ctaGithub': 'GitHub repository ↗',

  'notFound.metaDescription': 'This page is not in the atlas.',
  'notFound.eyebrow': '404 · Not in the atlas',
  'notFound.lead': 'No pass has processed this path, or the page it points to is not finished yet.',
  'notFound.back': 'Back to the atlas',
  'notFound.home': 'Home',

  'parse.duplicateBlock': 'Basic block {label} is defined twice',
  'parse.missingBrace': 'Function @{name} is missing its closing }',
  'parse.emptyFunction': 'Function @{name} has no basic blocks',
  'parse.missingTerminator': 'Basic block {label} has no terminator (br / ret / switch…)',
  'parse.unknownTarget': 'Basic block {label} branches to missing block {to}',
  'parse.noFunctions': 'No function defined with define',
};

export const messages: Record<Locale, Messages> = { zh, en };

export type MessageKey = keyof ZhMessages;

const INTERPOLATION = /\{(\w+)\}/g;

/** 取一条 UI 文案；缺失时回退到默认语言，再回退到键名本身 */
export function t(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = messages[locale]?.[key] ?? messages[defaultLocale][key] ?? key;
  if (!vars) return template;
  return template.replace(INTERPOLATION, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
