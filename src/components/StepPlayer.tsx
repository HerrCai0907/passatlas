import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import type { Demo, DemoCursor, DemoStep, IRLine } from '../demos/types';
import { diffInstructions } from '../lib/ir/diff';
import type { InstructionDiff, InstructionMark } from '../lib/ir/diff';
import type { IRFormat } from '../lib/ir/format';
import { layoutCFG } from '../lib/ir/layout';
import type { CFGGraph } from '../lib/ir/layout';
import { canRenderCFG } from '../lib/ir/parse';
import { parseSource } from '../lib/ir/source';
import CFGCanvas from './CFGCanvas';
import IRFormatTag from './IRFormatTag';
import IRText from './IRText';
import ViewModeSwitch from './ViewModeSwitch';
import type { ViewMode } from './ViewModeSwitch';
import './StepPlayer.css';

interface StepPlayerProps {
  demo: Demo;
  /** 首页 hero 用的紧凑版：字号更小、不显示步进点 */
  compact?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  caption?: string;
  /** 默认展示模式；按产品约定默认是 CFG 图 */
  defaultMode?: ViewMode;
  /** 界面语言；演示标题与说明在传入前已由 getDemo() 本地化 */
  locale?: Locale;
}

const SPEEDS = [0.75, 1, 1.5, 2];

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

function toIR(lines: IRLine[]): string {
  return lines.map((line) => line.text).join('\n');
}

interface StepGraph {
  before: CFGGraph | null;
  after: CFGGraph | null;
  diff: InstructionDiff | null;
  /** 这一步的两侧 IR 是否包含多个函数；多函数时不能用 CFG 模式 */
  multiFunction: boolean;
}

/** 解析这一步的两侧 IR，并按指令文本做 diff；注释变化不会把整块染红染绿 */
function graphOfStep(step: DemoStep, locale: Locale, format: IRFormat): StepGraph {
  const beforeParsed = parseSource(toIR(step.before), format, locale);
  const afterParsed = parseSource(toIR(step.after), format, locale);
  const beforeFn = beforeParsed.functions[0] ?? null;
  const afterFn = afterParsed.functions[0] ?? null;
  const focus = [...step.before, ...step.after]
    .filter((line) => line.mark === 'focus')
    .map((line) => line.text);

  return {
    before: beforeFn ? layoutCFG(beforeFn) : null,
    after: afterFn ? layoutCFG(afterFn) : null,
    diff: beforeFn && afterFn ? diffInstructions(beforeFn, afterFn, focus) : null,
    multiFunction: !canRenderCFG(beforeParsed) || !canRenderCFG(afterParsed),
  };
}

function CFGPanel({
  label,
  side,
  graphs,
  index,
  marks,
  delta,
  locale,
  format,
}: {
  label: string;
  side: 'before' | 'after';
  locale: Locale;
  format: IRFormat;
  /** 这个面板在所有步骤里的图；用最大值预留高度，切步时尺寸保持不变 */
  graphs: ReadonlyArray<CFGGraph | null>;
  index: number;
  marks?: ReadonlyMap<string, InstructionMark>;
  delta?: { count: number; kind: 'add' | 'del' };
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const fit = () => setWidth(element.clientWidth);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 一次性算出所有步骤的缩放比例与画布高度：取其中最高的一步固定视口，
  // 这样即使某一步的指令更长、图更高，面板也不会把下方按钮顶下去。
  const layout = useMemo(() => {
    const available = width - 16;
    const scales = graphs.map((graph) => {
      if (!graph || available <= 0) return 1;
      return Math.min(1, Math.max(0.25, available / graph.width));
    });
    const height = graphs.reduce(
      (max, graph, i) => (graph ? Math.max(max, graph.height * (scales[i] ?? 1)) : max),
      0,
    );
    return { scales, height };
  }, [graphs, width]);

  const graph = graphs[index] ?? null;
  const scale = layout.scales[index] ?? 1;
  // 视口是 border-box，padding 为 10px；高度取画布最大值，绝不随步骤收缩。
  // width 为 0 时还没测量出真实宽度，交给 CSS 的 min-height，避免 SSR 用未缩放高度撑爆面板。
  const viewportHeight = width > 0 && layout.height > 0 ? layout.height + 20 : undefined;

  return (
    <section
      className="pa-cfg"
      aria-label={t(locale, side === 'before' ? 'player.cfgBefore' : 'player.cfgAfter')}
    >
      <header className="pa-cfg__head">
        <span className="pa-cfg__head-left">
          <span className="pa-cfg__label">{label}</span>
          <IRFormatTag format={format} locale={locale} />
        </span>
        <span className="pa-cfg__count">
          {graph ? t(locale, 'player.blocks', { count: graph.blocks.length }) : '—'}
          {delta && delta.count > 0 ? (
            <em
              className={`pa-cfg__delta pa-cfg__delta--${delta.kind}`}
              title={t(
                locale,
                delta.kind === 'add' ? 'player.deltaAddTitle' : 'player.deltaDelTitle',
                { count: delta.count },
              )}
            >
              {delta.kind === 'add' ? '+' : '−'}
              {delta.count}
            </em>
          ) : null}
        </span>
      </header>
      <div
        className="pa-cfg__viewport"
        ref={ref}
        style={viewportHeight ? { height: viewportHeight } : undefined}
      >
        {graph ? (
          <CFGCanvas
            graph={graph}
            scale={scale}
            interactive={false}
            marks={marks}
            locale={locale}
            format={format}
          />
        ) : (
          <p className="pa-cfg__empty">{t(locale, 'player.emptyCfg')}</p>
        )}
      </div>
    </section>
  );
}

function DiffLegend({ locale }: { locale: Locale }) {
  return (
    <p className="pa-diffkey">
      <span className="pa-diffkey__title">{t(locale, 'player.diffTitle')}</span>
      <span className="pa-diffkey__item pa-diffkey__item--add">
        <i aria-hidden="true" />
        {t(locale, 'player.diffAdd')}
      </span>
      <span className="pa-diffkey__item pa-diffkey__item--del">
        <i aria-hidden="true" />
        {t(locale, 'player.diffDel')}
      </span>
      <span className="pa-diffkey__item pa-diffkey__item--focus">
        <i aria-hidden="true" />
        {t(locale, 'player.diffFocus')}
      </span>
    </p>
  );
}

function IRPane({
  label,
  lines,
  stepIndex,
  side,
  locale,
  cursor,
  format,
}: {
  label: string;
  lines: IRLine[];
  stepIndex: number;
  side: 'before' | 'after';
  locale: Locale;
  cursor?: DemoCursor;
  format: IRFormat;
}) {
  const ariaKey =
    format === 'mir'
      ? side === 'before'
        ? 'player.mirBefore'
        : 'player.mirAfter'
      : side === 'before'
        ? 'player.irBefore'
        : 'player.irAfter';
  const cursorIndex = cursor?.side === side ? cursor.index : undefined;

  return (
    <section className="pa-pane" aria-label={t(locale, ariaKey)}>
      <header className="pa-pane__head">
        <span className="pa-pane__head-left">
          <span className="pa-pane__label">{label}</span>
          <IRFormatTag format={format} locale={locale} />
        </span>
      </header>
      {lines.length === 0 ? (
        <p className="pa-pane__empty">{t(locale, 'player.emptyIr')}</p>
      ) : (
        <ol className="pa-ir" key={stepIndex}>
          {lines.map((line, i) => {
            const isCursor = cursorIndex === i;
            return (
              <li
                key={`${line.text}-${i}`}
                className={`pa-line pa-line--${line.mark}${isCursor ? ' pa-line--cursor' : ''}`}
                style={{ '--i': i } as CSSProperties}
                aria-current={isCursor ? 'step' : undefined}
              >
                <span className="pa-line__cursor" aria-hidden="true" />
                <span className="pa-line__no" aria-hidden="true">
                  {i + 1}
                </span>
                <code className="pa-line__code">
                  {line.text === '' ? '\u00a0' : <IRText text={line.text} format={format} />}
                </code>
                {isCursor ? (
                  <span className="sr-only">{t(locale, 'player.currentInstruction')}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function StepPlayer({
  demo,
  compact = false,
  autoplay = false,
  loop = false,
  caption,
  defaultMode = 'cfg',
  locale = defaultLocale,
}: StepPlayerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const irViewportRef = useRef<HTMLDivElement | null>(null);

  const steps = demo.steps;
  const total = steps.length;
  const step = steps[index];
  const format = demo.format;

  const graphs = useMemo(
    () => steps.map((item) => graphOfStep(item, locale, format)),
    [steps, locale, format],
  );
  // CFG 一次只画一个函数。只要任一步的任一侧是多函数 IR，整个播放器就不能切到
  // CFG 模式：否则切步时会看到「只有第一个函数」的图，像是其他函数被优化掉了。
  // Machine IR 由 MIR 解析器切成机器基本块，和 LLVM IR 一样可以画 CFG。
  const cfgAvailable = useMemo(
    () => graphs.every((graph) => !graph.multiFunction),
    [graphs],
  );
  const shownMode: ViewMode = cfgAvailable ? mode : 'ir';
  const cfgDisabledReason = cfgAvailable
    ? undefined
    : t(locale, 'player.cfgUnavailable');
  const cfgSides = useMemo(
    () => ({
      before: graphs.map((graph) => graph.before),
      after: graphs.map((graph) => graph.after),
    }),
    [graphs],
  );

  useEffect(() => {
    if (!cfgAvailable) setMode('ir');
  }, [cfgAvailable]);

  // IR 视口有固定高度：切步后把 cursor 滚到可见位置。
  useEffect(() => {
    if (shownMode !== 'ir') return;
    const viewport = irViewportRef.current;
    if (!viewport) return;

    const frame = window.requestAnimationFrame(() => {
      const cursor = viewport.querySelector<HTMLElement>('.pa-line--cursor');
      if (!cursor) {
        viewport.scrollTop = 0;
        return;
      }

      const box = viewport.getBoundingClientRect();
      const line = cursor.getBoundingClientRect();
      // 顶部 34px 留给吸顶的 BEFORE / AFTER 面板头
      const safeTop = box.top + 34;
      if (line.top < safeTop) viewport.scrollTop -= safeTop - line.top;
      else if (line.bottom > box.bottom - 8) {
        viewport.scrollTop += line.bottom - box.bottom + 8;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [index, shownMode]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.min(Math.max(next, 0), total - 1));
    },
    [total],
  );

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing) return;

    const isLast = index + 1 >= total;
    if (isLast && !loop) {
      setPlaying(false);
      return;
    }

    const delay = 3800 / speed;
    const timer = window.setTimeout(() => {
      setIndex(isLast ? 0 : index + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [playing, index, speed, total, loop]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // 焦点在模式切换、步进按钮或下拉框上时，把键盘留给控件本身
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.closest('button, select, a, input, textarea')) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPlaying(false);
      goTo(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaying(false);
      goTo(index - 1);
    } else if (event.key === ' ') {
      event.preventDefault();
      setPlaying((value) => !value);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPlaying(false);
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPlaying(false);
      goTo(total - 1);
    }
  };

  const progress = ((index + 1) / total) * 100;
  const current = graphs[index];
  const stateLines = step.state ?? [];
  const hasState = demo.stateMaxLines > 0;

  return (
    <div
      className={`pa-player${compact ? ' pa-player--compact' : ''}`}
      data-playing={playing ? 'true' : 'false'}
      data-mode={shownMode}
      role="group"
      aria-label={t(locale, 'player.group', { name: demo.label })}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="pa-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <header className="pa-head">
        <span className="pa-head__id">
          <span className="pa-head__dot" aria-hidden="true" />
          {demo.label}
          {caption ? <em className="pa-head__caption">{caption}</em> : null}
        </span>
        <span className="pa-head__right">
          <ViewModeSwitch
            value={shownMode}
            onChange={setMode}
            locale={locale}
            label={t(locale, 'player.mode')}
            cfgDisabledReason={cfgDisabledReason}
          />
          <span className="pa-head__counter">
            <strong>{String(index + 1).padStart(2, '0')}</strong>
            <span aria-hidden="true"> / </span>
            {String(total).padStart(2, '0')}
          </span>
        </span>
      </header>

      {cfgAvailable ? null : (
        <p className="pa-mode-note" role="note">
          {cfgDisabledReason}
        </p>
      )}

      <p className="pa-title">
        <span className="pa-title__text">{step.title}</span>
        <span className="pa-title__ghost" aria-hidden="true">
          {steps.map((item, i) => (
            <span key={i}>{item.title}</span>
          ))}
        </span>
      </p>

      {hasState ? (
        <section
          className="pa-state"
          aria-label={t(locale, 'player.algorithmState')}
          style={{ '--pa-state-lines': demo.stateMaxLines } as CSSProperties}
        >
          <header className="pa-state__head">
            <span className="pa-state__label">{t(locale, 'player.algorithmState')}</span>
          </header>
          {stateLines.length > 0 ? (
            <ol className="pa-state__list" key={index}>
              {stateLines.map((line, i) => (
                <li
                  key={`${line.text}-${i}`}
                  className={`pa-state__line pa-state__line--${line.mark}`}
                  style={{ '--i': i } as CSSProperties}
                >
                  <span className="pa-state__no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <code>{line.text === '' ? '\u00a0' : line.text}</code>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pa-state__empty">{t(locale, 'player.emptyState')}</p>
          )}
        </section>
      ) : null}

      <div className="pa-note">
        <p className="pa-note__live" aria-live="polite">
          {step.note}
        </p>
        <span className="pa-note__ghost" aria-hidden="true">
          {steps.map((item, i) => (
            <span key={i}>{item.note}</span>
          ))}
        </span>
      </div>

      {shownMode === 'cfg' ? (
        <>
          <DiffLegend locale={locale} />
          <div className="pa-panes pa-panes--cfg">
            <CFGPanel
              label="before"
              side="before"
              graphs={cfgSides.before}
              index={index}
              marks={current?.diff?.before}
              delta={{ count: current?.diff?.removed ?? 0, kind: 'del' }}
              locale={locale}
              format={format}
            />
            <CFGPanel
              label="after"
              side="after"
              graphs={cfgSides.after}
              index={index}
              marks={current?.diff?.after}
              delta={{ count: current?.diff?.added ?? 0, kind: 'add' }}
              locale={locale}
              format={format}
            />
          </div>
        </>
      ) : (
        <div
          className="pa-ir-viewport"
          ref={irViewportRef}
          role="region"
          aria-label={t(locale, 'player.irRegion')}
          tabIndex={0}
        >
          <div
            className="pa-panes pa-panes--ir"
            style={{ '--pa-ir-lines': demo.maxLines } as CSSProperties}
          >
            <IRPane
              label="before"
              side="before"
              lines={step.before}
              stepIndex={index}
              locale={locale}
              cursor={step.cursor}
              format={format}
            />
            <IRPane
              label="after"
              side="after"
              lines={step.after}
              stepIndex={index}
              locale={locale}
              cursor={step.cursor}
              format={format}
            />
          </div>
        </div>
      )}

      <div className="pa-controls">
        <button
          type="button"
          className="pa-btn"
          onClick={() => {
            setPlaying(false);
            goTo(0);
          }}
          aria-label={t(locale, 'player.first')}
          title={t(locale, 'player.first')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 5v14M19 6l-9 6 9 6z" />
          </svg>
        </button>
        <button
          type="button"
          className="pa-btn"
          onClick={() => {
            setPlaying(false);
            goTo(index - 1);
          }}
          disabled={index === 0}
          aria-label={t(locale, 'player.prev')}
          title={t(locale, 'player.prevTitle')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          className="pa-btn pa-btn--play"
          onClick={() => setPlaying((value) => !value)}
          aria-label={t(locale, playing ? 'player.pause' : 'player.play')}
          title={t(locale, playing ? 'player.pauseTitle' : 'player.playTitle')}
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
          className="pa-btn"
          onClick={() => {
            setPlaying(false);
            goTo(index + 1);
          }}
          disabled={index === total - 1}
          aria-label={t(locale, 'player.next')}
          title={t(locale, 'player.nextTitle')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <ol className="pa-steps" aria-label={t(locale, 'player.steps')}>
          {steps.map((item, i) => (
            <li key={item.title}>
              <button
                type="button"
                className="pa-step"
                aria-label={t(locale, 'player.step', { n: i + 1, title: item.title })}
                aria-current={i === index ? 'step' : undefined}
                onClick={() => {
                  setPlaying(false);
                  goTo(i);
                }}
              />
            </li>
          ))}
        </ol>

        <label className="pa-speed">
          <span className="sr-only">{t(locale, 'player.speed')}</span>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
