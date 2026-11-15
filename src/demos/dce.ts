import { makeDemo } from './types.ts';

const input = `
define i32 @f(i32 %x, ptr %p) {
entry:
  %dead1 = mul i32 %x, 7
  %dead2 = add i32 %dead1, 3
  %live = add i32 %x, 1
  store i32 %live, ptr %p
  %dead3 = icmp sgt i32 %dead2, 0
  ret i32 %live
}
`;

const afterDead3 = `
define i32 @f(i32 %x, ptr %p) {
entry:
  %dead1 = mul i32 %x, 7
  %dead2 = add i32 %dead1, 3
  %live = add i32 %x, 1
  store i32 %live, ptr %p
  ret i32 %live
}
`;

const afterDead2 = `
define i32 @f(i32 %x, ptr %p) {
entry:
  %dead1 = mul i32 %x, 7
  %live = add i32 %x, 1
  store i32 %live, ptr %p
  ret i32 %live
}
`;

const output = `
define i32 @f(i32 %x, ptr %p) {
entry:
  %live = add i32 %x, 1
  store i32 %live, ptr %p
  ret i32 %live
}
`;

const rootStore = [
  'worklist   live                      action',
  'ret %live  store                     root: store -> %live %p',
  'dead       -                         -',
].join('\n');

const rootRet = [
  'worklist   live                      action',
  '%live %p   store ret                 root: ret -> %live',
  'dead       -                         -',
].join('\n');

const markedLive = [
  'worklist   live                      action',
  '%p %x      store ret %live            pop %live -> %x',
  'dead       -                         -',
].join('\n');

const sweepDead3 = [
  'worklist   live                      action',
  '-          store ret %live %x %p     sweep %dead3',
  'dead       %dead1 %dead2             -',
].join('\n');

const sweepDead2 = [
  'worklist   live                      action',
  '-          store ret %live %x %p     sweep %dead2',
  'dead       %dead1                    -',
].join('\n');

const sweepDead1 = [
  'worklist   live                      action',
  '-          store ret %live %x %p     sweep %dead1',
  'dead       -                         -',
].join('\n');

export const dceDemo = makeDemo('dce', 'dce', [
  {
    title: '第 1 步 · 把有副作用的 store 当根',
    note: 'ADCE 不从参数开始，而是从「执行了就一定有影响」的指令开始。store 是根：它被标成 live，两个操作数 %live 和 %p 进 worklist。',
    before: input,
    after: input,
    cursor: { line: 'store i32 %live, ptr %p' },
    focus: ['store i32 %live, ptr %p'],
    state: rootStore,
  },
  {
    title: '第 2 步 · ret 也是根',
    note: 'ret 同样有可观察行为，被标成 live；它的操作数 %live 已经在栈里，去重后 worklist 还剩 %live 和 %p。',
    before: input,
    after: input,
    cursor: { line: 'ret i32 %live' },
    focus: ['ret i32 %live'],
    state: rootRet,
  },
  {
    title: '第 3 步 · 沿 use-def 链反向标记 %live',
    note: '弹出 %live，标记为 live，再把它依赖的 %x 压栈。反向传播只看操作数，所以从结果往源头走；%dead2 从未进入 worklist，因为没有任何根使用它。',
    before: input,
    after: input,
    cursor: { line: '%live = add i32 %x, 1' },
    focus: ['%live = add i32 %x, 1'],
    state: markedLive,
  },
  {
    title: '第 4 步 · 清扫 %dead3',
    note: 'worklist 空了，剩下没被标记的指令就是死代码。%dead3 只被它自己的结果使用，先删它：这一步处理一条指令，IR 只少一行。',
    before: input,
    after: afterDead3,
    cursor: { line: '%dead3 = icmp sgt i32 %dead2, 0' },
    state: sweepDead3,
  },
  {
    title: '第 5 步 · 清扫 %dead2',
    note: '%dead3 没了之后，%dead2 的最后一个使用者消失，但它在第一轮标记时就从未活过。删除它，%dead1 随即变成无使用者。',
    before: afterDead3,
    after: afterDead2,
    cursor: { line: '%dead2 = add i32 %dead1, 3' },
    state: sweepDead2,
  },
  {
    title: '第 6 步 · 清扫 %dead1，函数进入不动点',
    note: '最后删掉 %dead1。普通 DCE 需要反复扫描才能发现这条链；ADCE 从根反推一次就知道整条链都不可达。ADCE 还会删掉不可达的基本块，这个函数只有 entry，因此到此结束。',
    before: afterDead2,
    after: output,
    cursor: { line: '%dead1 = mul i32 %x, 7' },
    state: sweepDead1,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Start from the store that has a side effect',
        note: 'ADCE does not start from the arguments; it starts from instructions whose execution is always observable. The store is a root: it is marked live and its two operands, %live and %p, enter the worklist.',
      },
      {
        title: 'Step 2 · ret is a root too',
        note: 'ret is observable as well, so it is marked live; its operand %live is already in the stack, and after deduplication the worklist holds %live and %p.',
      },
      {
        title: 'Step 3 · Walk the use-def chain backwards to %live',
        note: 'Pop %live, mark it live, and push the %x it depends on. The backward walk only follows operands, so it moves from results toward sources; %dead2 never enters the worklist because no root uses it.',
      },
      {
        title: 'Step 4 · Sweep %dead3',
        note: 'The worklist is empty, so every unmarked instruction is dead code. %dead3 is only used by itself, so it goes first: this step processes one instruction and removes exactly one IR line.',
      },
      {
        title: 'Step 5 · Sweep %dead2',
        note: 'With %dead3 gone, %dead2 loses its last user, but it was never live in the first marking round either. Delete it and %dead1 becomes unused as well.',
      },
      {
        title: 'Step 6 · Sweep %dead1 and reach the fixed point',
        note: 'Delete %dead1 last. Plain DCE needs repeated scans to discover this chain; ADCE sees the whole chain is unreachable from the roots in one pass. ADCE also removes unreachable blocks; this function only has entry, so the demo ends here.',
      },
    ],
  },
});
