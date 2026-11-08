import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { layoutCFG } from '../lib/ir/layout';
import type { LaidOutBlock } from '../lib/ir/layout';
import { parseIR } from '../lib/ir/parse';
import './CFGViewer.css';

export interface CFGViewerProps {
  /** LLVM 文本 IR，可以包含多个函数 */
  ir: string;
  title?: string;
  /** 视口最大高度，超出后内部滚动 */
  height?: number;
  collapsedByDefault?: boolean;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function BlockNode({
  block,
  collapsed,
  selected,
  onSelect,
}: {
  block: LaidOutBlock;
  collapsed: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const rows = collapsed && block.terminator ? [block.terminator] : block.instructions;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      className={`cfg-node${block.isEntry ? ' is-entry' : ''}${selected ? ' is-selected' : ''}`}
      style={{
        left: block.x,
        top: block.y,
        width: block.width,
        height: block.height,
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`基本块 ${block.label}，${block.instructions.length} 条指令`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="cfg-node__head">
        <span className="cfg-node__label">{block.label}</span>
        <span className="cfg-node__count" aria-hidden="true">
          {block.instructions.length}
        </span>
      </div>
      <ol className="cfg-node__body">
        {rows.map((instruction, index) => (
          <li
            key={`${instruction.text}-${index}`}
            className={!collapsed && instruction.terminator ? 'is-term' : undefined}
          >
            {instruction.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function CFGViewer({
  ir,
  title,
  height = 560,
  collapsedByDefault = false,
}: CFGViewerProps) {
  const parsed = useMemo(() => parseIR(ir), [ir]);
  const [activeFunction, setActiveFunction] = useState(0);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [selected, setSelected] = useState<string | null>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [scale, setScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const uid = rawId.replace(/[:]/g, '');

  const fn = parsed.functions[activeFunction];
  const graph = useMemo(() => (fn ? layoutCFG(fn, { collapsed }) : null), [fn, collapsed]);

  useEffect(() => {
    setActiveFunction(0);
    setSelected(null);
    setAutoFit(true);
  }, [ir]);

  useEffect(() => {
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
  }, [graph, autoFit]);

  const issues = parsed.issues;

  const selectBlock = (id: string) => {
    setSelected((current) => (current === id ? null : id));
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

      {graph && fn ? (
        <>
          <div className="cfg__viewport" ref={viewportRef} style={{ maxHeight: `${height}px` }}>
            <div
              className="cfg__canvas"
              style={{ width: graph.width * scale, height: graph.height * scale }}
            >
              <div
                className="cfg__stage"
                style={
                  {
                    width: graph.width,
                    height: graph.height,
                    transform: `scale(${scale})`,
                  } as CSSProperties
                }
              >
                <svg
                  className="cfg__edges"
                  width={graph.width}
                  height={graph.height}
                  viewBox={`0 0 ${graph.width} ${graph.height}`}
                  aria-hidden="true"
                >
                  <defs>
                    {(['idle', 'active', 'back'] as const).map((variant) => (
                      <marker
                        key={variant}
                        id={`${uid}-${variant}`}
                        viewBox="0 0 8 8"
                        refX="7.5"
                        refY="4"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M0,0.6 L7.6,4 L0,7.4 z"
                          className={`cfg-arrow cfg-arrow--${variant}`}
                        />
                      </marker>
                    ))}
                  </defs>

                  {graph.edges.map((edge, index) => {
                    const active =
                      selected !== null && (edge.from === selected || edge.to === selected);
                    const variant = active ? 'active' : edge.back ? 'back' : 'idle';
                    const classes = [
                      'cfg-edge',
                      edge.back ? 'cfg-edge--back' : '',
                      active ? 'is-active' : '',
                      edge.kind === 'true' ? 'cfg-edge--true' : '',
                      edge.kind === 'false' ? 'cfg-edge--false' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <g key={`${edge.from}-${edge.to}-${edge.label ?? ''}-${index}`}>
                        <path
                          d={edge.d}
                          className={classes}
                          markerEnd={`url(#${uid}-${variant})`}
                        />
                        {edge.label ? (
                          <g className="cfg-edge__label">
                            <rect
                              x={edge.labelX - (edge.label.length * 6 + 10) / 2}
                              y={edge.labelY - 9}
                              width={edge.label.length * 6 + 10}
                              height={15}
                              rx={4}
                            />
                            <text x={edge.labelX} y={edge.labelY + 2} textAnchor="middle">
                              {edge.label}
                            </text>
                          </g>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>

                {graph.blocks.map((block) => (
                  <BlockNode
                    key={block.id}
                    block={block}
                    collapsed={collapsed}
                    selected={selected === block.id}
                    onSelect={() => selectBlock(block.id)}
                  />
                ))}
              </div>
            </div>
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
        <p className="cfg__empty">没有可展示的函数。粘贴一个包含 define 的 LLVM IR 试试。</p>
      )}
    </section>
  );
}
