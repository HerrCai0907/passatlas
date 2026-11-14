import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import type { IRFormat } from '../lib/ir/format';
import { layoutCFG } from '../lib/ir/layout';
import { prefersIRView } from '../lib/ir/mode';
import { functionToIR } from '../lib/ir/parse';
import type { IRFunction } from '../lib/ir/parse';
import { parseSource } from '../lib/ir/source';
import { isMIRTerminator, mirOpcode } from '../lib/mir/opcodes';
import CFGCanvas from './CFGCanvas';
import IRFormatTag from './IRFormatTag';
import IRText from './IRText';
import ViewModeSwitch from './ViewModeSwitch';
import type { ViewMode } from './ViewModeSwitch';
import './CFGViewer.css';

export interface CFGViewerProps {
  /** IR 源文本；格式由 `format` 指定，可以包含多个函数 */
  ir: string;
  /** 这一段是 LLVM IR 还是 Machine IR；决定解析器、行分类与高亮方案 */
  format?: IRFormat;
  title?: string;
  /** 视口最大高度，超出后内部滚动 */
  height?: number;
  collapsedByDefault?: boolean;
  /** 多基本块时的默认展示模式；单基本块始终默认 IR 文本 */
  defaultMode?: ViewMode;
  locale?: Locale;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.5;

type IRRow = { text: string; kind: 'header' | 'label' | 'ins' | 'term' | 'brace' | 'meta' };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildRows(fn: IRFunction): IRRow[] {
  const rows: IRRow[] = [{ text: fn.header, kind: 'header' }];
  for (const block of fn.blocks) {
    rows.push({ text: `${block.label}:`, kind: 'label' });
    for (const instruction of block.instructions) {
      const kind = instruction.terminator ? 'term' : 'ins';
      const [first, ...rest] = instruction.text.split('\n');
      rows.push({ text: `  ${first ?? ''}`, kind });
      for (const line of rest) rows.push({ text: `  ${line}`, kind });
    }
  }
  rows.push({ text: '}', kind: 'brace' });
  return rows;
}

/** MIR 的 IR 文本视图直接展示源文档，保留 YAML 头、块属性和缩进 */
function buildMIRRows(source: string): IRRow[] {
  return source.split('\n').map((text) => {
    const trimmed = text.trim();
    if (trimmed === '') return { text, kind: 'header' };
    if (/^bb\.[\w.]+/.test(trimmed)) return { text, kind: 'label' };
    if (/^(liveins|successors):/.test(trimmed)) return { text, kind: 'meta' };
    if (trimmed === '---' || /^[A-Za-z_][\w]*:/.test(trimmed)) {
      return { text, kind: 'header' };
    }
    return { text, kind: isMIRTerminator(mirOpcode(trimmed)) ? 'term' : 'ins' };
  });
}

export default function CFGViewer({
  ir,
  format = 'llvm-ir',
  title,
  height = 560,
  collapsedByDefault = false,
  defaultMode = 'cfg',
  locale = defaultLocale,
}: CFGViewerProps) {
  const parsed = useMemo(() => parseSource(ir, format, locale), [ir, format, locale]);
  // null 表示还没手动选过模式；输入变化时回到自动默认
  const [mode, setMode] = useState<ViewMode | null>(null);
  const [activeFunction, setActiveFunction] = useState(0);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [selected, setSelected] = useState<string | null>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // 单基本块的图只有一张卡片，默认看 IR 文本；多基本块才默认 CFG
  const preferIR = useMemo(() => prefersIRView(parsed), [parsed]);
  const shownMode: ViewMode = mode ?? (preferIR ? 'ir' : defaultMode);
  const fn = parsed.functions[activeFunction];
  const graph = useMemo(() => (fn ? layoutCFG(fn, { collapsed }) : null), [fn, collapsed]);
  const rows = useMemo(
    () => (fn ? (format === 'mir' ? buildMIRRows(fn.source) : buildRows(fn)) : []),
    [fn, format],
  );

  useEffect(() => {
    setActiveFunction(0);
    setSelected(null);
    setAutoFit(true);
    setMode(null);
  }, [ir, format]);

  useEffect(() => {
    if (shownMode !== 'cfg') return;
    const viewport = viewportRef.current;
    if (!viewport || !graph) return;

    const fit = () => {
      if (!autoFit) return;
      const available = viewport.clientWidth - 24;
      if (available <= 0) return;
      setScale(clamp(available / graph.width, MIN_SCALE, 1));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [graph, autoFit, shownMode]);

  const issues = parsed.issues;

  const selectBlock = (id: string) => {
    setSelected((current) => (current === id ? null : id));
  };

  const copyIR = async () => {
    if (!fn) return;
    try {
      await navigator.clipboard.writeText(format === 'mir' ? fn.source : functionToIR(fn));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="cfg" aria-label={title ?? t(locale, 'cfg.group')}>
      <header className="cfg__bar">
        <IRFormatTag format={format} locale={locale} />
        <div className="cfg__tabs" role="group" aria-label={t(locale, 'cfg.functions')}>
          {parsed.functions.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === activeFunction}
              className="cfg__tab"
              onClick={() => {
                setActiveFunction(index);
                setSelected(null);
              }}
            >
              {format === 'mir' ? item.name : `@${item.name}`}
            </button>
          ))}
        </div>

        <ViewModeSwitch
          value={shownMode}
          onChange={setMode}
          locale={locale}
          label={t(locale, 'cfg.mode')}
        />

        {shownMode === 'cfg' ? (
          <div className="cfg__actions">
            <button
              type="button"
              className="cfg__toggle"
              aria-pressed={collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {t(locale, collapsed ? 'cfg.showInst' : 'cfg.hideInst')}
            </button>
            <div className="cfg__zoom" role="group" aria-label={t(locale, 'cfg.zoom')}>
              <button
                type="button"
                onClick={() => {
                  setAutoFit(false);
                  setScale((value) => clamp(value - 0.1, MIN_SCALE, MAX_SCALE));
                }}
                aria-label={t(locale, 'cfg.zoomOut')}
              >
                −
              </button>
              <span className="cfg__scale" aria-live="polite">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  setAutoFit(false);
                  setScale((value) => clamp(value + 0.1, MIN_SCALE, MAX_SCALE));
                }}
                aria-label={t(locale, 'cfg.zoomIn')}
              >
                +
              </button>
              <button
                type="button"
                className="cfg__fit"
                onClick={() => setAutoFit(true)}
                aria-label={t(locale, 'cfg.fitWidth')}
                title={t(locale, 'cfg.fitWidth')}
              >
                {t(locale, 'cfg.fit')}
              </button>
            </div>
          </div>
        ) : (
          <div className="cfg__actions">
            <button type="button" className="cfg__toggle" onClick={copyIR}>
              {t(locale, copied ? 'cfg.copied' : 'cfg.copy')}
            </button>
          </div>
        )}
      </header>

      {issues.length > 0 ? (
        <ul className="cfg__issues">
          {issues.slice(0, 4).map((issue, index) => (
            <li key={`${issue.line}-${index}`}>
              {t(locale, 'cfg.issueLine', { line: issue.line, message: issue.message })}
            </li>
          ))}
        </ul>
      ) : null}

      {!fn || !graph ? (
        <p className="cfg__empty">
          {t(locale, format === 'mir' ? 'cfg.emptyMir' : 'cfg.empty')}
        </p>
      ) : shownMode === 'cfg' ? (
        <>
          <div className="cfg__viewport" ref={viewportRef} style={{ maxHeight: `${height}px` }}>
            <CFGCanvas
              graph={graph}
              scale={scale}
              selected={selected}
              onSelect={selectBlock}
              format={format}
              locale={locale}
            />
          </div>
          <footer className="cfg__meta">
            <span>
              {t(locale, 'cfg.metaBlocks', { blocks: fn.blocks.length, edges: fn.edges.length })}
            </span>
            <span className="cfg__hint">
              {selected
                ? t(locale, 'cfg.selected', { block: selected })
                : t(locale, 'cfg.selectHint')}
            </span>
          </footer>
        </>
      ) : (
        <>
          <div
            className="cfg__ir"
            style={{ maxHeight: `${height}px` }}
            role="region"
            aria-label={
              format === 'mir'
                ? t(locale, 'cfg.irRegionMir', { name: fn.name })
                : t(locale, 'cfg.irRegion', { name: fn.name })
            }
          >
            <ol>
              {rows.map((row, index) => (
                <li key={index} className={`is-${row.kind}`}>
                  <span className="no" aria-hidden="true">
                    {index + 1}
                  </span>
                  <code>
                    <IRText text={row.text} format={format} />
                  </code>
                </li>
              ))}
            </ol>
          </div>
          <footer className="cfg__meta">
            <span>
              {t(locale, 'cfg.metaLines', { blocks: fn.blocks.length, lines: rows.length })}
            </span>
            <span className="cfg__hint">{t(locale, 'cfg.irHint')}</span>
          </footer>
        </>
      )}
    </section>
  );
}
