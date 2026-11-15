import { makeDemo } from './types.ts';

const input = `
define i32 @dispatch(ptr %fn, ptr %dst, i64 %n, i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %hot, label %cold
hot:
  %r = call i32 %fn(i32 %x)
  br label %merge
cold:
  call void @llvm.memcpy.p0.p0.i64(ptr %dst, ptr %dst, i64 %n, i1 false)
  br label %merge
merge:
  %v = phi i32 [ %r, %hot ], [ 0, %cold ]
  ret i32 %v
}
`;

const hotCounter = `
define i32 @dispatch(ptr %fn, ptr %dst, i64 %n, i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %hot, label %cold
hot:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)
  %r = call i32 %fn(i32 %x)
  br label %merge
cold:
  call void @llvm.memcpy.p0.p0.i64(ptr %dst, ptr %dst, i64 %n, i1 false)
  br label %merge
merge:
  %v = phi i32 [ %r, %hot ], [ 0, %cold ]
  ret i32 %v
}
`;

const bothCounters = `
define i32 @dispatch(ptr %fn, ptr %dst, i64 %n, i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %hot, label %cold
hot:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)
  %r = call i32 %fn(i32 %x)
  br label %merge
cold:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 1)
  call void @llvm.memcpy.p0.p0.i64(ptr %dst, ptr %dst, i64 %n, i1 false)
  br label %merge
merge:
  %v = phi i32 [ %r, %hot ], [ 0, %cold ]
  ret i32 %v
}
`;

const withTarget = `
define i32 @dispatch(ptr %fn, ptr %dst, i64 %n, i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %hot, label %cold
hot:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)
  %target = ptrtoint ptr %fn to i64
  %r = call i32 %fn(i32 %x)
  br label %merge
cold:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 1)
  call void @llvm.memcpy.p0.p0.i64(ptr %dst, ptr %dst, i64 %n, i1 false)
  br label %merge
merge:
  %v = phi i32 [ %r, %hot ], [ 0, %cold ]
  ret i32 %v
}
`;

const withIcall = `
define i32 @dispatch(ptr %fn, ptr %dst, i64 %n, i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %hot, label %cold
hot:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)
  %target = ptrtoint ptr %fn to i64
  call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %target, i32 0, i32 0)
  %r = call i32 %fn(i32 %x)
  br label %merge
cold:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 1)
  call void @llvm.memcpy.p0.p0.i64(ptr %dst, ptr %dst, i64 %n, i1 false)
  br label %merge
merge:
  %v = phi i32 [ %r, %hot ], [ 0, %cold ]
  ret i32 %v
}
`;

const output = `
define i32 @dispatch(ptr %fn, ptr %dst, i64 %n, i32 %x) {
entry:
  %c = icmp sgt i32 %x, 0
  br i1 %c, label %hot, label %cold
hot:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)
  %target = ptrtoint ptr %fn to i64
  call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %target, i32 0, i32 0)
  %r = call i32 %fn(i32 %x)
  br label %merge
cold:
  call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 1)
  call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %n, i32 1, i32 0)
  call void @llvm.memcpy.p0.p0.i64(ptr %dst, ptr %dst, i64 %n, i1 false)
  br label %merge
merge:
  %v = phi i32 [ %r, %hot ], [ 0, %cold ]
  ret i32 %v
}
`;

const cfg = [
  'blocks 4   edges 5   counters 2',
  'tree   entry hot cold',
  'count  entry->hot   index 0',
  'count  entry->cold  index 1',
  'value  -',
].join('\n');

const hotCounted = [
  'blocks 4   edges 5   counters 2',
  'count  entry->hot   index 0  inserted',
  'count  entry->cold  index 1',
  'value  -',
].join('\n');

const allCounted = [
  'blocks 4   edges 5   counters 2',
  'count  entry->hot   index 0  inserted',
  'count  entry->cold  index 1  inserted',
  'value  -',
].join('\n');

const target = [
  'count  entry->hot   index 0  inserted',
  'count  entry->cold  index 1  inserted',
  'value  icall %fn   kind 0  target %target',
].join('\n');

const icall = [
  'count  entry->hot   index 0  inserted',
  'count  entry->cold  index 1  inserted',
  'value  icall %fn   kind 0  recorded',
].join('\n');

const memop = [
  'count  entry->hot   index 0  inserted',
  'count  entry->cold  index 1  inserted',
  'value  icall %fn   kind 0  recorded',
  'value  memop %n    kind 1  recorded',
].join('\n');

export const pgoInstrGenDemo = makeDemo('pgo-instr-gen', 'pgo-instr-gen', [
  {
    title: '第 1 步 · 算清楚要几个计数器',
    note: 'PGOInstrumentationGen 先建 CFG 的生成树，再决定把计数器放在哪些边上：4 个块、5 条边，生成树有 3 条边，剩下 2 条需要计数。hot 和 cold 的入口各拿一个索引，入口计数由两者相加得到。',
    before: input,
    after: input,
    cursor: { line: 'br i1 %c, label %hot, label %cold' },
    focus: ['br i1 %c, label %hot, label %cold'],
    state: cfg,
  },
  {
    title: '第 2 步 · 给 entry→hot 插计数器',
    note: '在 hot 的开头插入 llvm.instrprof.increment，索引 0 表示函数内的第一个计数器。指向函数名的指针和 64 位函数哈希让 runtime 能把计数写回正确的函数记录。',
    before: input,
    after: hotCounter,
    cursor: {
      line: 'call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)',
      side: 'after',
    },
    focus: ['call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 0)'],
    state: hotCounted,
  },
  {
    title: '第 3 步 · 给 entry→cold 插计数器',
    note: 'cold 的入口插入索引 1 的计数器。两个计数器相加就是函数入口执行次数；第二次编译时 reader 把它们解成 function_entry_count 和每条边的 branch_weights。',
    before: hotCounter,
    after: bothCounters,
    cursor: {
      line: 'call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 1)',
      side: 'after',
    },
    focus: ['call void @llvm.instrprof.increment(ptr @__profn_dispatch, i64 170957022131388415, i32 2, i32 1)'],
    state: allCounted,
  },
  {
    title: '第 4 步 · 为间接调用取出目标地址',
    note: 'profile 想知道这个间接调用实际落到谁身上。先把 callee 指针 ptrtoint 成 i64，runtime 记录的原始地址在读取 profile 时再换成函数名的 64 位 hash。',
    before: bothCounters,
    after: withTarget,
    cursor: { line: '%target = ptrtoint ptr %fn to i64', side: 'after' },
    focus: ['%target = ptrtoint ptr %fn to i64'],
    state: target,
  },
  {
    title: '第 5 步 · 记录间接调用的目标（value kind 0）',
    note: '在 call 前插入 llvm.instrprof.value.profile，value kind 为 0、索引 0。它只在调用点之前采样，不改变调用本身；消费这份数据的是 pgo-icall-prom。',
    before: withTarget,
    after: withIcall,
    cursor: {
      line: 'call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %target, i32 0, i32 0)',
      side: 'after',
    },
    focus: ['call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %target, i32 0, i32 0)'],
    state: icall,
  },
  {
    title: '第 6 步 · 记录 memcpy 实际拿到的长度（value kind 1）',
    note: '变长的内存 intrinsic 再插一个 value.profile，value kind 为 1、索引 0，值是 %n。消费它的是 pgo-memop-opt：热长度会被拆成常量 case，再交给 SelectionDAG 展开。',
    before: withIcall,
    after: output,
    cursor: {
      line: 'call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %n, i32 1, i32 0)',
      side: 'after',
    },
    focus: ['call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %n, i32 1, i32 0)'],
    state: memop,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Work out how many counters are needed',
        note: 'PGOInstrumentationGen first builds a spanning tree of the CFG and then decides which edges carry counters: 4 blocks and 5 edges, 3 edges in the tree, so 2 need counting. The hot and cold entries get one index each, and the function entry count is their sum.',
      },
      {
        title: 'Step 2 · Add a counter for entry→hot',
        note: 'An llvm.instrprof.increment goes at the start of hot; index 0 is the first counter in the function. The pointer to the function name and the 64-bit function hash let the runtime write the count into the right function record.',
      },
      {
        title: 'Step 3 · Add a counter for entry→cold',
        note: 'Cold gets the counter with index 1. Adding both counters gives the function entry count; on the second build the reader turns them into function_entry_count and per-edge branch_weights.',
      },
      {
        title: 'Step 4 · Materialise the indirect-call target',
        note: 'The profile wants to know which callee this indirect call reaches. ptrtoint turns the callee pointer into i64; when the profile is read, the raw address is turned into a 64-bit hash of the function name.',
      },
      {
        title: 'Step 5 · Record the indirect-call target (value kind 0)',
        note: 'Insert llvm.instrprof.value.profile before the call with value kind 0 and index 0. It samples only at the call site and does not change the call; pgo-icall-prom consumes the data.',
      },
      {
        title: 'Step 6 · Record the length memcpy actually receives (value kind 1)',
        note: 'A variable-length memory intrinsic gets another value.profile with value kind 1, index 0, and %n as the value. pgo-memop-opt consumes it: hot sizes become constant cases and SelectionDAG expands them.',
      },
    ],
  },
});
