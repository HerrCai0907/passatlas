import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { defaultLocale, type Locale } from '../i18n/config';
import {
  sampleProfileLabText,
  type CandidateId,
  type SampleProfileDecisions,
} from '../i18n/lab-sample-profile';
import './SampleProfileInlinerLab.css';

type Status = 'hidden' | 'pending' | 'current' | 'fresh' | 'inlined' | 'skipped';

interface CandidateDef {
  id: CandidateId;
  caller: string;
  callee: string;
  count: number;
  cost: number;
  context: string;
  depth: number;
}

const HOT_LIMIT = 3000;
const COLD_LIMIT_MIN = 0;
const COLD_LIMIT_MAX = 100;
const COLD_LIMIT_DEFAULT = 45;
const BAZ_COST = 60;
const MAIN_INSTRUCTIONS = 4;
const INLINE_BUDGET = Math.max(100, Math.min(10000, MAIN_INSTRUCTIONS * 12));

/** 按样本数从大到小，就是优先队列的出队顺序；bar 要等 foo 展开后才暴露。 */
const CANDIDATES: CandidateDef[] = [
  { id: 'foo', caller: '@main', callee: '@foo', count: 98000, cost: 120, context: 'main', depth: 1 },
  { id: 'bar', caller: '@foo', callee: '@bar', count: 95000, cost: 90, context: 'main:foo', depth: 2 },
  { id: 'baz', caller: '@main', callee: '@baz', count: 40, cost: 60, context: 'main', depth: 1 },
];

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

function meterStyle(cost: number, limit: number): { fill: CSSProperties; mark: CSSProperties } {
  const max = Math.max(cost, limit, 1) * 1.25;
  return {
    fill: { width: `${Math.min(100, (cost / max) * 100)}%` },
    mark: { left: `${Math.min(97, (limit / max) * 100)}%` },
  };
}

export default function SampleProfileInlinerLab({ locale = defaultLocale }: { locale?: Locale }) {
  const text = sampleProfileLabText[locale];
  const uid = useId().replace(/:/g, '');
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [coldLimit, setColdLimit] = useState(COLD_LIMIT_DEFAULT);
  const [sizeInline, setSizeInline] = useState(true);
  const reducedMotion = usePrefersReducedMotion();

  const sliderId = `${uid}-cold`;
  const sliderHintId = `${uid}-cold-hint`;
  const toggleId = `${uid}-size`;
  const toggleHintId = `${uid}-size-hint`;

  const decisions = useMemo<SampleProfileDecisions>(
    () => ({ coldLimit, sizeInline, inlineBaz: sizeInline && BAZ_COST <= coldLimit }),
    [coldLimit, sizeInline],
  );

  const lastPhase = text.phaseLabels.length - 1;

  const goTo = useCallback(
    (next: number) => setPhase(Math.max(0, Math.min(lastPhase, next))),
    [lastPhase],
  );

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    if (phase >= lastPhase) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setPhase((value) => Math.min(lastPhase, value + 1)), 5200);
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

  const currentId: CandidateId | null =
    phase === 0 ? 'foo' : phase === 1 ? 'bar' : phase === 2 || phase === 3 ? 'baz' : null;

  const statusOf = (id: CandidateId): Status => {
    if (id === 'foo') return phase === 0 ? 'current' : 'inlined';
    if (id === 'bar') return phase === 0 ? 'hidden' : phase === 1 ? 'fresh' : 'inlined';
    if (phase <= 1) return 'pending';
    if (phase === 2) return 'current';
    return decisions.inlineBaz ? 'inlined' : 'skipped';
  };

  const statusLabel: Record<Status, string> = {
    hidden: text.statusHidden,
    pending: text.statusPending,
    current: text.statusCurrent,
    fresh: text.statusFresh,
    inlined: text.statusInlined,
    skipped: text.statusSkipped,
  };

  const stackRows = useMemo(() => {
    const rows = [{ label: '@main', count: 100000, context: '', depth: 0 }];
    if (phase >= 1) rows.push({ label: '@foo', count: 98000, context: 'main', depth: 1 });
    if (phase >= 2) rows.push({ label: '@bar', count: 95000, context: 'main:foo', depth: 2 });
    if (phase >= 3 && decisions.inlineBaz) {
      rows.push({ label: '@baz', count: 40, context: 'main', depth: 1 });
    }
    return rows;
  }, [phase, decisions.inlineBaz]);

  const copy = text.copy(phase, decisions);
  const current = currentId ? CANDIDATES.find((item) => item.id === currentId) : undefined;
  const currentLimit = current?.id === 'baz' ? coldLimit : HOT_LIMIT;
  const meterOk = current ? current.cost <= currentLimit : false;
  const currentInline = current ? (current.id === 'baz' ? decisions.inlineBaz : true) : false;
  const currentDecided =
    currentId === 'foo' ? phase >= 1 : currentId === 'bar' ? phase >= 2 : phase >= 3;
  /** 判定完成后以真实决策为准：关掉 size inline 时，冷调用点即使 cost 够低也照样拒绝。 */
  const currentOk = currentDecided ? currentInline : meterOk;

  const phases = text.phaseLabels;
  const progress = ((phase + 1) / phases.length) * 100;

  return (
    <div
      className="pa-sp"
      role="group"
      aria-label={text.labAria}
      tabIndex={0}
      data-playing={playing ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
    >
      <header className="pa-sp__head">
        <div className="pa-sp__heading">
          <p className="pa-sp__kicker">{text.kicker}</p>
          <h3 className="pa-sp__title">{text.title}</h3>
        </div>
        <div className="pa-sp__actions">
          <button
            type="button"
            className="pa-sp__btn"
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
            className="pa-sp__btn pa-sp__btn--play"
            onClick={() => {
              if (reducedMotion) return;
              setPlaying((value) => !value);
            }}
            disabled={reducedMotion}
            aria-label={reducedMotion ? text.autoplayOff : playing ? text.pause : text.play}
            title={
              reducedMotion ? text.autoplayOffTitle : playing ? text.pauseTitle : text.playTitle
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
            className="pa-sp__btn"
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
          <span className="pa-sp__counter">
            <strong>{String(phase + 1).padStart(2, '0')}</strong>
            <span aria-hidden="true"> / </span>
            {String(phases.length).padStart(2, '0')}
          </span>
        </div>
      </header>

      <div className="pa-sp__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="pa-sp__main">
        <div className="pa-sp__left">
          <section className="pa-sp__block" aria-labelledby={`${uid}-stack-title`}>
            <div className="pa-sp__block-head">
              <h4 className="pa-sp__block-title" id={`${uid}-stack-title`}>
                {text.stackTitle}
              </h4>
            </div>
            <ol className="pa-sp__stack" aria-label={text.stackAria}>
              {stackRows.map((row) => (
                <li
                  key={row.label}
                  className="pa-sp__frame"
                  style={{ '--sp-depth': row.depth } as CSSProperties}
                >
                  <span className="pa-sp__frame-name">{row.label}</span>
                  <span className="pa-sp__frame-count">{text.sampleCount(row.count)}</span>
                  <span className="pa-sp__frame-context">
                    {row.context ? text.contextLabel(row.context) : text.topLevel}
                  </span>
                </li>
              ))}
            </ol>
            <p className="pa-sp__block-note">{text.stackNote}</p>
          </section>

          <section className="pa-sp__block" aria-labelledby={`${uid}-queue-title`}>
            <div className="pa-sp__block-head">
              <h4 className="pa-sp__block-title" id={`${uid}-queue-title`}>
                {text.queueTitle}
              </h4>
            </div>
            <ol className="pa-sp__queue" aria-label={text.queueAria}>
              {CANDIDATES.map((candidate, index) => {
                const status = statusOf(candidate.id);
                const isCurrent = currentId === candidate.id;
                const isCold = candidate.id === 'baz';
                const classes = [
                  'pa-sp__candidate',
                  `is-${status}`,
                  isCurrent ? 'is-current' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li
                    key={candidate.id}
                    className={classes}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={text.candidateAria(
                      candidate.caller,
                      candidate.callee,
                      candidate.count,
                      statusLabel[status],
                    )}
                  >
                    <span className="pa-sp__rank" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="pa-sp__cand-main">
                      <code className="pa-sp__cand-name">
                        {candidate.caller} → {candidate.callee}
                      </code>
                      <span className="pa-sp__cand-meta">
                        {text.sampleCount(candidate.count)} · {text.contextLabel(candidate.context)}
                      </span>
                    </span>
                    <span className="pa-sp__tags">
                      <span className={`pa-sp__tag pa-sp__tag--${isCold ? 'cold' : 'hot'}`}>
                        {isCold ? text.cold : text.hot}
                      </span>
                      <span className="pa-sp__tag pa-sp__tag--status">{statusLabel[status]}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="pa-sp__panel">
          <p className="pa-sp__phase">
            F{String(phase + 1).padStart(2, '0')} · {phases[phase]}
          </p>
          <h4 className="pa-sp__panel-title">{copy.title}</h4>
          <p className="pa-sp__note">{copy.note}</p>

          {current ? (
            <div className="pa-sp__decision" aria-label={text.decisionAria}>
              <div className="pa-sp__decision-head">
                <span className="pa-sp__decision-kicker">{text.decisionTitle}</span>
                <span
                  className={`pa-sp__verdict ${
                    currentDecided
                      ? currentOk
                        ? 'is-good'
                        : 'is-bad'
                      : 'is-wait'
                  }`}
                >
                  {currentDecided
                    ? currentOk
                      ? text.statusInlined
                      : text.statusSkipped
                    : text.statusDeciding}
                </span>
              </div>
              <code className="pa-sp__decision-name">
                {current.caller} → {current.callee}
              </code>
              <div
                className="pa-sp__meter"
                role="img"
                aria-label={text.meterAria(current.cost, currentLimit, currentOk)}
              >
                <div className="pa-sp__meter-track">
                  <span
                    className={`pa-sp__meter-fill${currentOk ? '' : ' pa-sp__meter-fill--bad'}`}
                    style={meterStyle(current.cost, currentLimit).fill}
                  />
                  <span
                    className="pa-sp__meter-mark"
                    style={meterStyle(current.cost, currentLimit).mark}
                    aria-hidden="true"
                  />
                </div>
                <div className="pa-sp__meter-labels">
                  <span>{text.costLabel(current.cost)}</span>
                  <span>{text.limitLabel(currentLimit)}</span>
                </div>
              </div>
              <p className="pa-sp__reason">{text.reason(current.id, decisions)}</p>
            </div>
          ) : (
            <div className="pa-sp__summary" aria-label={text.summaryAria}>
              <p className="pa-sp__decision-kicker">{text.summaryTitle}</p>
              <ul className="pa-sp__summary-list">
                {CANDIDATES.map((candidate) => {
                  const inlined =
                    candidate.id === 'baz' ? decisions.inlineBaz : true;
                  return (
                    <li key={candidate.id} className={inlined ? 'is-good' : 'is-bad'}>
                      <code>
                        {candidate.caller} → {candidate.callee}
                      </code>
                      <span>{inlined ? text.summaryInlined : text.summarySkipped}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="pa-sp__summary-stat">
                {text.summaryStat(MAIN_INSTRUCTIONS + 2 + (decisions.inlineBaz ? 1 : 0), INLINE_BUDGET)}
              </p>
            </div>
          )}

          <div className="pa-sp__controls">
            <div className="pa-sp__control">
              <div className="pa-sp__control-head">
                <label htmlFor={sliderId}>
                  {text.coldLabel} <span className="pa-sp__control-value">{coldLimit}</span>
                </label>
              </div>
              <input
                id={sliderId}
                className="pa-sp__slider"
                type="range"
                min={COLD_LIMIT_MIN}
                max={COLD_LIMIT_MAX}
                step={5}
                value={coldLimit}
                aria-describedby={sliderHintId}
                onChange={(event) => setColdLimit(Number(event.target.value))}
              />
              <p className="pa-sp__hint" id={sliderHintId}>
                {text.coldHint}
              </p>
            </div>

            <div className="pa-sp__control pa-sp__control--switch">
              <input
                id={toggleId}
                type="checkbox"
                className="pa-sp__checkbox"
                checked={sizeInline}
                aria-describedby={toggleHintId}
                onChange={(event) => setSizeInline(event.target.checked)}
              />
              <div>
                <label htmlFor={toggleId}>{text.sizeLabel}</label>
                <p className="pa-sp__hint" id={toggleHintId}>
                  {text.sizeHint}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ol className="pa-sp__timeline" aria-label={text.timelineAria}>
        {phases.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className="pa-sp__step"
              aria-current={index === phase ? 'step' : undefined}
              aria-label={text.timelineStep(index + 1, label)}
              onClick={() => {
                setPlaying(false);
                goTo(index);
              }}
            >
              <span className="pa-sp__step-no">{String(index + 1).padStart(2, '0')}</span>
              <span className="pa-sp__step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <footer className="pa-sp__foot">
        <p>
          <kbd>←</kbd> <kbd>→</kbd> {text.footerStep} · <kbd>{text.spaceKey}</kbd>{' '}
          {text.footerPlay} · {text.footerThreshold}
        </p>
        <p className="pa-sp__foot-note">{text.footerNote}</p>
      </footer>

      <p className="sr-only" role="status" aria-live="polite">
        {text.status(phase + 1, copy.title)}
      </p>
    </div>
  );
}
