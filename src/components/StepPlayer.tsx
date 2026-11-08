import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { Demo, IRLine } from '../demos/types';
import { layoutCFG } from '../lib/ir/layout';
import type { CFGGraph } from '../lib/ir/layout';
import { parseIR } from '../lib/ir/parse';
import CFGCanvas from './CFGCanvas';
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

function graphOf(ir: string): CFGGraph | null {
  const fn = parseIR(ir).functions[0];
  return fn ? layoutCFG(fn) : null;
}

function CFGPanel({
  label,
  side,
  graph,
}: {
  label: string;
  side: 'before' | 'after';
  graph: CFGGraph | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element || !graph) return;

    const fit = () => {
      const available = element.clientWidth - 16;
      if (available <= 0) return;
      setScale(Math.min(1, Math.max(0.25, available / graph.width)));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [graph]);

  return (
    <section
      className="pa-cfg"
      aria-label={side === 'before' ? '改写前的控制流图' : '改写后的控制流图'}
    >
      <header className="pa-cfg__head">
        <span className="pa-cfg__label">{label}</span>
        <span className="pa-cfg__count">{graph ? `${graph.blocks.length} 块` : '—'}</span>
      </header>
      <div className="pa-cfg__viewport" ref={ref}>
        {graph ? (
          <CFGCanvas graph={graph} scale={scale} interactive={false} />
        ) : (
          <p className="pa-cfg__empty">无法解析为基本块</p>
        )}
      </div>
    </section>
  );
}

function IRPane({
  label,
  lines,
  stepIndex,
  side,
}: {
  label: string;
  lines: IRLine[];
  stepIndex: number;
  side: 'before' | 'after';
}) {
  return (
    <section className="pa-pane" aria-label={side === 'before' ? '改写前的 IR' : '改写后的 IR'}>
      <header className="pa-pane__head">
        <span className="pa-pane__label">{label}</span>
        <span className="pa-pane__count">{lines.length} 行</span>
      </header>
      {lines.length === 0 ? (
        <p className="pa-pane__empty">（无指令）</p>
      ) : (
        <ol className="pa-ir" key={stepIndex}>
          {lines.map((line, i) => (
            <li
              key={`${line.text}-${i}`}
              className={`pa-line pa-line--${line.mark}`}
              style={{ '--i': i } as CSSProperties}
            >
              <span className="pa-line__no" aria-hidden="true">
                {i + 1}
              </span>
              <code className="pa-line__code">{line.text === '' ? '\u00a0' : line.text}</code>
            </li>
          ))}
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
}: StepPlayerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(1);

  const steps = demo.steps;
  const total = steps.length;
  const step = steps[index];

  const graphs = useMemo(
    () =>
      steps.map((item) => ({
        before: graphOf(toIR(item.before)),
        after: graphOf(toIR(item.after)),
      })),
    [steps],
  );

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

  return (
    <div
      className={`pa-player${compact ? ' pa-player--compact' : ''}`}
      data-playing={playing ? 'true' : 'false'}
      data-mode={mode}
      role="group"
      aria-label={`${demo.label} 分步演示`}
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
          <ViewModeSwitch value={mode} onChange={setMode} tone="dark" label="分步演示的展示模式" />
          <span className="pa-head__counter">
            <strong>{String(index + 1).padStart(2, '0')}</strong>
            <span aria-hidden="true"> / </span>
            {String(total).padStart(2, '0')}
          </span>
        </span>
      </header>

      <p className="pa-title">{step.title}</p>

      {mode === 'cfg' ? (
        <div className="pa-panes pa-panes--cfg">
          <CFGPanel label="before" side="before" graph={current?.before ?? null} />
          <CFGPanel label="after" side="after" graph={current?.after ?? null} />
        </div>
      ) : (
        <div className="pa-panes">
          <IRPane label="before" side="before" lines={step.before} stepIndex={index} />
          <IRPane label="after" side="after" lines={step.after} stepIndex={index} />
        </div>
      )}

      <p className="pa-note" aria-live="polite">
        {step.note}
      </p>

      <div className="pa-controls">
        <button
          type="button"
          className="pa-btn"
          onClick={() => {
            setPlaying(false);
            goTo(0);
          }}
          aria-label="回到第一步"
          title="回到第一步"
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
          aria-label="上一步"
          title="上一步（←）"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          className="pa-btn pa-btn--play"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? '暂停' : '自动播放'}
          title={playing ? '暂停（空格）' : '自动播放（空格）'}
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
          aria-label="下一步"
          title="下一步（→）"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <ol className="pa-steps" aria-label="跳到指定步骤">
          {steps.map((item, i) => (
            <li key={item.title}>
              <button
                type="button"
                className="pa-step"
                aria-label={`第 ${i + 1} 步：${item.title}`}
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
          <span className="sr-only">播放速度</span>
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
