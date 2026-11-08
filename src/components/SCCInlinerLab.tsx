import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import './SCCInlinerLab.css';

type SccId = 'clamp' | 'hashmix' | 'render' | 'main';
type NodeId = 'main' | 'render' | 'hash' | 'mix' | 'clamp';

interface NodeDef {
  id: NodeId;
  label: string;
  sub: string;
  scc: SccId;
  x: number;
  y: number;
}

const NODE_W = 112;
const NODE_H = 48;
const MIN_THRESHOLD = 50;
const MAX_THRESHOLD = 400;
const DEFAULT_THRESHOLD = 225;
const METER_MAX = 400;

const NODES: NodeDef[] = [
  { id: 'main', label: '@main', sub: 'public · entry', scc: 'main', x: 260, y: 48 },
  { id: 'render', label: '@render', sub: 'internal · 2 calls', scc: 'render', x: 260, y: 142 },
  { id: 'hash', label: '@hash', sub: 'SCC 内 · 1 call', scc: 'hashmix', x: 112, y: 252 },
  { id: 'mix', label: '@mix', sub: 'SCC 内 · 1 call', scc: 'hashmix', x: 340, y: 252 },
  { id: 'clamp', label: '@clamp', sub: 'internal · 0 calls', scc: 'clamp', x: 438, y: 354 },
];

const SCCS: { id: SccId; order: number; label: string; phase: number }[] = [
  { id: 'clamp', order: 1, label: 'SCC 1 · clamp', phase: 3 },
  { id: 'hashmix', order: 2, label: 'SCC 2 · {hash, mix}', phase: 4 },
  { id: 'render', order: 3, label: 'SCC 3 · render', phase: 5 },
  { id: 'main', order: 4, label: 'SCC 4 · main', phase: 6 },
];

const SCC_TAG_POS: Record<SccId, { x: number; y: number }> = {
  main: { x: 190, y: 12 },
  render: { x: 326, y: 106 },
  hashmix: { x: 44, y: 318 },
  clamp: { x: 330, y: 318 },
};

const PSEUDO = [
  'for SCC in post_order(call_graph):',
  '  worklist = calls_inside(SCC)',
  '  for call in worklist:',
  '    ic = getInlineCost(call)',
  '    if ic.cost >= ic.threshold: continue',
  '    inline(call)',
  '    worklist += newly_exposed_calls(call)',
  '    update_call_graph_and_scc()',
  '  delete_trivially_dead_functions()',
];

const PHASE_LABELS = ['建图', '缩点', '后序', 'clamp', 'hash / mix', 'render', 'main', '收尾'];

const PHASE_CODE: Record<number, number[]> = {
  0: [0],
  1: [0],
  2: [0],
  3: [1],
  4: [2, 3, 4],
  5: [2, 3, 4, 5, 6],
  6: [2, 3, 4, 5, 7],
  7: [8],
};

const PRESETS = [
  { value: 50, label: '-Os 50' },
  { value: 225, label: '-O2 225' },
  { value: 250, label: '-O3 250' },
  { value: 325, label: 'hint 325' },
];

interface Decisions {
  inlineClamp: boolean;
  inlineHashMix: boolean;
  renderHashCost: number;
  inlineRenderHash: boolean;
  mainCost: number;
  inlineMain: boolean;
}

interface Candidate {
  id: string;
  caller: string;
  callee: string;
  cost: number;
  inline: boolean;
  why: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function computeDecisions(threshold: number): Decisions {
  const inlineClamp = 30 < threshold;
  const inlineHashMix = 240 < threshold;
  const renderHashCost = 240 + (inlineClamp ? 25 : 0);
  const inlineRenderHash = renderHashCost < threshold;
  const mainCost = 210 + (inlineClamp ? 35 : 0) + (inlineRenderHash ? 130 : 0);
  const inlineMain = mainCost < threshold;
  return { inlineClamp, inlineHashMix, renderHashCost, inlineRenderHash, mainCost, inlineMain };
}

function meterStyle(value: number): CSSProperties {
  return { width: `${Math.min(100, (value / METER_MAX) * 100)}%` };
}

function thresholdStyle(value: number): CSSProperties {
  return { left: `${Math.min(100, (value / METER_MAX) * 100)}%` };
}

function CostMeter({ cost, threshold, inline }: { cost: number; threshold: number; inline: boolean }) {
  return (
    <div
      className="pa-scc__meter"
      role="img"
      aria-label={`代价 ${cost}，阈值 ${threshold}，${inline ? '低于阈值，可以内联' : '达到阈值，拒绝内联'}`}
    >
      <div className="pa-scc__meter-track">
        <span
          className={`pa-scc__meter-fill${inline ? '' : ' pa-scc__meter-fill--bad'}`}
          style={meterStyle(cost)}
        />
        <span className="pa-scc__meter-mark" style={thresholdStyle(threshold)} aria-hidden="true" />
      </div>
      <div className="pa-scc__meter-labels">
        <span>cost {cost}</span>
        <span>threshold {threshold}</span>
      </div>
    </div>
  );
}

export default function SCCInlinerLab() {
  const uid = useId().replace(/:/g, '');
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const reducedMotion = usePrefersReducedMotion();
  const sliderId = `${uid}-threshold`;
  const sliderHintId = `${uid}-threshold-hint`;

  const decisions = useMemo(() => computeDecisions(threshold), [threshold]);
  const lastPhase = PHASE_LABELS.length - 1;

  const goTo = useCallback((next: number) => {
    setPhase(Math.max(0, Math.min(lastPhase, next)));
  }, [lastPhase]);

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    if (phase >= lastPhase) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setPhase((value) => Math.min(lastPhase, value + 1));
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [playing, phase, lastPhase, reducedMotion]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.closest('button, input, select, a, textarea')) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPlaying(false);
      goTo(phase + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaying(false);
      goTo(phase - 1);
    } else if (event.key === ' ') {
      event.preventDefault();
      if (!reducedMotion) setPlaying((value) => !value);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPlaying(false);
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPlaying(false);
      goTo(lastPhase);
    }
  };

  const activeScc: SccId | null =
    phase === 1
      ? 'hashmix'
      : phase === 3
        ? 'clamp'
        : phase === 4
          ? 'hashmix'
          : phase === 5
            ? 'render'
            : phase === 6
              ? 'main'
              : null;

  const processed = useMemo(() => {
    const done: SccId[] = [];
    if (phase > 3) done.push('clamp');
    if (phase > 4) done.push('hashmix');
    if (phase > 5) done.push('render');
    if (phase > 6) done.push('main');
    return done;
  }, [phase]);

  const dead = useMemo(() => {
    const nodes = new Set<NodeId>();
    if (phase >= 5 && decisions.inlineClamp) nodes.add('clamp');
    if (phase >= 6 && decisions.inlineMain) nodes.add('render');
    return nodes;
  }, [phase, decisions]);

  const renderGone = dead.has('render');
  const showRenderClamp =
    !(phase >= 5 && decisions.inlineClamp) && !renderGone && !dead.has('clamp');
  const showRenderHash = !(phase >= 5 && decisions.inlineRenderHash) && !renderGone;
  const showMainRender = !(phase >= 6 && decisions.inlineMain);
  const showMainHash = phase >= 6 && decisions.inlineMain && !decisions.inlineRenderHash;

  const candidates = useMemo<Candidate[]>(() => {
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
  }, [phase, decisions, threshold]);

  const copy = useMemo(() => {
    switch (phase) {
      case 0:
        return {
          title: '建图：每条边都是一个 call site',
          note: '5 个函数、6 条 call edge。main 是入口；hash 与 mix 互相调用，形成唯一的环。内联器不看函数列表，它看这张图。',
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
          title: 'SCC 3 · render：先处理 clamp',
          note: decisions.inlineRenderHash
            ? `worklist：render → clamp（30）、render → hash（${decisions.renderHashCost}）。阈值 ${threshold} 下两个都通过：clamp 把 render 撑大，hash 又把它的调用拖进来，render 继续膨胀。`
            : `worklist：render → clamp（30）、render → hash（${decisions.renderHashCost}）。阈值 ${threshold}：clamp 内联，hash 拒绝。clamp 变死函数，render 保留对 hash 的调用。`,
        };
      case 6:
        return {
          title: 'SCC 4 · main：render 已经不一样了',
          note: decisions.inlineMain
            ? `main 只有一个 call：main → render。此时 render 的代价是 ${decisions.mainCost}，低于阈值 ${threshold}，内联成立；render 的唯一 caller 已经吸收它，随后会被删除。`
            : `main 只有一个 call：main → render。render 的代价已经变成 ${decisions.mainCost}，不低于阈值 ${threshold}，拒绝。后序的代价就在这里：callee 先变胖，caller 必须接受。`,
        };
      default:
        return {
          title: '收尾：删除死函数，回到 worklist',
          note: decisions.inlineMain
            ? '本轮内联结束：clamp 与 render 都变成死函数并被删除，main 吸收了整条链。真实实现还会把新暴露的 call 继续追加到 worklist，直到不再变化。'
            : '本轮内联结束：clamp 被删除，render 仍是独立函数。真实实现还会把新暴露的 call 继续追加到 worklist，直到不再变化。',
        };
    }
  }, [phase, decisions, threshold]);

  const handleNodeKey = (event: ReactKeyboardEvent<SVGGElement>, targetPhase: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      setPlaying(false);
      goTo(targetPhase);
    }
  };

  const renderNode = (node: NodeDef) => {
    const isDead = dead.has(node.id);
    const isActive = activeScc === node.scc && phase >= 3;
    const isDone = processed.includes(node.scc);
    const classes = [
      'pa-scc__node',
      isActive ? 'is-active' : '',
      isDone ? 'is-done' : '',
      isDead ? 'is-dead' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const targetPhase = SCCS.find((scc) => scc.id === node.scc)?.phase ?? 0;

    return (
      <g
        key={node.id}
        className={classes}
        role="button"
        tabIndex={0}
        aria-label={`${node.label}，${node.sub}${isDead ? '，已删除' : ''}；跳到第 ${targetPhase + 1} 帧`}
        onClick={() => {
          setPlaying(false);
          goTo(targetPhase);
        }}
        onKeyDown={(event) => handleNodeKey(event, targetPhase)}
      >
        <rect x={node.x - NODE_W / 2} y={node.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={10} />
        <text className="pa-scc__node-name" x={node.x - NODE_W / 2 + 12} y={node.y - 2}>
          {node.label}
        </text>
        <text className="pa-scc__node-sub" x={node.x - NODE_W / 2 + 12} y={node.y + 15}>
          {node.sub}
        </text>
        {isDead ? (
          <text className="pa-scc__node-x" x={node.x + NODE_W / 2 - 14} y={node.y - 6}>
            ✕
          </text>
        ) : null}
      </g>
    );
  };

  const edgeClass = (active: boolean, back = false) =>
    ['pa-scc__edge', active ? 'is-active' : '', back ? 'is-back' : ''].filter(Boolean).join(' ');

  return (
    <div
      className="pa-scc"
      role="group"
      aria-label="SCC 内联算法实验台"
      tabIndex={0}
      data-playing={playing ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
    >
      <header className="pa-scc__head">
        <div className="pa-scc__heading">
          <p className="pa-scc__kicker">Interactive · CGSCC · InlineCost</p>
          <h3 className="pa-scc__title">SCC 内联调度器</h3>
        </div>
        <div className="pa-scc__actions">
          <button
            type="button"
            className="pa-scc__btn"
            onClick={() => {
              setPlaying(false);
              goTo(phase - 1);
            }}
            disabled={phase === 0}
            aria-label="上一帧"
            title="上一帧（←）"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="pa-scc__btn pa-scc__btn--play"
            onClick={() => {
              if (reducedMotion) return;
              setPlaying((value) => !value);
            }}
            disabled={reducedMotion}
            aria-label={
              reducedMotion ? '已按系统「减少动态效果」设置关闭自动播放' : playing ? '暂停' : '自动播放'
            }
            title={
              reducedMotion
                ? '已按系统设置关闭自动播放；可继续用 ← → 单步'
                : playing
                  ? '暂停（空格）'
                  : '自动播放（空格）'
            }
          >
            {playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 5v14M15 5v14" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5l11 7-11 7z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="pa-scc__btn"
            onClick={() => {
              setPlaying(false);
              goTo(phase + 1);
            }}
            disabled={phase === lastPhase}
            aria-label="下一帧"
            title="下一帧（→）"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="pa-scc__counter">
            <strong>{String(phase + 1).padStart(2, '0')}</strong>
            <span aria-hidden="true"> / </span>
            {String(PHASE_LABELS.length).padStart(2, '0')}
          </span>
        </div>
      </header>

      <div className="pa-scc__progress" aria-hidden="true">
        <span style={{ width: `${((phase + 1) / PHASE_LABELS.length) * 100}%` }} />
      </div>

      <div className="pa-scc__main">
        <div className="pa-scc__graph">
          <svg
            className="pa-scc__svg"
            viewBox="0 0 520 410"
            role="group"
            aria-label={`SCC 内联调度图。main 调用 render，render 调用 clamp 与 hash，hash 和 mix 互相调用。当前第 ${phase + 1} 帧：${copy.title}。`}
          >
            <defs>
              <marker
                id={`${uid}-arrow`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path className="pa-scc__arrow" d="M0 0 L10 5 L0 10 z" />
              </marker>
              <marker
                id={`${uid}-arrow-active`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path className="pa-scc__arrow pa-scc__arrow--active" d="M0 0 L10 5 L0 10 z" />
              </marker>
            </defs>

            <rect
              className={`pa-scc__scc-box${activeScc === 'hashmix' ? ' is-active' : ''}`}
              x={32}
              y={200}
              width={364}
              height={104}
              rx={16}
            />
            <text className="pa-scc__scc-box-label" x={386} y={218} textAnchor="end">
              互递归 SCC · 2 个函数
            </text>

            {showMainRender ? (
              <g className={edgeClass(phase === 6, false)}>
                <path
                  className="pa-scc__edge-line"
                  d="M260 72 L260 118"
                  markerEnd={`url(#${uid}-${phase === 6 ? 'arrow-active' : 'arrow'})`}
                />
              </g>
            ) : null}

            {showRenderHash ? (
              <g className={edgeClass(phase === 5, false)}>
                <path
                  className="pa-scc__edge-line"
                  d="M222 166 L130 228"
                  markerEnd={`url(#${uid}-${phase === 5 ? 'arrow-active' : 'arrow'})`}
                />
              </g>
            ) : null}

            {showRenderClamp ? (
              <g className={edgeClass(phase === 5, false)}>
                <path
                  className="pa-scc__edge-line"
                  d="M304 166 C 420 190, 480 260, 438 330"
                  markerEnd={`url(#${uid}-${phase === 5 ? 'arrow-active' : 'arrow'})`}
                />
              </g>
            ) : null}

            <g className={edgeClass(phase === 4, false)}>
              <path
                className="pa-scc__edge-line"
                d="M168 252 L284 252"
                markerEnd={`url(#${uid}-${phase === 4 ? 'arrow-active' : 'arrow'})`}
              />
            </g>
            <g className={edgeClass(phase === 4, true)}>
              <path
                className="pa-scc__edge-line"
                d="M284 264 C 260 300, 196 300, 168 264"
                markerEnd={`url(#${uid}-${phase === 4 ? 'arrow-active' : 'arrow'})`}
              />
            </g>

            {showMainHash ? (
              <g className="pa-scc__edge is-active is-added">
                <path
                  className="pa-scc__edge-line"
                  d="M222 72 C 150 120, 100 180, 112 228"
                  markerEnd={`url(#${uid}-arrow-active)`}
                />
              </g>
            ) : null}

            {phase >= 3 && showMainRender ? (
              <text className="pa-scc__edge-cost" x={270} y={99}>
                {decisions.mainCost}
              </text>
            ) : null}
            {phase >= 3 && showRenderHash ? (
              <text className="pa-scc__edge-cost" x={176} y={202}>
                {decisions.renderHashCost}
              </text>
            ) : null}
            {phase >= 3 && showRenderClamp ? (
              <text className="pa-scc__edge-cost" x={424} y={254}>
                30
              </text>
            ) : null}
            {phase >= 3 ? (
              <text className="pa-scc__edge-cost" x={226} y={245}>
                240
              </text>
            ) : null}

            {SCCS.map((scc) => {
              const pos = SCC_TAG_POS[scc.id];
              const isActive = activeScc === scc.id;
              const isDone = processed.includes(scc.id);
              const isDeadScc =
                scc.id !== 'main' &&
                NODES.filter((node) => node.scc === scc.id).every((node) => dead.has(node.id));
              const orderClass = [
                'pa-scc__order',
                isActive ? 'is-active' : '',
                isDone ? 'is-done' : '',
                isDeadScc ? 'is-dead' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <g key={scc.id} className={orderClass}>
                  <circle cx={pos.x} cy={pos.y} r={8} />
                  <text x={pos.x} y={pos.y + 3.5} textAnchor="middle">
                    {isDone ? '✓' : scc.order}
                  </text>
                  <text className="pa-scc__scc-label" x={pos.x + 14} y={pos.y + 4}>
                    {scc.label}
                  </text>
                </g>
              );
            })}

            {NODES.map(renderNode)}
          </svg>
        </div>

        <aside className="pa-scc__panel">
          <p className="pa-scc__phase">
            F{String(phase + 1).padStart(2, '0')} · {PHASE_LABELS[phase]}
          </p>
          <h4 className="pa-scc__panel-title">{copy.title}</h4>
          <p className="pa-scc__note">{copy.note}</p>

          <ol className="pa-scc__code" aria-label="内联器伪代码，高亮当前动作">
            {PSEUDO.map((line, index) => (
              <li key={line} className={PHASE_CODE[phase]?.includes(index) ? 'is-active' : ''}>
                <span className="pa-scc__code-no" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <code>{line}</code>
              </li>
            ))}
          </ol>

          <div className="pa-scc__threshold">
            <div className="pa-scc__threshold-head">
              <label htmlFor={sliderId}>
                内联阈值 <span className="pa-scc__threshold-value">{threshold}</span>
              </label>
              <span className="pa-scc__presets">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="pa-scc__preset"
                    aria-pressed={threshold === preset.value}
                    onClick={() => setThreshold(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </span>
            </div>
            <input
              id={sliderId}
              className="pa-scc__slider"
              type="range"
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              step={5}
              value={threshold}
              aria-describedby={sliderHintId}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
            <p className="pa-scc__hint" id={sliderHintId}>
              225 是 -O2 默认值。代价数字是教学示意；阈值不是单调旋钮：调高会让 callee 先吸收更多内联，caller 反而可能被拒绝。
            </p>
          </div>

          {candidates.length > 0 ? (
            <div className="pa-scc__candidates">
              {candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className={`pa-scc__candidate ${candidate.inline ? 'is-inline' : 'is-reject'}`}
                >
                  <div className="pa-scc__candidate-head">
                    <code>
                      {candidate.caller} → {candidate.callee}
                    </code>
                    <span className="pa-scc__badge">{candidate.inline ? '内联' : '拒绝'}</span>
                  </div>
                  <CostMeter cost={candidate.cost} threshold={threshold} inline={candidate.inline} />
                  <p className="pa-scc__why">{candidate.why}</p>
                </article>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <ol className="pa-scc__timeline" aria-label="跳到指定帧">
        {PHASE_LABELS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className="pa-scc__step"
              aria-current={index === phase ? 'step' : undefined}
              aria-label={`第 ${index + 1} 帧：${label}`}
              onClick={() => {
                setPlaying(false);
                goTo(index);
              }}
            >
              <span className="pa-scc__step-no">{String(index + 1).padStart(2, '0')}</span>
              <span className="pa-scc__step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <footer className="pa-scc__foot">
        <p>
          <kbd>←</kbd> <kbd>→</kbd> 单步 · <kbd>空格</kbd> 播放 · 拖动阈值改变判定
        </p>
        <p className="pa-scc__legend" aria-hidden="true">
          <span className="pa-scc__legend-dot" /> 当前 SCC
          <span className="pa-scc__legend-line" /> call edge
          <span className="pa-scc__legend-line pa-scc__legend-line--dash" /> SCC 回边
        </p>
      </footer>

      <p className="sr-only" role="status" aria-live="polite">
        第 {phase + 1} 帧：{copy.title}
      </p>
    </div>
  );
}
