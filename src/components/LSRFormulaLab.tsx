import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { defaultLocale, type Locale } from '../i18n/config';
import { lsrLabText, type LsrColumnText, type LsrLabText } from '../i18n/lab-lsr';
import './LSRFormulaLab.css';

const PHASE_MS = 4600;

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

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4v6h6" />
      <path d="M4.6 13a8 8 0 1 0 2.2-6.6L4 10" />
    </svg>
  );
}

function Meter({
  label,
  value,
  reached,
  text,
}: {
  label: string;
  value: number;
  reached: boolean;
  text: LsrLabText;
}) {
  return (
    <div className="pa-lsr__meter">
      <span className="pa-lsr__meter-label">{label}</span>
      <span
        className="pa-lsr__meter-track"
        role="img"
        aria-label={text.meterAria(label, value)}
        data-on={value > 0}
      >
        <span
          className="pa-lsr__meter-fill"
          style={{ width: reached ? `${Math.min(100, value * 100)}%` : '0%' }}
        />
      </span>
      <span className="pa-lsr__meter-value">{reached ? value : '—'}</span>
    </div>
  );
}

function Column({
  column,
  phase,
  text,
}: {
  column: LsrColumnText;
  phase: number;
  text: LsrLabText;
}) {
  return (
    <section className="pa-lsr__col" aria-label={column.badge}>
      <header className="pa-lsr__colhead">
        <span className="pa-lsr__badge">{column.badge}</span>
      </header>

      <div
        className={`pa-lsr__block pa-lsr__block--code${phase === 0 ? ' is-active' : ''}`}
        data-reached={phase >= 0}
      >
        <pre className="pa-lsr__code">
          <code>{column.code.join('\n')}</code>
        </pre>
      </div>

      <div
        className={`pa-lsr__block${phase === 1 ? ' is-active' : ''}`}
        data-reached={phase >= 1}
      >
        <h4 className="pa-lsr__block-title">{text.scevTitle}</h4>
        <p className="pa-lsr__scev">
          <code>{column.scev}</code>
        </p>
        <p className="pa-lsr__sub">{column.scevNote}</p>
      </div>

      <div
        className={`pa-lsr__block${phase === 2 ? ' is-active' : ''}`}
        data-reached={phase >= 2}
      >
        <h4 className="pa-lsr__block-title">{text.factorsTitle}</h4>
        <ul className="pa-lsr__factors">
          {column.factors.map((factor) => (
            <li className="pa-lsr__factor" key={factor.formula}>
              <div className="pa-lsr__factor-head">
                <code className="pa-lsr__formula">{factor.formula}</code>
                <span className={`pa-lsr__tag pa-lsr__tag--${factor.tone}`}>{factor.tag}</span>
              </div>
              <p className="pa-lsr__sub">{factor.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={`pa-lsr__block${phase === 3 ? ' is-active' : ''}`}
        data-reached={phase >= 3}
      >
        <h4 className="pa-lsr__block-title">{text.costTitle}</h4>
        <div className="pa-lsr__meters">
          <Meter
            label={text.newPhis}
            value={column.cost.phis}
            reached={phase >= 3}
            text={text}
          />
          <Meter
            label={text.newAdds}
            value={column.cost.adds}
            reached={phase >= 3}
            text={text}
          />
        </div>
        <p className="pa-lsr__sub">{column.cost.note}</p>
      </div>

      <div
        className={`pa-lsr__block${phase === 4 ? ' is-active' : ''}`}
        data-reached={phase >= 4}
      >
        <h4 className="pa-lsr__block-title">
          {text.resultTitle}
          <span className="pa-lsr__result-tag">{column.resultTag}</span>
        </h4>
        <pre className="pa-lsr__code pa-lsr__code--result">
          <code>
            {column.result.map((line, i) => (
              <span
                className="pa-lsr__irline"
                key={`${line}-${i}`}
                style={{ '--i': i } as CSSProperties}
              >
                {line}
                {i < column.result.length - 1 ? '\n' : null}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </section>
  );
}

export default function LSRFormulaLab({ locale = defaultLocale }: { locale?: Locale }) {
  const text = lsrLabText[locale];
  const total = text.phases.length;
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      setPhase(Math.min(Math.max(next, 0), total - 1));
    },
    [total],
  );

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing) return;
    if (phase >= total - 1) {
      setPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => setPhase((value) => value + 1), PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, phase, total]);

  const togglePlaying = () => {
    if (reducedMotion) return;
    setPlaying((value) => !value);
  };

  const restart = () => {
    setPlaying(false);
    setPhase(0);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.closest('button, a, input, select, textarea')) {
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
      togglePlaying();
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

  const progress = ((phase + 1) / total) * 100;

  return (
    <div
      className="pa-lsr"
      role="group"
      aria-label={text.groupAria}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-phase={phase}
      data-playing={playing ? 'true' : 'false'}
    >
      <div className="pa-lsr__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <header className="pa-lsr__head">
        <div className="pa-lsr__heading">
          <p className="pa-lsr__kicker">{text.kicker}</p>
          <h3 className="pa-lsr__title">{text.title}</h3>
        </div>
        <div className="pa-lsr__actions">
          <span className="pa-lsr__counter">{text.counter(phase + 1, total)}</span>
          <button
            type="button"
            className="pa-lsr__btn"
            onClick={() => {
              setPlaying(false);
              goTo(phase - 1);
            }}
            disabled={phase === 0}
            aria-label={text.prev}
            title={`${text.prev} (←)`}
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            className="pa-lsr__btn pa-lsr__btn--play"
            onClick={togglePlaying}
            disabled={reducedMotion}
            aria-label={playing ? text.pause : text.play}
            title={
              reducedMotion
                ? text.autoplayOffTitle
                : `${playing ? text.pause : text.play} (Space)`
            }
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="pa-lsr__btn"
            onClick={() => {
              setPlaying(false);
              goTo(phase + 1);
            }}
            disabled={phase === total - 1}
            aria-label={text.next}
            title={`${text.next} (→)`}
          >
            <NextIcon />
          </button>
          <button
            type="button"
            className="pa-lsr__btn pa-lsr__btn--reset"
            onClick={restart}
            aria-label={text.restart}
            title={text.restart}
          >
            <RestartIcon />
          </button>
        </div>
      </header>

      <p className="pa-lsr__lead">{text.lead}</p>

      {reducedMotion ? (
        <p className="pa-lsr__reduced" role="note">
          {text.autoplayOff}
        </p>
      ) : null}

      <div className="pa-lsr__grid">
        {text.columns.map((column) => (
          <Column column={column} phase={phase} text={text} key={column.badge} />
        ))}
      </div>

      <section className="pa-lsr__note" aria-live="polite">
        <span className="pa-lsr__note-no" aria-hidden="true">
          {String(phase + 1).padStart(2, '0')}
        </span>
        <div className="pa-lsr__note-body">
          <h4>{text.phases[phase].title}</h4>
          <p>{text.phases[phase].note}</p>
        </div>
      </section>

      <footer className="pa-lsr__foot">
        <ol className="pa-lsr__dots">
          {text.phases.map((item, i) => (
            <li key={item.title}>
              <button
                type="button"
                className="pa-lsr__dot"
                data-on={i === phase}
                aria-label={text.stepAria(i + 1, item.title)}
                aria-current={i === phase ? 'step' : undefined}
                onClick={() => {
                  setPlaying(false);
                  setPhase(i);
                }}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
        <p className="pa-lsr__footnote">{text.footnote}</p>
      </footer>
    </div>
  );
}
