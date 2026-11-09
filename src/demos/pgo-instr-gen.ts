import { makeDemo } from './types.ts';

const inputIR = `
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

const countersIR = `
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

const indirectIR = `
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

const memopIR = `
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

export const pgoInstrGenDemo = makeDemo('pgo-instr-gen', 'pgo-instr-gen', [
  {
    title: '第 1 步 · 在 CFG 边上放计数器',
    note: 'PGOInstrumentationGen 在树外的边上插 llvm.instrprof.increment：hot / cold 各一个，index 是函数内的计数器编号。第二次编译时，这些计数会被解成 function_entry_count 与每一条分支的 branch_weights。',
    before: inputIR,
    after: countersIR,
  },
  {
    title: '第 2 步 · 记录间接调用落到了谁',
    note: '每个间接调用点前插入 value.profile，value kind 为 0：先把 callee 指针转成 i64，runtime 记录目标地址，profile reader 再换成函数名的 64 位 hash。消费者是 pgo-icall-prom。',
    before: countersIR,
    after: indirectIR,
    focus: ['call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %target, i32 0, i32 0)'],
  },
  {
    title: '第 3 步 · 记录 memcpy 实际拿到的长度',
    note: '变长的内存 intrinsic 再插一个 value.profile，value kind 为 1，值是 size。消费它的是 pgo-memop-opt：热长度会被拆成常量 case，再交给 SelectionDAG 展开。',
    before: indirectIR,
    after: memopIR,
    focus: ['call void @llvm.instrprof.value.profile(ptr @__profn_dispatch, i64 170957022131388415, i64 %n, i32 1, i32 0)'],
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Put counters on CFG edges',
        note: 'PGOInstrumentationGen inserts llvm.instrprof.increment on non-tree edges: one for hot, one for cold, with the index identifying the counter inside the function. On the second build these counts become function_entry_count and branch_weights.',
      },
      {
        title: 'Step 2 · Record where an indirect call lands',
        note: 'Before each indirect call it inserts value.profile with value kind 0: the callee pointer is converted to i64, the runtime records the target address, and the profile reader turns it into a 64-bit hash of the function name. The consumer is pgo-icall-prom.',
      },
      {
        title: 'Step 3 · Record the size received by memcpy',
        note: 'A variable-length memory intrinsic gets another value.profile, value kind 1, with the size as the value. pgo-memop-opt consumes it: hot sizes become constant cases and SelectionDAG expands them.',
      },
    ],
  },
});
