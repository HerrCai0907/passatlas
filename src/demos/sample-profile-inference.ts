import { makeDemo } from './types.ts';

/**
 * profi 在带环 CFG 上的最小费用流演示。
 *
 * 样本只覆盖 entry / body / exit；loop 头、then 与 latch 未知。
 * 回边 latch -> loop 带 450，入口带 100，所以 loop 头被推断成 550；
 * loop 的 550 次再分成 450 进 body、100 到 exit。body 的 then / latch
 * 分支没有样本，even-flow 把 450 分成 225 / 225。
 *
 * 真实的 LLVM 23 对等价 C 循环（页面「自己跑一遍」）输出：
 * function_entry_count 100、loop 450:100、body 225:225。
 */
const sampled = `
define i32 @sum(i32 %n) {
entry:
  br label %loop

loop:
  %i = phi i32 [ 0, %entry ], [ %inc, %latch ]
  %s = phi i32 [ 0, %entry ], [ %s.next, %latch ]
  %cmp = icmp slt i32 %i, %n
  br i1 %cmp, label %body, label %exit

body:
  %bit = and i32 %i, 1
  %odd = icmp eq i32 %bit, 0
  br i1 %odd, label %then, label %latch

then:
  %plus = add i32 %s, 1
  br label %latch

latch:
  %s.next = phi i32 [ %s, %body ], [ %plus, %then ]
  %inc = add i32 %i, 1
  br label %loop

exit:
  ret i32 %s
}
`;

const loopAnnotated = `
define i32 @sum(i32 %n) !prof !0 {
entry:
  br label %loop

loop:
  %i = phi i32 [ 0, %entry ], [ %inc, %latch ]
  %s = phi i32 [ 0, %entry ], [ %s.next, %latch ]
  %cmp = icmp slt i32 %i, %n
  br i1 %cmp, label %body, label %exit, !prof !1

body:
  %bit = and i32 %i, 1
  %odd = icmp eq i32 %bit, 0
  br i1 %odd, label %then, label %latch

then:
  %plus = add i32 %s, 1
  br label %latch

latch:
  %s.next = phi i32 [ %s, %body ], [ %plus, %then ]
  %inc = add i32 %i, 1
  br label %loop

exit:
  ret i32 %s
}

!0 = !{!"function_entry_count", i64 100}
!1 = !{!"branch_weights", i32 450, i32 100}
`;

const annotated = `
define i32 @sum(i32 %n) !prof !0 {
entry:
  br label %loop

loop:
  %i = phi i32 [ 0, %entry ], [ %inc, %latch ]
  %s = phi i32 [ 0, %entry ], [ %s.next, %latch ]
  %cmp = icmp slt i32 %i, %n
  br i1 %cmp, label %body, label %exit, !prof !1

body:
  %bit = and i32 %i, 1
  %odd = icmp eq i32 %bit, 0
  br i1 %odd, label %then, label %latch, !prof !2

then:
  %plus = add i32 %s, 1
  br label %latch

latch:
  %s.next = phi i32 [ %s, %body ], [ %plus, %then ]
  %inc = add i32 %i, 1
  br label %loop

exit:
  ret i32 %s
}

!0 = !{!"function_entry_count", i64 100}
!1 = !{!"branch_weights", i32 450, i32 100}
!2 = !{!"branch_weights", i32 225, i32 225}
`;

const samples = [
  'block   samples  kind',
  'entry   100      known',
  'loop    -        unknown',
  'body    450      known',
  'then    -        unknown',
  'latch   -        unknown',
  'exit    100      known',
].join('\n');

const costs = [
  'block   w     inc  dec  dec-cap',
  'entry   100   40   10   100',
  'loop    -     0    0    0',
  'body    450   10   20   450',
  'then    -     0    0    0',
  'latch   -     0    0    0',
  'exit    100   10   20   100',
].join('\n');

const circulation = [
  'edge          flow',
  'entry->loop   100',
  'latch->loop   450',
  'loop->body    450',
  'loop->exit    100',
  'loop = 100 + 450 = 550',
].join('\n');

const split = [
  'block   in    out   flow',
  'body    450   450   450',
  'then    225   225   225',
  'latch   450   450   450',
].join('\n');

const flows = [
  'block   in    out   flow',
  'entry   0     100   100',
  'loop    550   550   550',
  'body    450   450   450',
  'then    225   225   225',
  'latch   450   450   450',
  'exit    100   0     100',
].join('\n');

const loopMD = [
  'metadata               value',
  'function_entry_count   100',
  'loop branch_weights    450 : 100',
].join('\n');

const allMD = [
  'metadata               value',
  'loop branch_weights    450 : 100',
  'body branch_weights    225 : 225',
].join('\n');

export const sampleProfileInferenceDemo = makeDemo(
  'sample-profile-inference',
  'profi · sample-profile-inference',
  [
    {
      title: '第 1 步 · 循环头没有样本，回边却有计数',
      note: 'pseudo probe 的样本只落在 entry、body、exit 上：100 / 450 / 100。loop 头、then 和 latch 都没有样本；body 的 450 已经说明回边要带回 450 次，但循环头本身被探针漏掉了。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %cmp, label %body, label %exit' },
      focus: ['br i1 %cmp, label %body, label %exit'],
      state: samples,
    },
    {
      title: '第 2 步 · 把循环也建成流网络',
      note: '每个块拆成 Bin / Bout；latch→loop 的回边就是一条普通的 jump edge，和正向边一样有容量和费用。loop 头是未知块，增加免费、减少没有容量；entry / body / exit 是已知块，加减都要按价格付费；latch 和 then 一样是未知块。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %cmp, label %body, label %exit' },
      focus: ['br i1 %cmp, label %body, label %exit'],
      state: costs,
    },
    {
      title: '第 3 步 · 回边把循环头钉在 550',
      note: 'entry 的 100 全部进入 loop；body 的 450 要求回边带回 450，所以 loop 头 = 100 + 450 = 550。这 550 次里，450 次进入 body、100 次走到 exit，正好对上 exit 的 100 个样本。latch 没有样本，它收到 body 的 450 后原样送回循环；未知的循环头不是猜出来的。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br label %loop', occurrence: 2 },
      focus: ['%s.next = phi i32 [ %s, %body ], [ %plus, %then ]'],
      state: circulation,
    },
    {
      title: '第 4 步 · body 的未知分支均分 450',
      note: 'body 的 450 次在 then 与 latch 之间分。then 没有样本，两条边都免费，最小费用无法区分；even-flow 把 450 分成 225 / 225。如果 then 自带 150 个样本，结果就是 150 / 300。',
      before: sampled,
      after: sampled,
      cursor: { line: 'br i1 %odd, label %then, label %latch' },
      focus: ['br i1 %odd, label %then, label %latch'],
      state: split,
    },
    {
      title: '第 5 步 · 抽出计数，检查循环的流量守恒',
      note: 'loop 的入流是 entry 100 + 回边 450 = 550，出流是 body 450 + exit 100 = 550；body 与 then 各 225，latch 收 225 + 225 = 450，再全部送回 loop。除入口和出口外，每一块的入流都等于出流。',
      before: sampled,
      after: sampled,
      cursor: { line: 'ret i32 %s' },
      focus: ['ret i32 %s'],
      state: flows,
    },
    {
      title: '第 6 步 · 写回循环分支的权重',
      note: 'loop 的两条出边只有 450 : 100，loader 把它写成 branch_weights；函数入口计数用推断出的 100。注意 exit 的 100 个样本不是「循环退出 100 次」猜的，而是 550 减去 body 的 450 之后剩下的流量。',
      before: sampled,
      after: loopAnnotated,
      cursor: {
        line: 'br i1 %cmp, label %body, label %exit, !prof !1',
        side: 'after',
      },
      state: loopMD,
    },
    {
      title: '第 7 步 · 写回循环体内的分支权重',
      note: 'body 的 then / latch 是未知分支的均分结果，写成 225 : 225。到这里两条分支都有了权重：循环头 450 : 100，循环体内 225 : 225；如果 then 有 150 个样本，这一步会变成 150 : 300。',
      before: loopAnnotated,
      after: annotated,
      cursor: {
        line: 'br i1 %odd, label %then, label %latch, !prof !2',
        side: 'after',
      },
      state: allMD,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · The loop header has no samples, but the back edge does',
          note: 'Pseudo-probe samples land only on entry, body and exit: 100 / 450 / 100. The loop header, then and latch are all unknown. body’s 450 already implies the back edge must carry 450 executions, but the loop header itself was missed by the probes.',
        },
        {
          title: 'Step 2 · Build the loop into the flow network',
          note: 'Each block is split into Bin / Bout; the latch→loop back edge is an ordinary jump edge with capacity and cost, just like a forward edge. The loop header is unknown, so increasing it is free and there is no capacity to decrease it; entry, body and exit are sampled, so every change there has a price; latch and then are unknown.',
        },
        {
          title: 'Step 3 · The back edge pins the loop header at 550',
          note: 'All 100 entry executions enter the loop; body’s 450 requires the back edge to carry 450, so the loop header runs 100 + 450 = 550 times. Of those 550, 450 go to body and 100 go to exit, matching the 100 exit samples exactly. The latch has no samples: it receives body’s 450 and sends it straight back. The unknown header is constrained, not guessed.',
        },
        {
          title: 'Step 4 · Split the unknown body branch',
          note: 'The 450 body executions split between then and latch. then has no samples and both edges are free, so minimum cost cannot distinguish them; even-flow splits 450 into 225 / 225. If then carried 150 samples, the split would be 150 / 300.',
        },
        {
          title: 'Step 5 · Extract the counts and verify loop conservation',
          note: 'The loop inflow is entry 100 + back edge 450 = 550, and its outflow is body 450 + exit 100 = 550. body and then each carry 225; latch receives 225 + 225 = 450 and sends it all back to the loop. Apart from entry and exit, every block has equal in- and outflow.',
        },
        {
          title: 'Step 6 · Write back the loop branch weights',
          note: 'The loop has only two outgoing edges, 450 : 100, and the loader writes them as branch_weights; the function entry count uses the inferred 100. Note that the 100 exit samples are not a guess at “100 loop exits”: they are the flow left after subtracting body’s 450 from 550.',
        },
        {
          title: 'Step 7 · Write back the branch inside the loop',
          note: 'The then / latch split is the even-flow result for an unknown branch, written as 225 : 225. Both branches now carry weights: the loop header 450 : 100 and the body 225 : 225; if then had 150 samples, this step would produce 150 : 300.',
        },
      ],
    },
  },
);
