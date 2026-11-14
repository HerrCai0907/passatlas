import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import { instructionKey } from '../lib/ir/diff';
import type { InstructionMark } from '../lib/ir/diff';
import type { IRFormat } from '../lib/ir/format';
import type { CFGGraph, LaidOutBlock } from '../lib/ir/layout';
import IRText from './IRText';
import './CFGCanvas.css';

export interface CFGCanvasProps {
  graph: CFGGraph;
  scale?: number;
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** 关掉后节点不可聚焦、不响应点击，用于只读预览 */
  interactive?: boolean;
  /** 指令级 diff 标记，键由 instructionKey() 生成；用于分步播放器的 CFG 视图 */
  marks?: ReadonlyMap<string, InstructionMark>;
  /** 节点里的指令是 LLVM IR 还是 Machine IR；决定语法高亮方案 */
  format?: IRFormat;
  locale?: Locale;
}

function BlockNode({
  block,
  selected,
  interactive,
  onSelect,
  marks,
  format,
  locale,
}: {
  block: LaidOutBlock;
  selected: boolean;
  interactive: boolean;
  onSelect?: (id: string) => void;
  marks?: ReadonlyMap<string, InstructionMark>;
  format: IRFormat;
  locale: Locale;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(block.id);
    }
  };

  return (
    <div
      className={`cfg-node${block.isEntry ? ' is-entry' : ''}${selected ? ' is-selected' : ''}${
        interactive ? '' : ' is-static'
      }`}
      style={{ left: block.x, top: block.y, width: block.width, height: block.height }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={
        interactive
          ? t(locale, 'canvas.block', {
              label: block.label,
              count: block.instructions.length,
            })
          : undefined
      }
      onClick={interactive ? () => onSelect?.(block.id) : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <div className="cfg-node__head">
        <span className="cfg-node__label">{block.label}</span>
        <span className="cfg-node__count" aria-hidden="true">
          {block.instructions.length}
        </span>
      </div>
      <ol className="cfg-node__body">
        {block.instructions.map((instruction, index) => {
          const mark = marks?.get(instructionKey(block.id, index));
          const classes = [instruction.terminator ? 'is-term' : '', mark ? `is-${mark}` : '']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={`${instruction.text}-${index}`} className={classes || undefined}>
              {mark ? <span className="sr-only">{t(locale, `diff.${mark}`)}</span> : null}
              <IRText text={instruction.text} format={format} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function CFGCanvas({
  graph,
  scale = 1,
  selected = null,
  onSelect,
  interactive = true,
  marks,
  format = 'llvm-ir',
  locale = defaultLocale,
}: CFGCanvasProps) {
  const uid = useId().replace(/[:]/g, '');

  return (
    <div
      className="cfg-canvas"
      style={{ width: graph.width * scale, height: graph.height * scale }}
    >
      <div
        className="cfg-stage"
        style={{ width: graph.width, height: graph.height, transform: `scale(${scale})` }}
      >
        <svg
          className="cfg-edges"
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
                <path d="M0,0.6 L7.6,4 L0,7.4 z" className={`cfg-arrow cfg-arrow--${variant}`} />
              </marker>
            ))}
          </defs>

          {graph.edges.map((edge, index) => {
            const active = selected !== null && (edge.from === selected || edge.to === selected);
            const variant = active ? 'active' : edge.back ? 'back' : 'idle';
            const classes = [
              'cfg-edge',
              edge.back ? 'cfg-edge--back' : '',
              active ? 'is-active' : '',
              edge.kind === 'true' ? 'cfg-edge--true' : '',
              edge.kind === 'false' ? 'cfg-edge--false' : '',
              edge.kind === 'taken' ? 'cfg-edge--taken' : '',
              edge.kind === 'fallthrough' ? 'cfg-edge--fallthrough' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <g key={`${edge.from}-${edge.to}-${edge.label ?? ''}-${index}`}>
                <path d={edge.d} className={classes} markerEnd={`url(#${uid}-${variant})`} />
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
            selected={selected === block.id}
            interactive={interactive}
            onSelect={onSelect}
            marks={marks}
            format={format}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
