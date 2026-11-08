/**
 * sample-profile-inline 实验台的文案与判定说明。
 * 组件只负责状态和布局，中英文以及「阈值/开关怎样改变判定」的解释都放在这里。
 */
import type { Locale } from './config.ts';

export type CandidateId = 'foo' | 'bar' | 'baz';

export interface SampleProfileDecisions {
  /** 冷调用点上限（-sample-profile-cold-inline-threshold） */
  coldLimit: number;
  /** 是否内联冷调用点（-sample-profile-inline-size） */
  sizeInline: boolean;
  /** 当前的 baz 是否被内联 */
  inlineBaz: boolean;
}

export interface LabPhaseCopy {
  title: string;
  note: string;
}

export interface SampleProfileLabText {
  kicker: string;
  title: string;
  labAria: string;
  stackTitle: string;
  stackAria: string;
  stackNote: string;
  queueTitle: string;
  queueAria: string;
  topLevel: string;
  statusPending: string;
  statusCurrent: string;
  statusInlined: string;
  statusSkipped: string;
  statusFresh: string;
  statusHidden: string;
  statusDeciding: string;
  hot: string;
  cold: string;
  sampleCount: (n: number) => string;
  contextLabel: (context: string) => string;
  phaseLabels: string[];
  copy: (phase: number, decisions: SampleProfileDecisions) => LabPhaseCopy;
  candidateAria: (caller: string, callee: string, count: number, status: string) => string;
  decisionTitle: string;
  decisionAria: string;
  reason: (id: CandidateId, decisions: SampleProfileDecisions) => string;
  costLabel: (cost: number) => string;
  limitLabel: (limit: number) => string;
  meterAria: (cost: number, limit: number, ok: boolean) => string;
  coldLabel: string;
  coldHint: string;
  sizeLabel: string;
  sizeHint: string;
  summaryTitle: string;
  summaryAria: string;
  summaryInlined: string;
  summarySkipped: string;
  summaryStat: (instructions: number, budget: number) => string;
  timelineAria: string;
  timelineStep: (n: number, label: string) => string;
  previousFrame: string;
  previousFrameTitle: string;
  nextFrame: string;
  nextFrameTitle: string;
  play: string;
  playTitle: string;
  pause: string;
  pauseTitle: string;
  autoplayOff: string;
  autoplayOffTitle: string;
  footerStep: string;
  spaceKey: string;
  footerPlay: string;
  footerThreshold: string;
  footerNote: string;
  status: (n: number, title: string) => string;
}

const zh: SampleProfileLabText = {
  kicker: 'Interactive · CSSPGO',
  title: '样本内联决策台',
  labAria: '样本内联决策实验台',
  stackTitle: '内联栈 = 上下文前缀',
  stackAria: '当前已经物化的内联栈',
  stackNote: '每展开一层，callee 的调用点就多一层前缀；队列里的候选按这个前缀去 profile 树里取样本。',
  queueTitle: '候选队列',
  queueAria: '按样本数出队的内联候选',
  topLevel: '顶层',
  statusPending: '排队中',
  statusCurrent: '当前候选',
  statusInlined: '已内联',
  statusSkipped: '已跳过',
  statusFresh: '新入队',
  statusHidden: '尚未暴露',
  statusDeciding: '待判定',
  hot: '热',
  cold: '冷',
  sampleCount: (n) => `${n} 样本`,
  contextLabel: (context) => `上下文 ${context}`,
  phaseLabels: ['入队', '展开 foo', '展开 bar', '处理 baz', '收尾'],
  copy: (phase, decisions) => {
    if (phase === 0) {
      return {
        title: '先把每条 call 变成候选',
        note: '候选记下 callee 的 profile 指针和 CallsiteCount（head samples × probe Factor）。foo 有 98000 个样本排在队首，baz 只有 40。',
      };
    }
    if (phase === 1) {
      return {
        title: 'foo 是热调用点，直接展开',
        note: '98000 高于 PSI 热阈值，cost 120 远小于热调用点上限 3000；getInlineCost 只用来确认它不是 noinline / optnone。展开后新暴露的 bar 带着 main:foo 入队。',
      };
    }
    if (phase === 2) {
      return {
        title: 'bar 继承更长的上下文',
        note: 'bar 在 main:foo 下有 95000 个样本，仍然最热；cost 90 小于 3000，继续展开。队列里只剩 baz。',
      };
    }
    if (phase === 3) {
      if (!decisions.sizeInline) {
        return {
          title: '冷调用点：开关关掉，直接跳过',
          note: 'baz 只有 40 个样本，算不上热调用点。关掉 -sample-profile-inline-size 后，冷调用点一律不进代价比较。',
        };
      }
      if (decisions.inlineBaz) {
        return {
          title: '冷调用点：60 ≤ 上限，收了',
          note: '把冷调用点上限拖到 60 以上，cost 60 的 baz 也会被内联——这就是 -sample-profile-cold-inline-threshold 的作用。',
        };
      }
      return {
        title: '冷调用点：60 > 上限，跳过',
        note: 'baz 只有 40 个样本，cost 60 超过冷调用点上限 45。把滑块拖到 60 以上，它就会被收下。',
      };
    }
    const inlined = 2 + (decisions.inlineBaz ? 1 : 0);
    return {
      title: '队列空，这个函数处理结束',
      note: `一共内联 ${inlined} 条调用边。接下来 instcombine 会把常量折掉，GlobalDCE 再清掉没人调用的 outline 副本；被标记为 inlined 的上下文不会再合并回 base profile。`,
    };
  },
  candidateAria: (caller, callee, count, status) =>
    `${caller} 调用 ${callee}，${count} 个样本，${status}`,
  decisionTitle: '当前候选',
  decisionAria: '当前候选的判定',
  reason: (id, decisions) => {
    if (id === 'foo') {
      return '热调用点：98k > 热阈值，cost 120 ≤ 3000，直接接受。';
    }
    if (id === 'bar') {
      return '热调用点：95k，context main:foo，cost 90 ≤ 3000，直接接受。';
    }
    if (!decisions.sizeInline) {
      return '冷调用点 40，且 -sample-profile-inline-size 关闭，跳过。';
    }
    if (decisions.inlineBaz) {
      return `冷调用点 40，cost 60 ≤ 冷上限 ${decisions.coldLimit}，接受。`;
    }
    return `冷调用点 40，cost 60 > 冷上限 ${decisions.coldLimit}，跳过。`;
  },
  costLabel: (cost) => `cost ${cost}`,
  limitLabel: (limit) => `上限 ${limit}`,
  meterAria: (cost, limit, ok) =>
    ok
      ? `代价 ${cost}，上限 ${limit}，在上限之内`
      : `代价 ${cost}，上限 ${limit}，超过上限`,
  coldLabel: '冷调用点上限',
  coldHint: '对应 -sample-profile-cold-inline-threshold，默认 45。只影响冷调用点；热调用点的上限固定 3000。',
  sizeLabel: '内联冷调用点',
  sizeHint: '对应 -sample-profile-inline-size，CSSPGO 下默认开。关掉后冷调用点不再进代价比较。',
  summaryTitle: '本函数结果',
  summaryAria: '本函数的内联结果',
  summaryInlined: '内联',
  summarySkipped: '跳过',
  summaryStat: (instructions, budget) =>
    `main 指令数 4 → ${instructions} · 预算 ${budget}（4 × 12 被抬到下限 100）`,
  timelineAria: '实验台帧',
  timelineStep: (n, label) => `第 ${n} 帧：${label}`,
  previousFrame: '上一帧',
  previousFrameTitle: '上一帧（←）',
  nextFrame: '下一帧',
  nextFrameTitle: '下一帧（→）',
  play: '自动播放',
  playTitle: '自动播放（空格）',
  pause: '暂停',
  pauseTitle: '暂停（空格）',
  autoplayOff: '已按减少动态效果关闭',
  autoplayOffTitle: '系统设置了 reduce motion，自动播放被禁用',
  footerStep: '切帧',
  spaceKey: '空格',
  footerPlay: '播放 / 暂停',
  footerThreshold: '拖动上限改判定',
  footerNote: '判定顺序固定：replay → 热度分流 → 代价只判合法性 → preinliner 重放；这里演示的是第二、三步。',
  status: (n, title) => `第 ${n} 帧，${title}`,
};

const en: SampleProfileLabText = {
  kicker: 'Interactive · CSSPGO',
  title: 'Sample inlining decision desk',
  labAria: 'Sample-profile inlining lab',
  stackTitle: 'Inline stack = context prefix',
  stackAria: 'The inline stack materialised so far',
  stackNote: 'Each expansion adds one prefix to the callee call site; candidates in the queue use that prefix to look up samples in the profile tree.',
  queueTitle: 'Candidate queue',
  queueAria: 'Inline candidates ordered by sample count',
  topLevel: 'top level',
  statusPending: 'queued',
  statusCurrent: 'current',
  statusInlined: 'inlined',
  statusSkipped: 'skipped',
  statusFresh: 'new',
  statusHidden: 'not exposed yet',
  statusDeciding: 'pending',
  hot: 'hot',
  cold: 'cold',
  sampleCount: (n) => `${n} samples`,
  contextLabel: (context) => `context ${context}`,
  phaseLabels: ['queue', 'inline foo', 'inline bar', 'baz', 'wrap up'],
  copy: (phase, decisions) => {
    if (phase === 0) {
      return {
        title: 'Turn every call into a candidate',
        note: 'A candidate records the callee profile node and CallsiteCount (head samples × probe Factor). foo has 98000 samples and leads the queue; baz has 40.',
      };
    }
    if (phase === 1) {
      return {
        title: 'foo is hot, expand it',
        note: '98000 is above the PSI hot threshold and cost 120 is far below the 3000 hot-call-site limit; getInlineCost only checks that it is not noinline / optnone. The newly exposed bar queues with main:foo.',
      };
    }
    if (phase === 2) {
      return {
        title: 'bar inherits a longer context',
        note: 'bar has 95000 samples under main:foo and is still the hottest candidate; cost 90 is below 3000, so it is expanded too. Only baz is left.',
      };
    }
    if (phase === 3) {
      if (!decisions.sizeInline) {
        return {
          title: 'Cold call site: switch is off, skip',
          note: 'baz has only 40 samples, so it is not hot. With -sample-profile-inline-size off, cold call sites never reach the cost comparison.',
        };
      }
      if (decisions.inlineBaz) {
        return {
          title: 'Cold call site: 60 ≤ limit, taken',
          note: 'Raise the cold limit above 60 and baz, with cost 60, is inlined too — that is what -sample-profile-cold-inline-threshold controls.',
        };
      }
      return {
        title: 'Cold call site: 60 > limit, skipped',
        note: 'baz has 40 samples and cost 60 exceeds the cold limit of 45. Drag the slider above 60 and it is taken.',
      };
    }
    const inlined = 2 + (decisions.inlineBaz ? 1 : 0);
    return {
      title: 'Queue drained, the function is done',
      note: `${inlined} call edges were inlined. instcombine folds the constants next, GlobalDCE drops the now-unused outlined copies, and contexts marked inlined are never merged back into the base profile.`,
    };
  },
  candidateAria: (caller, callee, count, status) =>
    `${caller} calls ${callee}, ${count} samples, ${status}`,
  decisionTitle: 'Current candidate',
  decisionAria: 'Decision for the current candidate',
  reason: (id, decisions) => {
    if (id === 'foo') {
      return 'Hot call site: 98k > hot threshold, cost 120 ≤ 3000, accepted.';
    }
    if (id === 'bar') {
      return 'Hot call site: 95k, context main:foo, cost 90 ≤ 3000, accepted.';
    }
    if (!decisions.sizeInline) {
      return 'Cold call site 40, and -sample-profile-inline-size is off, so it is skipped.';
    }
    if (decisions.inlineBaz) {
      return `Cold call site 40, cost 60 ≤ cold limit ${decisions.coldLimit}, accepted.`;
    }
    return `Cold call site 40, cost 60 > cold limit ${decisions.coldLimit}, skipped.`;
  },
  costLabel: (cost) => `cost ${cost}`,
  limitLabel: (limit) => `limit ${limit}`,
  meterAria: (cost, limit, ok) =>
    ok
      ? `cost ${cost}, limit ${limit}, within the limit`
      : `cost ${cost}, limit ${limit}, over the limit`,
  coldLabel: 'Cold call-site limit',
  coldHint: 'The -sample-profile-cold-inline-threshold flag, 45 by default. Only affects cold call sites; the hot limit stays at 3000.',
  sizeLabel: 'Inline cold call sites',
  sizeHint: 'The -sample-profile-inline-size flag, on by default for CSSPGO. When off, cold call sites skip the cost comparison entirely.',
  summaryTitle: 'Result for this function',
  summaryAria: 'Inlining result for this function',
  summaryInlined: 'inline',
  summarySkipped: 'skip',
  summaryStat: (instructions, budget) =>
    `main: 4 → ${instructions} instructions · budget ${budget} (4 × 12 raised to the 100 floor)`,
  timelineAria: 'Lab frames',
  timelineStep: (n, label) => `Frame ${n}: ${label}`,
  previousFrame: 'Previous frame',
  previousFrameTitle: 'Previous frame (←)',
  nextFrame: 'Next frame',
  nextFrameTitle: 'Next frame (→)',
  play: 'Autoplay',
  playTitle: 'Autoplay (space)',
  pause: 'Pause',
  pauseTitle: 'Pause (space)',
  autoplayOff: 'Autoplay off (reduced motion)',
  autoplayOffTitle: 'Reduced motion is requested, autoplay is disabled',
  footerStep: 'frames',
  spaceKey: 'space',
  footerPlay: 'play / pause',
  footerThreshold: 'drag the limit to change the verdict',
  footerNote: 'The gate order is fixed: replay → hotness split → cost as legality check → preinliner replay. This lab shows the second and third.',
  status: (n, title) => `Frame ${n}, ${title}`,
};

export const sampleProfileLabText: Record<Locale, SampleProfileLabText> = { zh, en };
