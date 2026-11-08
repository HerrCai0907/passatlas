/**
 * SCC 内联决策实验台的文案与判定说明。
 * 组件只负责状态和布局，中文、英文以及「代价随阈值变化」的解释都放在这里。
 */
import type { Locale } from './config.ts';

export interface SccDecisions {
  inlineClamp: boolean;
  inlineHashMix: boolean;
  renderHashCost: number;
  inlineRenderHash: boolean;
  mainCost: number;
  inlineMain: boolean;
}

export interface SccCandidateText {
  id: string;
  caller: string;
  callee: string;
  cost: number;
  inline: boolean;
  why: string;
}

export type SccNodeId = 'main' | 'render' | 'hash' | 'mix' | 'clamp';

export interface SccLabText {
  kicker: string;
  title: string;
  labAria: string;
  nodeSub: Record<SccNodeId, string>;
  sccBoxLabel: string;
  phaseLabels: string[];
  copy: (phase: number, decisions: SccDecisions, threshold: number) => { title: string; note: string };
  candidates: (
    phase: number,
    decisions: SccDecisions,
    threshold: number,
  ) => SccCandidateText[];
  pseudoAria: string;
  thresholdLabel: string;
  thresholdHint: string;
  inline: string;
  reject: string;
  inlineOneLayer: string;
  keep: string;
  summaryAria: string;
  timelineAria: string;
  timelineStep: (n: number, label: string) => string;
  status: (n: number, title: string) => string;
  graphAria: (n: number, title: string) => string;
  nodeAria: (label: string, sub: string, target: number) => string;
  meterAria: (cost: number, threshold: number, inline: boolean) => string;
  previousFrame: string;
  nextFrame: string;
  play: string;
  pause: string;
  autoplayOff: string;
  autoplayOffTitle: string;
  previousFrameTitle: string;
  nextFrameTitle: string;
  playTitle: string;
  pauseTitle: string;
  footerStep: string;
  spaceKey: string;
  footerPlay: string;
  footerThreshold: string;
  footerNote: string;
  legendCurrentScc: string;
  legendCallEdge: string;
  legendBackEdge: string;
}

const zh: SccLabText = {
  kicker: 'Interactive · CGSCC · InlineCost',
  title: 'SCC 内联决策台',
  labAria: 'SCC 内联决策实验台',
  nodeSub: {
    main: 'public · entry',
    render: 'internal · 2 calls',
    hash: 'SCC 内 · 1 call',
    mix: 'SCC 内 · 1 call',
    clamp: 'internal · 0 calls',
  },
  sccBoxLabel: '互递归 SCC · 2 个函数',
  phaseLabels: ['建图', '缩点', '后序', 'clamp', 'hash / mix', 'render', 'main', '结论'],
  copy: (phase, decisions, threshold) => {
    switch (phase) {
      case 0:
        return {
          title: '建图：每条边都是一个 call site',
          note: '5 个函数、6 条 call edge。main 是入口；hash 与 mix 互相调用，形成唯一的环。这一页只回答「哪条边值得内联」；真正的改写见另一页 inline-function。',
        };
      case 1:
        return {
          title: '缩点：把互递归收进一个 SCC',
          note: '互相可达的函数缩成一个 SCC：{clamp}、{hash, mix}、{render}、{main}。SCC 之间不再有环，可以排序；{hash, mix} 内部的边必须特殊处理。',
        };
      case 2:
        return {
          title: '后序：先 callee，后 caller',
          note: '后序编号 1 clamp → 2 {hash, mix} → 3 render → 4 main。进入 render 时 clamp 已经处理完；进入 main 时 render 已经处理完。这就是「自底向上」的全部含义。',
        };
      case 3:
        return {
          title: 'SCC 1 · clamp：没有出边，先标记就绪',
          note: '当前 SCC 是 {clamp}。它没有 call，worklist 为空，直接标记就绪。注意：内联 render → clamp 是在 render 的 SCC 里发生的，不是在这里——SCC 决定的是「检查哪个函数的 call」。',
        };
      case 4:
        return {
          title: 'SCC 2 · {hash, mix}：SCC 内部的边',
          note: decisions.inlineHashMix
            ? `两条调用 hash → mix、mix → hash 都在 SCC 内部。代价 240 < 阈值 ${threshold}：可以内联一层；但 !inline_history 会阻止下一层。这一帧保留 SCC 原样，重点看 history 截断，而不是重画内部边。`
            : `两条调用 hash → mix、mix → hash 都在 SCC 内部。代价 240，阈值 ${threshold}：拒绝。SCC 内的边即使代价可控，也会受 inline history 与成本乘子约束。`,
        };
      case 5:
        return {
          title: 'SCC 3 · render：两个候选',
          note: decisions.inlineRenderHash
            ? `worklist：render → clamp（30）、render → hash（${decisions.renderHashCost}）。阈值 ${threshold} 下两个都接受。注意：图始终是决策前的 call graph，高亮只表示当前 SCC 与候选；克隆、拆块在 inline-function 里。`
            : `worklist：render → clamp（30）、render → hash（${decisions.renderHashCost}）。阈值 ${threshold}：接受 clamp，拒绝 hash。图仍是决策前的 call graph；删除与拆分不属于这一页。`,
        };
      case 6:
        return {
          title: 'SCC 4 · main：callee 变胖之后',
          note: decisions.inlineMain
            ? `假设上一步的决策已经生效：render 吸收了 clamp（以及可能的 hash），代价变成 ${decisions.mainCost}。main → render 低于阈值 ${threshold}，接受。这里只记录决定，不改写 IR。`
            : `假设上一步的决策已经生效：render 吸收了 clamp（以及可能的 hash），代价变成 ${decisions.mainCost}。main → render 不低于阈值 ${threshold}，拒绝。后序的代价就在这里：callee 先变胖，caller 必须接受。`,
        };
      default:
        return {
          title: '结论：留下决定，改写交给 InlineFunction',
          note: '本轮只产出决策：哪些 call 接受、哪些保留。真正的克隆、CFG 拆分、返回值 PHI 和死函数删除，见 inline-function。图从头到尾都是决策前的 call graph。',
        };
    }
  },
  candidates: (phase, decisions, threshold) => {
    if (phase === 4) {
      return [
        {
          id: 'hash-mix',
          caller: '@hash',
          callee: '@mix',
          cost: 240,
          inline: decisions.inlineHashMix,
          why: decisions.inlineHashMix
            ? `240 < 阈值 ${threshold}：可以内联一层；新产生的自递归 call 会被 !inline_history 截断。`
            : `240 ≥ 阈值 ${threshold}：拒绝。SCC 内边也不会被成本乘子无限展开。`,
        },
      ];
    }

    if (phase === 5) {
      return [
        {
          id: 'render-clamp',
          caller: '@render',
          callee: '@clamp',
          cost: 30,
          inline: decisions.inlineClamp,
          why: 'clamp 只有两条指令，调用点开销比函数体还大；internal + 单一 caller，内联后还能整函数删除。',
        },
        {
          id: 'render-hash',
          caller: '@render',
          callee: '@hash',
          cost: decisions.renderHashCost,
          inline: decisions.inlineRenderHash,
          why: decisions.inlineRenderHash
            ? `clamp 内联后 render 变大，但 ${decisions.renderHashCost} < 阈值 ${threshold}；hash 里的调用被一起拖进来。`
            : `clamp 内联后代价涨到 ${decisions.renderHashCost}，越过阈值 ${threshold}；保留调用。`,
        },
      ];
    }

    if (phase === 6) {
      return [
        {
          id: 'main-render',
          caller: '@main',
          callee: '@render',
          cost: decisions.mainCost,
          inline: decisions.inlineMain,
          why: decisions.inlineMain
            ? `${decisions.mainCost} < 阈值 ${threshold}：main → render 成立。注意 250 附近会出现窗口：render 还没吸收 hash，所以更瘦。`
            : decisions.inlineRenderHash
              ? `render 先吸收了 hash，代价涨到 ${decisions.mainCost}；即使阈值 ${threshold} 不低，main → render 仍被拒绝。`
              : `render 吸收了 clamp，代价从 210 涨到 ${decisions.mainCost}，超过阈值 ${threshold}。`,
        },
      ];
    }

    return [];
  },
  pseudoAria: '内联器伪代码，高亮当前动作',
  thresholdLabel: '内联阈值',
  thresholdHint:
    '225 是 -O2 默认值。代价数字是教学示意；阈值不是单调旋钮：调高会让 callee 先吸收更多内联，caller 反而可能被拒绝。',
  inline: '内联',
  reject: '拒绝',
  inlineOneLayer: '内联 1 层',
  keep: '保留',
  summaryAria: '本轮决策',
  timelineAria: '跳到指定帧',
  timelineStep: (n, label) => `第 ${n} 帧：${label}`,
  status: (n, title) => `第 ${n} 帧：${title}`,
  graphAria: (n, title) =>
    `SCC 内联调度图。main 调用 render，render 调用 clamp 与 hash，hash 和 mix 互相调用。当前第 ${n} 帧：${title}。`,
  nodeAria: (label, sub, target) => `${label}，${sub}；跳到第 ${target} 帧`,
  meterAria: (cost, threshold, inline) =>
    `代价 ${cost}，阈值 ${threshold}，${inline ? '低于阈值，可以内联' : '达到阈值，拒绝内联'}`,
  previousFrame: '上一帧',
  nextFrame: '下一帧',
  play: '自动播放',
  pause: '暂停',
  autoplayOff: '已按系统「减少动态效果」设置关闭自动播放',
  autoplayOffTitle: '已按系统设置关闭自动播放；可继续用 ← → 单步',
  previousFrameTitle: '上一帧（←）',
  nextFrameTitle: '下一帧（→）',
  playTitle: '自动播放（空格）',
  pauseTitle: '暂停（空格）',
  footerStep: '单步',
  spaceKey: '空格',
  footerPlay: '播放',
  footerThreshold: '拖动阈值改变判定',
  footerNote:
    '图固定为决策前的 call graph；接受/拒绝只体现在面板，实际改写见 inline-function。',
  legendCurrentScc: '当前 SCC',
  legendCallEdge: 'call edge',
  legendBackEdge: 'SCC 回边',
};

const en: SccLabText = {
  kicker: 'Interactive · CGSCC · InlineCost',
  title: 'SCC inlining console',
  labAria: 'SCC inlining decision console',
  nodeSub: {
    main: 'public · entry',
    render: 'internal · 2 calls',
    hash: 'inside SCC · 1 call',
    mix: 'inside SCC · 1 call',
    clamp: 'internal · 0 calls',
  },
  sccBoxLabel: 'Mutual-recursion SCC · 2 functions',
  phaseLabels: ['Graph', 'Condense', 'Post-order', 'clamp', 'hash / mix', 'render', 'main', 'Result'],
  copy: (phase, decisions, threshold) => {
    switch (phase) {
      case 0:
        return {
          title: 'Build the graph: every edge is a call site',
          note: 'Five functions, six call edges. main is the entry; hash and mix call each other, forming the only cycle. This page only answers "which edge is worth removing"; the actual rewrite is on the inline-function page.',
        };
      case 1:
        return {
          title: 'Condense: mutual recursion becomes one SCC',
          note: 'Mutually reachable functions collapse into one SCC: {clamp}, {hash, mix}, {render}, {main}. With no cycles left between SCCs they can be ordered; edges inside {hash, mix} need special handling.',
        };
      case 2:
        return {
          title: 'Post-order: callees first, callers later',
          note: 'Post-order is 1 clamp → 2 {hash, mix} → 3 render → 4 main. clamp is already done when render starts, and render is done when main starts. That is the whole meaning of "bottom-up".',
        };
      case 3:
        return {
          title: 'SCC 1 · clamp: no outgoing edges, mark it ready',
          note: 'The current SCC is {clamp}. It has no calls, so the worklist is empty and it is marked ready. Note that inlining render → clamp happens while processing render, not here — an SCC decides which function’s calls are inspected.',
        };
      case 4:
        return {
          title: 'SCC 2 · {hash, mix}: edges inside the SCC',
          note: decisions.inlineHashMix
            ? `Both calls, hash → mix and mix → hash, are inside the SCC. Cost 240 < threshold ${threshold}: one layer can be inlined, but !inline_history blocks the next one. This frame keeps the SCC as-is and focuses on history truncation, not on redrawing internal edges.`
            : `Both calls, hash → mix and mix → hash, are inside the SCC. Cost 240, threshold ${threshold}: rejected. Even when the cost looks manageable, intra-SCC edges are constrained by inline history and the cost multiplier.`,
        };
      case 5:
        return {
          title: 'SCC 3 · render: two candidates',
          note: decisions.inlineRenderHash
            ? `Worklist: render → clamp (30), render → hash (${decisions.renderHashCost}). Both are accepted at threshold ${threshold}. The graph is always the pre-decision call graph; the highlight marks the current SCC and its candidates. Cloning and block splitting happen in inline-function.`
            : `Worklist: render → clamp (30), render → hash (${decisions.renderHashCost}). At threshold ${threshold}: accept clamp, reject hash. The graph is still the pre-decision call graph; deletion and splitting belong to the other page.`,
        };
      case 6:
        return {
          title: 'SCC 4 · main: after the callee got bigger',
          note: decisions.inlineMain
            ? `Assume the decisions from the previous step already took effect: render absorbed clamp (and possibly hash), so its cost is ${decisions.mainCost}. main → render is below threshold ${threshold}, accepted. Only the decision is recorded here; the IR is not rewritten.`
            : `Assume the decisions from the previous step already took effect: render absorbed clamp (and possibly hash), so its cost is ${decisions.mainCost}. main → render is not below threshold ${threshold}, rejected. That is the price of post-order: the callee gets bigger first, and the caller has to live with it.`,
        };
      default:
        return {
          title: 'Result: record the decisions, leave the rewrite to InlineFunction',
          note: 'This round only produces decisions: which calls are accepted and which are kept. The actual cloning, CFG splitting, return-value PHI and dead-function removal are described on the inline-function page. The graph is the pre-decision call graph from start to finish.',
        };
    }
  },
  candidates: (phase, decisions, threshold) => {
    if (phase === 4) {
      return [
        {
          id: 'hash-mix',
          caller: '@hash',
          callee: '@mix',
          cost: 240,
          inline: decisions.inlineHashMix,
          why: decisions.inlineHashMix
            ? `240 < threshold ${threshold}: one layer can be inlined; the new self-recursive call is cut off by !inline_history.`
            : `240 ≥ threshold ${threshold}: rejected. Intra-SCC edges are never expanded indefinitely by the cost multiplier.`,
        },
      ];
    }

    if (phase === 5) {
      return [
        {
          id: 'render-clamp',
          caller: '@render',
          callee: '@clamp',
          cost: 30,
          inline: decisions.inlineClamp,
          why: 'clamp has only two instructions, so the call overhead is larger than the body; internal with a single caller, and the whole function can be deleted after inlining.',
        },
        {
          id: 'render-hash',
          caller: '@render',
          callee: '@hash',
          cost: decisions.renderHashCost,
          inline: decisions.inlineRenderHash,
          why: decisions.inlineRenderHash
            ? `After inlining clamp, render grows, but ${decisions.renderHashCost} < threshold ${threshold}; the calls inside hash come along.`
            : `After inlining clamp the cost rises to ${decisions.renderHashCost}, crossing threshold ${threshold}; keep the call.`,
        },
      ];
    }

    if (phase === 6) {
      return [
        {
          id: 'main-render',
          caller: '@main',
          callee: '@render',
          cost: decisions.mainCost,
          inline: decisions.inlineMain,
          why: decisions.inlineMain
            ? `${decisions.mainCost} < threshold ${threshold}: main → render is accepted. Note the window near 250: render has not absorbed hash yet, so it is thinner.`
            : decisions.inlineRenderHash
              ? `render absorbed hash first, so the cost rises to ${decisions.mainCost}; even at threshold ${threshold}, main → render is still rejected.`
              : `render absorbed clamp, so the cost rises from 210 to ${decisions.mainCost}, above threshold ${threshold}.`,
        },
      ];
    }

    return [];
  },
  pseudoAria: 'Inliner pseudocode, highlighting the current action',
  thresholdLabel: 'Inline threshold',
  thresholdHint:
    '225 is the -O2 default. The costs are illustrative; the threshold is not a monotonic knob: raising it lets the callee absorb more inlining first, so the caller can end up rejected.',
  inline: 'Inline',
  reject: 'Reject',
  inlineOneLayer: 'Inline 1 layer',
  keep: 'Keep',
  summaryAria: 'Decisions from this round',
  timelineAria: 'Jump to a frame',
  timelineStep: (n, label) => `Frame ${n}: ${label}`,
  status: (n, title) => `Frame ${n}: ${title}`,
  graphAria: (n, title) =>
    `SCC inlining schedule. main calls render, render calls clamp and hash, and hash and mix call each other. Current frame ${n}: ${title}.`,
  nodeAria: (label, sub, target) => `${label}, ${sub}; jump to frame ${target}`,
  meterAria: (cost, threshold, inline) =>
    `Cost ${cost}, threshold ${threshold}; ${inline ? 'below threshold, inlining allowed' : 'at or above threshold, inlining rejected'}`,
  previousFrame: 'Previous frame',
  nextFrame: 'Next frame',
  play: 'Play',
  pause: 'Pause',
  autoplayOff: 'Autoplay is off because the system prefers reduced motion',
  autoplayOffTitle: 'Autoplay is disabled by the system setting; keep using ← → to step',
  previousFrameTitle: 'Previous frame (←)',
  nextFrameTitle: 'Next frame (→)',
  playTitle: 'Play (Space)',
  pauseTitle: 'Pause (Space)',
  footerStep: 'step',
  spaceKey: 'Space',
  footerPlay: 'play',
  footerThreshold: 'drag the threshold to change the decisions',
  footerNote:
    'The graph is always the pre-decision call graph. Accept/reject only shows in the panel; the rewrite is on the inline-function page.',
  legendCurrentScc: 'Current SCC',
  legendCallEdge: 'call edge',
  legendBackEdge: 'SCC back edge',
};

export const sccLabText: Record<Locale, SccLabText> = { zh, en };
