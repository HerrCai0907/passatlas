import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { defaultLocale, type Locale } from '../i18n/config';
import { sccLabText } from '../i18n/lab-scc';
import './SCCInlinerLab.css';

type SccId = 'clamp' | 'hashmix' | 'render' | 'main';
type NodeId = 'main' | 'render' | 'hash' | 'mix' | 'clamp';

interface NodeDef {
  id: NodeId;
  label: string;
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
  { id: 'main', label: '@main', scc: 'main', x: 260, y: 48 },
  { id: 'render', label: '@render', scc: 'render', x: 260, y: 142 },
  { id: 'hash', label: '@hash', scc: 'hashmix', x: 112, y: 252 },
  { id: 'mix', label: '@mix', scc: 'hashmix', x: 340, y: 252 },
  { id: 'clamp', label: '@clamp', scc: 'clamp', x: 438, y: 354 },
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
  '    accept(call)',
  '    worklist += newly_exposed_calls(call)',
  '    refresh_cost_context()',
  '  summary = current_scc_decisions()',
];

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

function CostMeter({
  cost,
  threshold,
  inline,
  locale,
}: {
  cost: number;
  threshold: number;
  inline: boolean;
  locale: Locale;
}) {
  return (
    <div
      className="pa-scc__meter"
      role="img"
      aria-label={sccLabText[locale].meterAria(cost, threshold, inline)}
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

export default function SCCInlinerLab({ locale = defaultLocale }: { locale?: Locale }) {
  const text = sccLabText[locale];
  const uid = useId().replace(/:/g, '');
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const reducedMotion = usePrefersReducedMotion();
  const sliderId = `${uid}-threshold`;
  const sliderHintId = `${uid}-threshold-hint`;

  const decisions = useMemo(() => computeDecisions(threshold), [threshold]);
  const lastPhase = text.phaseLabels.length - 1;

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

  const candidates = useMemo(
    () => text.candidates(phase, decisions, threshold),
    [text, phase, decisions, threshold],
  );

  const copy = useMemo(
    () => text.copy(phase, decisions, threshold),
    [text, phase, decisions, threshold],
  );

  const handleNodeKey = (event: ReactKeyboardEvent<SVGGElement>, targetPhase: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      setPlaying(false);
      goTo(targetPhase);
    }
  };

  const renderNode = (node: NodeDef) => {
    const isActive = activeScc === node.scc && phase >= 3;
    const isDone = processed.includes(node.scc);
    const classes = ['pa-scc__node', isActive ? 'is-active' : '', isDone ? 'is-done' : '']
      .filter(Boolean)
      .join(' ');
    const targetPhase = SCCS.find((scc) => scc.id === node.scc)?.phase ?? 0;
    const sub = text.nodeSub[node.id];

    return (
      <g
        key={node.id}
        className={classes}
        role="button"
        tabIndex={0}
        aria-label={text.nodeAria(node.label, sub, targetPhase + 1)}
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
          {sub}
        </text>
      </g>
    );
  };

  const edgeClass = (active: boolean, back = false) =>
    ['pa-scc__edge', active ? 'is-active' : '', back ? 'is-back' : ''].filter(Boolean).join(' ');

  return (
    <div
      className="pa-scc"
      role="group"
      aria-label={text.labAria}
      tabIndex={0}
      data-playing={playing ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
    >
      <header className="pa-scc__head">
        <div className="pa-scc__heading">
          <p className="pa-scc__kicker">{text.kicker}</p>
          <h3 className="pa-scc__title">{text.title}</h3>
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
            aria-label={text.previousFrame}
            title={text.previousFrameTitle}
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
              reducedMotion
                ? text.autoplayOff
                : playing
                  ? text.pause
                  : text.play
            }
            title={
              reducedMotion
                ? text.autoplayOffTitle
                : playing
                  ? text.pauseTitle
                  : text.playTitle
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
            aria-label={text.nextFrame}
            title={text.nextFrameTitle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="pa-scc__counter">
            <strong>{String(phase + 1).padStart(2, '0')}</strong>
            <span aria-hidden="true"> / </span>
            {String(text.phaseLabels.length).padStart(2, '0')}
          </span>
        </div>
      </header>

      <div className="pa-scc__progress" aria-hidden="true">
        <span style={{ width: `${((phase + 1) / text.phaseLabels.length) * 100}%` }} />
      </div>

      <div className="pa-scc__main">
        <div className="pa-scc__graph">
          <svg
            className="pa-scc__svg"
            viewBox="0 0 520 410"
            role="group"
            aria-label={text.graphAria(phase + 1, copy.title)}
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
              {text.sccBoxLabel}
            </text>

            <g className={edgeClass(phase === 6, false)}>
              <path
                className="pa-scc__edge-line"
                d="M260 72 L260 118"
                markerEnd={`url(#${uid}-${phase === 6 ? 'arrow-active' : 'arrow'})`}
              />
            </g>

            <g className={edgeClass(phase === 5, false)}>
              <path
                className="pa-scc__edge-line"
                d="M222 166 L130 228"
                markerEnd={`url(#${uid}-${phase === 5 ? 'arrow-active' : 'arrow'})`}
              />
            </g>

            <g className={edgeClass(phase === 5, false)}>
              <path
                className="pa-scc__edge-line"
                d="M304 166 C 420 190, 480 260, 438 330"
                markerEnd={`url(#${uid}-${phase === 5 ? 'arrow-active' : 'arrow'})`}
              />
            </g>

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

            {phase >= 3 ? (
              <>
                <text className="pa-scc__edge-cost" x={270} y={99}>
                  {decisions.mainCost}
                </text>
                <text className="pa-scc__edge-cost" x={176} y={202}>
                  {decisions.renderHashCost}
                </text>
                <text className="pa-scc__edge-cost" x={424} y={254}>
                  30
                </text>
                <text className="pa-scc__edge-cost" x={226} y={245}>
                  240
                </text>
              </>
            ) : null}

            {SCCS.map((scc) => {
              const pos = SCC_TAG_POS[scc.id];
              const isActive = activeScc === scc.id;
              const isDone = processed.includes(scc.id);
              const orderClass = ['pa-scc__order', isActive ? 'is-active' : '', isDone ? 'is-done' : '']
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
            F{String(phase + 1).padStart(2, '0')} · {text.phaseLabels[phase]}
          </p>
          <h4 className="pa-scc__panel-title">{copy.title}</h4>
          <p className="pa-scc__note">{copy.note}</p>

          <ol className="pa-scc__code" aria-label={text.pseudoAria}>
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
                {text.thresholdLabel} <span className="pa-scc__threshold-value">{threshold}</span>
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
              {text.thresholdHint}
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
                    <span className="pa-scc__badge">{candidate.inline ? text.inline : text.reject}</span>
                  </div>
                  <CostMeter
                    cost={candidate.cost}
                    threshold={threshold}
                    inline={candidate.inline}
                    locale={locale}
                  />
                  <p className="pa-scc__why">{candidate.why}</p>
                </article>
              ))}
            </div>
          ) : null}

          {phase === 7 ? (
            <ul className="pa-scc__summary" aria-label={text.summaryAria}>
              <li className={decisions.inlineHashMix ? 'is-inline' : 'is-reject'}>
                <code>hash ↔ mix</code>
                <span>{decisions.inlineHashMix ? text.inlineOneLayer : text.keep}</span>
              </li>
              <li className={decisions.inlineClamp ? 'is-inline' : 'is-reject'}>
                <code>render → clamp</code>
                <span>{decisions.inlineClamp ? text.inline : text.keep}</span>
              </li>
              <li className={decisions.inlineRenderHash ? 'is-inline' : 'is-reject'}>
                <code>render → hash</code>
                <span>{decisions.inlineRenderHash ? text.inline : text.keep}</span>
              </li>
              <li className={decisions.inlineMain ? 'is-inline' : 'is-reject'}>
                <code>main → render</code>
                <span>{decisions.inlineMain ? text.inline : text.keep}</span>
              </li>
            </ul>
          ) : null}
        </aside>
      </div>

      <ol className="pa-scc__timeline" aria-label={text.timelineAria}>
        {text.phaseLabels.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className="pa-scc__step"
              aria-current={index === phase ? 'step' : undefined}
              aria-label={text.timelineStep(index + 1, label)}
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
          <kbd>←</kbd> <kbd>→</kbd> {text.footerStep} · <kbd>{text.spaceKey}</kbd>{' '}
          {text.footerPlay} · {text.footerThreshold}
        </p>
        <p className="pa-scc__foot-note">{text.footerNote}</p>
        <p className="pa-scc__legend" aria-hidden="true">
          <span className="pa-scc__legend-dot" /> {text.legendCurrentScc}
          <span className="pa-scc__legend-line" /> {text.legendCallEdge}
          <span className="pa-scc__legend-line pa-scc__legend-line--dash" /> {text.legendBackEdge}
        </p>
      </footer>

      <p className="sr-only" role="status" aria-live="polite">
        {text.status(phase + 1, copy.title)}
      </p>
    </div>
  );
}
