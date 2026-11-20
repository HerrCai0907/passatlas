import { makeDemo } from './types.ts';

/**
 * profi 的最小费用流演示。
 *
 * entry 与 join 各有一个样本，left / right 没有样本。两条路径的增广代价都是 0，
 * 所以求解器把 100 单位流量按出度均分；真实 LLVM 23 对同一个 CFG 的输出是
 * branch_weights 50:50、function_entry_count 100（见页面「自己跑一遍」）。
 */
const sampled = `
define i32 @pick(i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %left, label %right

left:
  %l = add i32 %x, 1
  br label %join

right:
  %r = sub i32 %x, 1
  br label %join

join:
  %p = phi i32 [ %l, %left ], [ %r, %right ]
  ret i32 %p
}
`;

const annotated = `
define i32 @pick(i32 %x) !prof !0 {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %left, label %right, !prof !1

left:
  %l = add i32 %x, 1
  br label %join

right:
  %r = sub i32 %x, 1
  br label %join

join:
  %p = phi i32 [ %l, %left ], [ %r, %right ]
  ret i32 %p
}

!0 = !{!"function_entry_count", i64 100}
!1 = !{!"branch_weights", i32 50, i32 50}
`;

const samples = [
  'block   samples  kind',
  'entry   100      known',
  'left    -        unknown',
  'right   -        unknown',
  'join    100      known',
].join('\n');

const costs = [
  'block   w     inc  dec  dec-cap',
  'entry   100   40   10   100',
  'left    -     0    0    0',
  'right   -     0    0    0',
  'join    100   10   20   100',
].join('\n');

const paths = [
  'path (S1 -> ... -> T1)       cost',
  'entry -> left  -> join       0',
  'entry -> right -> join       0',
  'shortest paths: 2   tie',
].join('\n');

const dag = [
  'augmenting DAG',
  'entry -> left  -> join',
  'entry -> right -> join',
  'out-degree(entry) = 2',
  '100 / 2 = 50 each',
].join('\n');

const flows = [
  'block   in    out   flow',
  'entry   0     100   100',
  'left    50    50    50',
  'right   50    50    50',
  'join    100   0     100',
].join('\n');

const metadata = [
  'metadata               value',
  'function_entry_count   100',
  'entry branch_weights   50 : 50',
].join('\n');

export const sampleProfileInferenceDemo = makeDemo(
  'sample-profile-inference',
  'profi · sample-profile-inference',
  [
    {
      title: '第 1 步 · 只读到两个块的样本',
      note: 'pseudo probe 的样本落在 entry 和 join 上：各 100。left 与 right 没有任何样本，在 FlowFunction 里是 HasUnknownWeight=true、权重 0；它们不是「计数为 0」，而是「不知道」。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %c, label %left, label %right' },
      focus: ['br i1 %c, label %left, label %right'],
      state: samples,
    },
    {
      title: '第 2 步 · 把每个块拆成 in/out 两个节点',
      note: '构建网络时每个块拆成 Bin 与 Bout：Bin→Bout 是增加计数的边，Bout→Bin 是减少计数的边，后者的容量等于样本数。未知块没有样本，所以只能增加，且增加代价为 0；入口块增加最贵，普通块减少比增加更贵。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %c, label %left, label %right' },
      focus: ['br i1 %c, label %left, label %right'],
      state: costs,
    },
    {
      title: '第 3 步 · 两条增广路径的代价都是 0',
      note: '从辅助源点 S1 到汇点 T1，两条路都没有经过任何带费用的 inc / dec 边：未知块的 increase 边代价为 0，已采样的 entry / join 通过 S1 / T1 的免费配额边进出。最短路径不唯一：left 与 right 完全对称，最小费用本身不能决定该走哪边。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %c, label %left, label %right' },
      focus: ['br i1 %c, label %left, label %right'],
      state: paths,
    },
    {
      title: '第 4 步 · 把最短路合成增广 DAG，再均分流量',
      note: 'EvenFlowDistribution 不是随便挑一条路：它把所有位于最短路上的边收进一个 DAG，按出度均分 100 单位。entry 有两个后继，于是 left 与 right 各得 50。若 left 自带 80 个样本，它的配额会把 80 单位流量锚在左边，结果就是 80 : 20。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %c, label %left, label %right' },
      focus: ['br i1 %c, label %left, label %right'],
      state: dag,
    },
    {
      title: '第 5 步 · 抽出块计数，检查流量守恒',
      note: '边的流量由网络里的辅助流决定，块计数取 max(入流, 出流)。entry 100、left 50、right 50、join 100；除入口与出口外，每一块的入流都等于出流。join 没有样本，它的 100 完全来自两条入边。',
      before: sampled,
      after: sampled,
      cursor: { line: '%p = phi i32 [ %l, %left ], [ %r, %right ]' },
      focus: ['%p = phi i32 [ %l, %left ], [ %r, %right ]'],
      state: flows,
    },
    {
      title: '第 6 步 · 写回 branch_weights 与 function_entry_count',
      note: 'loader 把入口两条边的流量写成 branch_weights 50:50，并把函数入口计数设成推断出的 100。profi 的输出已经是整数权重，不再需要旧启发式的 +1 修正；多个后继指向同一块时，权重再按重复边均分。',
      before: sampled,
      after: annotated,
      cursor: {
        line: 'br i1 %c, label %left, label %right, !prof !1',
        side: 'after',
      },
      state: metadata,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · Only two blocks have samples',
          note: 'Pseudo-probe samples land on entry and join: 100 each. left and right have no samples at all, so they are HasUnknownWeight=true with weight 0 in the FlowFunction; that means “unknown”, not “counted zero”.',
        },
        {
          title: 'Step 2 · Split every block into in/out nodes',
          note: 'The network splits each block into Bin and Bout: Bin→Bout increases the count and Bout→Bin decreases it, with capacity equal to the sampled weight. An unknown block has no sample, so it can only be increased, at zero cost; increasing the entry block is the most expensive option, and decreasing a normal block costs more than increasing it.',
        },
        {
          title: 'Step 3 · Both augmenting paths cost 0',
          note: 'From the auxiliary source S1 to the sink T1, neither route crosses a priced inc / dec edge: increasing an unknown block is free, and the sampled entry / join blocks enter and leave through their free quota edges at S1 / T1. The shortest path is not unique: left and right are perfectly symmetric, and minimum cost alone cannot choose between them.',
        },
        {
          title: 'Step 4 · Collect shortest edges into an augmenting DAG, then split evenly',
          note: 'EvenFlowDistribution does not just pick one path: it collects all edges on shortest paths into a DAG and splits the 100 units by out-degree. entry has two successors, so left and right get 50 each. If left carried 80 samples, its quota would anchor 80 units of flow there and the result would be 80 : 20.',
        },
        {
          title: 'Step 5 · Extract block counts and verify conservation',
          note: 'Edge flow comes from the auxiliary flow in the network, and a block count is max(inflow, outflow). entry 100, left 50, right 50, join 100; apart from entry and exit, every block has equal in- and outflow. join has no samples at all: its 100 comes entirely from the two incoming edges.',
        },
        {
          title: 'Step 6 · Write back branch_weights and function_entry_count',
          note: 'The loader turns the two entry-edge flows into branch_weights 50:50 and sets the function entry count to the inferred 100. profi already produces integral weights, so the old heuristic’s “+1” adjustment is not needed; when several successors point at the same block, the weight is split again across the duplicate edges.',
        },
      ],
    },
  },
);
