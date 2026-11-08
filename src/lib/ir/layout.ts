/**
 * 纯函数式 CFG 布局：分层（Sugiyama 简化版）+ 重心法减少交叉。
 *
 * 输出坐标供 CFGViewer 用 HTML 绝对定位渲染节点、SVG 渲染边。
 * 尺寸常量必须和 CFGViewer.css 里的节点样式保持一致。
 */
import type { IRBlock, IRFunction, IREdge } from './parse';

export const NODE_WIDTH = 320;
export const NODE_MIN_WIDTH = 176;
export const NODE_HEADER = 30;
export const NODE_LINE = 17;
export const NODE_PAD = 8;
export const NODE_CHAR = 6.8;
export const NODE_PAD_X = 20;

const H_GAP = 56;
const V_GAP = 74;
const MARGIN = 32;
const TERM_GAP = 7;
const EDGE_BULGE = 74;

export interface LayoutOptions {
  /** 只显示基本块名与终结指令，用于看整体结构 */
  collapsed?: boolean;
}

export interface LaidOutBlock {
  id: string;
  label: string;
  instructions: IRBlock['instructions'];
  terminator: IRBlock['terminator'];
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isEntry: boolean;
}

export interface LaidOutEdge {
  from: string;
  to: string;
  label?: string;
  kind: IREdge['kind'];
  /** SVG path 的 d 属性 */
  d: string;
  labelX: number;
  labelY: number;
  back: boolean;
}

export interface CFGGraph {
  blocks: LaidOutBlock[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
}

/** 等宽字体下估算显示宽度：CJK / 全角字符按 2 列算 */
function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += (ch.codePointAt(0) ?? 0) > 0x2e80 ? 2 : 1;
  }
  return width;
}

/** 按空格优先贪心折行，和 CSS 的 pre-wrap + overflow-wrap:anywhere 行为对齐 */
function wrapLine(line: string, columns: number): number {
  if (line === '') return 1;

  const chars = [...line];
  let rows = 1;
  let width = 0;
  let lastSpace = -1;
  let lineStart = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;
    const chWidth = displayWidth(ch);

    if (width + chWidth > columns) {
      rows += 1;
      if (lastSpace >= lineStart) {
        lineStart = lastSpace + 1;
        width = displayWidth(chars.slice(lineStart, i + 1).join(''));
      } else {
        lineStart = i;
        width = chWidth;
      }
      lastSpace = -1;
      continue;
    }

    width += chWidth;
    if (ch === ' ') lastSpace = i;
  }

  return rows;
}

function lineCount(text: string, columns: number): number {
  return text.split('\n').reduce((sum, line) => sum + wrapLine(line, columns), 0);
}

/** 按内容估算节点宽度：短块（ret）不必占满 320px，宽图能因此省下一半横向空间 */
function blockWidth(block: IRBlock): number {
  const content = Math.max(
    displayWidth(block.label) + 6,
    ...block.instructions.map((instruction) =>
      Math.max(...instruction.text.split('\n').map(displayWidth)),
    ),
  );
  return Math.min(NODE_WIDTH, Math.max(NODE_MIN_WIDTH, Math.ceil(content * NODE_CHAR) + NODE_PAD_X + 2));
}

function columnsOf(width: number): number {
  return Math.max(10, Math.floor((width - NODE_PAD_X) / NODE_CHAR));
}

function blockHeight(block: IRBlock, width: number, collapsed: boolean): number {
  if (collapsed) return NODE_HEADER + NODE_PAD * 2 + NODE_LINE;
  const columns = columnsOf(width);
  const body = block.instructions.reduce(
    (sum, instruction) => sum + lineCount(instruction.text, columns),
    0,
  );
  return NODE_HEADER + NODE_PAD * 2 + body * NODE_LINE + (block.terminator ? TERM_GAP : 0);
}

/** DFS 找出回边：目标点仍在当前栈上，说明这条边会形成环 */
function findBackEdges(blocks: IRBlock[], edges: IREdge[]): { back: Set<string>; order: string[] } {
  const successors = new Map<string, string[]>();
  for (const block of blocks) successors.set(block.id, []);
  for (const edge of edges) successors.get(edge.from)?.push(edge.to);

  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();
  const order: string[] = [];

  const visit = (start: string) => {
    const stack: Array<{ id: string; index: number }> = [{ id: start, index: 0 }];
    state.set(start, 1);
    order.push(start);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const children = successors.get(frame.id) ?? [];

      if (frame.index >= children.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }

      const next = children[frame.index]!;
      frame.index += 1;
      const seen = state.get(next) ?? 0;

      if (seen === 0) {
        state.set(next, 1);
        order.push(next);
        stack.push({ id: next, index: 0 });
      } else if (seen === 1) {
        back.add(`${frame.id}->${next}`);
      }
    }
  };

  for (const block of blocks) {
    if ((state.get(block.id) ?? 0) === 0) visit(block.id);
  }

  return { back, order };
}

function assignRanks(
  blocks: IRBlock[],
  edges: IREdge[],
  back: Set<string>,
  entryId: string,
) {
  const rank = new Map<string, number>();
  for (const block of blocks) rank.set(block.id, 0);

  // 从入口可达的集合；不可达的块统一排到最后一层
  const reachable = new Set<string>();
  const stack = entryId ? [entryId] : [];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of edges) {
      if (edge.from === id) stack.push(edge.to);
    }
  }

  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const block of blocks) {
    successors.set(block.id, []);
    indegree.set(block.id, 0);
  }

  for (const edge of edges) {
    if (back.has(`${edge.from}->${edge.to}`)) continue;
    if (!reachable.has(edge.from) || !reachable.has(edge.to)) continue;
    successors.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = blocks
    .filter((block) => reachable.has(block.id) && (indegree.get(block.id) ?? 0) === 0)
    .map((block) => block.id);
  const done = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    done.add(id);
    for (const next of successors.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(id) ?? 0) + 1));
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  let maxRank = 0;
  for (const id of done) maxRank = Math.max(maxRank, rank.get(id) ?? 0);
  for (const block of blocks) {
    if (!reachable.has(block.id)) rank.set(block.id, maxRank + 1);
  }

  return rank;
}

function orderRanks(blocks: IRBlock[], edges: IREdge[], rank: Map<string, number>, order: string[]) {
  const maxRank = Math.max(...blocks.map((block) => rank.get(block.id) ?? 0));
  const ranks: string[][] = Array.from({ length: maxRank + 1 }, () => []);

  for (const id of order) ranks[rank.get(id) ?? 0]?.push(id);

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const block of blocks) {
    predecessors.set(block.id, []);
    successors.set(block.id, []);
  }
  for (const edge of edges) {
    predecessors.get(edge.to)?.push(edge.from);
    successors.get(edge.from)?.push(edge.to);
  }

  const position = new Map<string, number>();
  const refresh = () => {
    for (const row of ranks) row.forEach((id, index) => position.set(id, index));
  };
  refresh();

  const barycentre = (id: string, neighbours: string[], direction: 1 | -1) => {
    const values = neighbours
      .map((neighbour) => ({ neighbour, r: rank.get(neighbour) ?? 0 }))
      .filter(({ r }) => (direction === 1 ? r === (rank.get(id) ?? 0) - 1 : r === (rank.get(id) ?? 0) + 1))
      .map(({ neighbour }) => position.get(neighbour) ?? 0);
    if (values.length === 0) return position.get(id) ?? 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (let r = 1; r < ranks.length; r += 1) {
      const row = ranks[r]!;
      const scores = new Map(row.map((id) => [id, barycentre(id, predecessors.get(id) ?? [], 1)]));
      row.sort((a, b) => (scores.get(a) ?? 0) - (scores.get(b) ?? 0));
      refresh();
    }
    for (let r = ranks.length - 2; r >= 0; r -= 1) {
      const row = ranks[r]!;
      const scores = new Map(row.map((id) => [id, barycentre(id, successors.get(id) ?? [], -1)]));
      row.sort((a, b) => (scores.get(a) ?? 0) - (scores.get(b) ?? 0));
      refresh();
    }
  }

  return ranks;
}

function edgeGeometry(
  from: LaidOutBlock,
  to: LaidOutBlock,
): { d: string; labelX: number; labelY: number; back: boolean } {
  const back = to.rank <= from.rank;

  if (from.id === to.id) {
    const x = from.x + from.width;
    const y1 = from.y + 20;
    const y2 = from.y + 40;
    return {
      d: `M ${x} ${y1} C ${x + 52} ${y1 - 22}, ${x + 52} ${y2 + 22}, ${x} ${y2}`,
      labelX: x + 58,
      labelY: (y1 + y2) / 2,
      back: true,
    };
  }

  if (back) {
    const x1 = from.x + from.width;
    const y1 = from.y + 20;
    const x2 = to.x + to.width;
    const y2 = to.y + 20;
    return {
      d: `M ${x1} ${y1} C ${x1 + EDGE_BULGE} ${y1}, ${x2 + EDGE_BULGE} ${y2}, ${x2} ${y2}`,
      labelX: Math.max(x1, x2) + EDGE_BULGE * 0.62,
      labelY: (y1 + y2) / 2,
      back: true,
    };
  }

  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const control = Math.max(26, (y2 - y1) * 0.45);

  return {
    d: `M ${x1} ${y1} C ${x1} ${y1 + control}, ${x2} ${y2 - control}, ${x2} ${y2}`,
    labelX: (x1 + x2) / 2 + 12,
    labelY: (y1 + y2) / 2,
    back: false,
  };
}

export function layoutCFG(fn: IRFunction, options: LayoutOptions = {}): CFGGraph {
  const collapsed = options.collapsed ?? false;
  const blocks = fn.blocks;
  const entryId = blocks[0]?.id ?? '';

  const { back, order } = findBackEdges(blocks, fn.edges);
  const rank = assignRanks(blocks, fn.edges, back, entryId);
  const ranks = orderRanks(blocks, fn.edges, rank, order);

  const widths = new Map<string, number>();
  const heights = new Map<string, number>();
  for (const block of blocks) {
    const width = blockWidth(block);
    widths.set(block.id, width);
    heights.set(block.id, blockHeight(block, width, collapsed));
  }

  const rankHeights = ranks.map((row) =>
    row.reduce((max, id) => Math.max(max, heights.get(id) ?? 0), 0),
  );
  const rankWidths = ranks.map(
    (row) =>
      row.reduce((sum, id) => sum + (widths.get(id) ?? 0), 0) +
      Math.max(0, row.length - 1) * H_GAP,
  );

  const graphWidth = Math.max(...rankWidths, NODE_WIDTH) + MARGIN * 2;

  let y = MARGIN;
  const rankY: number[] = [];
  for (let r = 0; r < ranks.length; r += 1) {
    rankY[r] = y;
    y += (rankHeights[r] ?? 0) + V_GAP;
  }

  const laidOut = new Map<string, LaidOutBlock>();
  ranks.forEach((row, r) => {
    const rowWidth = rankWidths[r] ?? 0;
    let x = (graphWidth - rowWidth) / 2;
    for (const id of row) {
      const block = blocks.find((item) => item.id === id);
      if (!block) continue;
      const height = heights.get(id) ?? 0;
      const width = widths.get(id) ?? NODE_WIDTH;
      laidOut.set(id, {
        id,
        label: block.label,
        instructions: block.instructions,
        terminator: block.terminator,
        rank: r,
        x,
        y: rankY[r] ?? MARGIN,
        width,
        height,
        isEntry: id === entryId,
      });
      x += width + H_GAP;
    }
  });

  const edges: LaidOutEdge[] = [];
  for (const edge of fn.edges) {
    const from = laidOut.get(edge.from);
    const to = laidOut.get(edge.to);
    if (!from || !to) continue;
    const geometry = edgeGeometry(from, to);
    edges.push({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      ...(edge.label ? { label: edge.label } : {}),
      d: geometry.d,
      labelX: geometry.labelX,
      labelY: geometry.labelY,
      back: geometry.back,
    });
  }

  const contentHeight = Math.max(...[...laidOut.values()].map((block) => block.y + block.height), 0);

  return {
    blocks: [...laidOut.values()],
    edges,
    width: graphWidth,
    height: contentHeight + MARGIN,
  };
}
