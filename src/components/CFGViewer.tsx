import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutCFG } from '../lib/ir/layout';
import { functionToIR, parseIR } from '../lib/ir/parse';
import type { IRFunction } from '../lib/ir/parse';
import CFGCanvas from './CFGCanvas';
import ViewModeSwitch from './ViewModeSwitch';
import type { ViewMode } from './ViewModeSwitch';
import './CFGViewer.css';

export interface CFGViewerProps {
  /** LLVM 文本 IR，可以包含多个函数 */
  ir: string;
  title?: string;
  /** 视口最大高度，超出后内部滚动 */
  height?: number;
  collapsedByDefault?: boolean;
  /** 默认展示模式；按产品约定默认是 CFG 图 */
  defaultMode?: ViewMode;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.5;

type IRRow = { text: string; kind: 'header' | 'label' | 'ins' | 'term' | 'brace' };

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

export default function CFGViewer({
  ir,
  title,
  height = 560,
  collapsedByDefault = false,
  defaultMode = 'cfg',
}: CFGViewerProps) {
  const parsed = useMemo(() => parseIR(ir), [ir]);
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [activeFunction, setActiveFunction] = useState(0);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [selected, setSelected] = useState<string | null>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const fn = parsed.functions[activeFunction];
  const graph = useMemo(() => (fn ? layoutCFG(fn, { collapsed }) : null), [fn, collapsed]);
  const rows = useMemo(() => (fn ? buildRows(fn) : []), [fn]);

  useEffect(() => {
    setActiveFunction(0);
    setSelected(null);
    setAutoFit(true);
  }, [ir]);

  useEffect(() => {
    if (mode !== 'cfg') return;
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
  }, [graph, autoFit, mode]);

  const issues = parsed.issues;

  const selectBlock = (id: string) => {
    setSelected((current) => (current === id ? null : id));
  };

  const copyIR = async () => {
    if (!fn) return;
    try {
      await navigator.clipboard.writeText(functionToIR(fn));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="cfg" aria-label={title ?? '控制流图'}>
      <header className="cfg__bar">
        <div className="cfg__tabs" role="group" aria-label="函数">
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
              @{item.name}
            </button>
          ))}
        </div>

        <ViewModeSwitch value={mode} onChange={setMode} label="CFG 图或 IR 文本" />

        {mode === 'cfg' ? (
          <div className="cfg__actions">
            <button
              type="button"
              className="cfg__toggle"
              aria-pressed={collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? '显示指令' : '只看控制流'}
            </button>
            <div className="cfg__zoom" role="group" aria-label="缩放">
              <button
                type="button"
                onClick={() => {
                  setAutoFit(false);
                  setScale((value) => clamp(value - 0.1, MIN_SCALE, MAX_SCALE));
                }}
                aria-label="缩小"
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
                aria-label="放大"
              >
                +
              </button>
              <button
                type="button"
                className="cfg__fit"
                onClick={() => setAutoFit(true)}
                aria-label="适应宽度"
                title="适应宽度"
              >
                适应
              </button>
            </div>
          </div>
        ) : (
          <div className="cfg__actions">
            <button type="button" className="cfg__toggle" onClick={copyIR}>
              {copied ? '已复制' : '复制 IR'}
            </button>
          </div>
        )}
      </header>

      {issues.length > 0 ? (
        <ul className="cfg__issues">
          {issues.slice(0, 4).map((issue, index) => (
            <li key={`${issue.line}-${index}`}>
              第 {issue.line} 行：{issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {!fn || !graph ? (
        <p className="cfg__empty">没有可展示的函数。粘贴一个包含 define 的 LLVM IR 试试。</p>
      ) : mode === 'cfg' ? (
        <>
          <div className="cfg__viewport" ref={viewportRef} style={{ maxHeight: `${height}px` }}>
            <CFGCanvas graph={graph} scale={scale} selected={selected} onSelect={selectBlock} />
          </div>
          <footer className="cfg__meta">
            <span>
              {fn.blocks.length} 个基本块 · {fn.edges.length} 条控制流边
            </span>
            <span className="cfg__hint">
              {selected ? `已选中 ${selected}，再次点击取消` : '点击基本块可高亮它相关的边'}
            </span>
          </footer>
        </>
      ) : (
        <>
          <div
            className="cfg__ir"
            style={{ maxHeight: `${height}px` }}
            role="region"
            aria-label={`@${fn.name} 的 IR 文本`}
          >
            <ol>
              {rows.map((row, index) => (
                <li key={index} className={`is-${row.kind}`}>
                  <span className="no" aria-hidden="true">
                    {index + 1}
                  </span>
                  <code>{row.text}</code>
                </li>
              ))}
            </ol>
          </div>
          <footer className="cfg__meta">
            <span>
              {fn.blocks.length} 个基本块 · {rows.length} 行 IR
            </span>
            <span className="cfg__hint">切回 CFG 可以看这些指令之间的跳转关系</span>
          </footer>
        </>
      )}
    </section>
  );
}
