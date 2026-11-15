import { makeDemo } from './types.ts';

const before = `
---
name: avx_dot
tracksRegLiveness: true
body: |
  bb.0.entry:
    liveins: $rdi, $rsi, $rbx
    $ymm0 = VMOVUPSYrm $rdi, 1, $noreg, 0, $noreg
    $ymm1 = VMOVUPSYrm $rsi, 1, $noreg, 0, $noreg
    $ymm0 = VMULPSYrr $ymm0, $ymm1, implicit $mxcsr
    $xmm1 = VEXTRACTF128rri $ymm0, 1
    $xmm1 = VADDPSrr $xmm1, $xmm1, implicit $mxcsr
    CALL64pcrel32 @sse_sum, csr_64, implicit $rdi
    $xmm0 = VADDSSrr $xmm0, $xmm0, implicit $mxcsr
    $ymm2 = VMOVUPSYrm $rbx, 1, $noreg, 0, $noreg
    $ymm2 = VADDPSYrr $ymm2, $ymm2, implicit $mxcsr
    RET64 $xmm0
`;

const guardedCall = `
---
name: avx_dot
tracksRegLiveness: true
body: |
  bb.0.entry:
    liveins: $rdi, $rsi, $rbx
    $ymm0 = VMOVUPSYrm $rdi, 1, $noreg, 0, $noreg
    $ymm1 = VMOVUPSYrm $rsi, 1, $noreg, 0, $noreg
    $ymm0 = VMULPSYrr $ymm0, $ymm1, implicit $mxcsr
    $xmm1 = VEXTRACTF128rri $ymm0, 1
    $xmm1 = VADDPSrr $xmm1, $xmm1, implicit $mxcsr
    VZEROUPPER
    CALL64pcrel32 @sse_sum, csr_64, implicit $rdi
    $xmm0 = VADDSSrr $xmm0, $xmm0, implicit $mxcsr
    $ymm2 = VMOVUPSYrm $rbx, 1, $noreg, 0, $noreg
    $ymm2 = VADDPSYrr $ymm2, $ymm2, implicit $mxcsr
    RET64 $xmm0
`;

const guardedAll = `
---
name: avx_dot
tracksRegLiveness: true
body: |
  bb.0.entry:
    liveins: $rdi, $rsi, $rbx
    $ymm0 = VMOVUPSYrm $rdi, 1, $noreg, 0, $noreg
    $ymm1 = VMOVUPSYrm $rsi, 1, $noreg, 0, $noreg
    $ymm0 = VMULPSYrr $ymm0, $ymm1, implicit $mxcsr
    $xmm1 = VEXTRACTF128rri $ymm0, 1
    $xmm1 = VADDPSrr $xmm1, $xmm1, implicit $mxcsr
    VZEROUPPER
    CALL64pcrel32 @sse_sum, csr_64, implicit $rdi
    $xmm0 = VADDSSrr $xmm0, $xmm0, implicit $mxcsr
    $ymm2 = VMOVUPSYrm $rbx, 1, $noreg, 0, $noreg
    $ymm2 = VADDPSYrr $ymm2, $ymm2, implicit $mxcsr
    VZEROUPPER
    RET64 $xmm0
`;

const dirty0 = [
  'ymm state  dirty',
  'last write VMOVUPSYrm $ymm0',
  'inserted   -',
].join('\n');

const dirty1 = [
  'ymm state  dirty',
  'last write VMOVUPSYrm $ymm1',
  'inserted   -',
].join('\n');

const dirtyMul = [
  'ymm state  dirty',
  'last write VMULPSYrr $ymm0',
  'inserted   -',
].join('\n');

const cleanCall = [
  'ymm state  clean (callee returns clean)',
  'inserted   VZEROUPPER before CALL64pcrel32',
].join('\n');

const cleanSse = [
  'ymm state  clean',
  'last write VADDSSrr (xmm only)',
  'inserted   VZEROUPPER before CALL64pcrel32',
].join('\n');

const dirty2 = [
  'ymm state  dirty',
  'last write VMOVUPSYrm $ymm2',
  'inserted   VZEROUPPER before CALL64pcrel32',
].join('\n');

const dirtyAdd = [
  'ymm state  dirty',
  'last write VADDPSYrr $ymm2',
  'inserted   VZEROUPPER before CALL64pcrel32',
].join('\n');

const cleanRet = [
  'ymm state  clean',
  'inserted   VZEROUPPER before CALL64pcrel32',
  'inserted   VZEROUPPER before RET64',
].join('\n');

export const x86InsertVZeroUpperDemo = makeDemo(
  'x86-insert-vzeroupper',
  'x86-insert-vzeroupper · x86-64',
  [
    {
      title: '第 1 步 · 第一条 256 位 load 把 YMM 写脏',
      note: 'pass 按块扫描，维护「当前 YMM 高位是不是脏」的状态。VMOVUPSYrm 写满 $ymm0 的 256 位，高位不再是零，状态从 clean 变成 dirty。',
      before,
      after: before,
      cursor: { line: '$ymm0 = VMOVUPSYrm $rdi, 1, $noreg, 0, $noreg' },
      focus: ['$ymm0 = VMOVUPSYrm $rdi, 1, $noreg, 0, $noreg'],
      state: dirty0,
    },
    {
      title: '第 2 步 · 第二条 256 位 load',
      note: '$ymm1 也被填满，状态仍是 dirty。MIR 打印时 VZEROUPPER 会带一长串 implicit-def $ymm0…$ymm15，演示里省略；这里只需要记住「高位是不是脏」。',
      before,
      after: before,
      cursor: { line: '$ymm1 = VMOVUPSYrm $rsi, 1, $noreg, 0, $noreg' },
      state: dirty1,
    },
    {
      title: '第 3 步 · 256 位乘法继续写脏',
      note: 'VMULPSYrr 写 $ymm0 的全部 256 位，之后 VEXTRACTF128rri 和 VADDPSrr 只读写 xmm 的低 128 位，不会把高位清零。所以到 call 之前，YMM 状态一直是 dirty。',
      before,
      after: before,
      cursor: { line: '$ymm0 = VMULPSYrr $ymm0, $ymm1, implicit $mxcsr' },
      focus: ['$ymm0 = VMULPSYrr $ymm0, $ymm1, implicit $mxcsr'],
      state: dirtyMul,
    },
    {
      title: '第 4 步 · 在脏状态下的调用前插 VZEROUPPER',
      note: '遇到 CALL64pcrel32 时状态是 dirty，而 callee 按 SSE 编译：如果直接把脏的 YMM 状态带过边界，callee 的 legacy SSE 指令会付 transition penalty。pass 在 call 前插入 VZEROUPPER，状态回到 clean；插入点在调用方，因为只有调用方知道自己脏不脏。',
      before,
      after: guardedCall,
      cursor: { line: 'CALL64pcrel32 @sse_sum, csr_64, implicit $rdi' },
      focus: ['VZEROUPPER', 'CALL64pcrel32 @sse_sum, csr_64, implicit $rdi'],
      state: cleanCall,
    },
    {
      title: '第 5 步 · 调用之后从 clean 继续',
      note: 'ABI 约定 callee 返回时 YMM 高位是干净的，所以 call 之后状态重置为 clean。VADDSSrr 只用 xmm0，不会弄脏高位，下一步仍然是 clean。',
      before: guardedCall,
      after: guardedCall,
      cursor: { line: '$xmm0 = VADDSSrr $xmm0, $xmm0, implicit $mxcsr' },
      focus: ['$xmm0 = VADDSSrr $xmm0, $xmm0, implicit $mxcsr'],
      state: cleanSse,
    },
    {
      title: '第 6 步 · 又一次 256 位 load',
      note: '$ymm2 被 256 位 load 填满，状态重新变脏。此时已经离上一次清零有一段距离，pass 必须重新跟踪，不能假设调用之后一直干净。',
      before: guardedCall,
      after: guardedCall,
      cursor: { line: '$ymm2 = VMOVUPSYrm $rbx, 1, $noreg, 0, $noreg' },
      focus: ['$ymm2 = VMOVUPSYrm $rbx, 1, $noreg, 0, $noreg'],
      state: dirty2,
    },
    {
      title: '第 7 步 · 256 位加法保持脏状态',
      note: 'VADDPSYrr 写 $ymm2 的 256 位，状态仍是 dirty。接下来是 RET64，函数边界同样要求干净。',
      before: guardedCall,
      after: guardedCall,
      cursor: { line: '$ymm2 = VADDPSYrr $ymm2, $ymm2, implicit $mxcsr' },
      focus: ['$ymm2 = VADDPSYrr $ymm2, $ymm2, implicit $mxcsr'],
      state: dirtyAdd,
    },
    {
      title: '第 8 步 · 返回前再清一次',
      note: 'RET64 前状态是 dirty，pass 再插一条 VZEROUPPER。这里返回的是 $xmm0：如果函数返回 $ymm0，这条不会插——VZEROUPPER 会把返回值的高位清零，反而破坏返回值。',
      before: guardedCall,
      after: guardedAll,
      cursor: { line: 'RET64 $xmm0' },
      focus: ['VZEROUPPER', 'RET64 $xmm0'],
      state: cleanRet,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · The first 256-bit load dirties YMM',
          note: 'The pass scans the block and tracks whether the upper YMM bits are dirty. VMOVUPSYrm fills all 256 bits of $ymm0, so the upper half is no longer zero and the state goes from clean to dirty.',
        },
        {
          title: 'Step 2 · A second 256-bit load',
          note: '$ymm1 is filled as well and the state stays dirty. A real MIR dump prints VZEROUPPER with a long list of implicit-def $ymm0…$ymm15, omitted here; all that matters is whether the upper bits are dirty.',
        },
        {
          title: 'Step 3 · A 256-bit multiply keeps it dirty',
          note: 'VMULPSYrr writes all 256 bits of $ymm0; VEXTRACTF128rri and VADDPSrr below only read and write the low 128 bits of xmm and never clear the upper half. So the YMM state stays dirty until the call.',
        },
        {
          title: 'Step 4 · Insert VZEROUPPER before the call in a dirty state',
          note: 'When the scan reaches CALL64pcrel32 the state is dirty, and the callee is compiled for SSE: carrying dirty YMM state across the boundary makes the callee’s legacy SSE instructions pay the transition penalty. The pass inserts VZEROUPPER before the call and the state becomes clean; the insertion point is the caller, because only the caller knows whether its upper bits are dirty.',
        },
        {
          title: 'Step 5 · Continue from clean after the call',
          note: 'The ABI says the upper YMM bits are clean when the callee returns, so the state resets to clean after the call. VADDSSrr only uses xmm0 and cannot dirty the upper half, so the next step is still clean.',
        },
        {
          title: 'Step 6 · Another 256-bit load',
          note: '$ymm2 is filled by a 256-bit load and the state becomes dirty again. The pass has to start tracking anew after the call; it cannot assume the block stays clean.',
        },
        {
          title: 'Step 7 · A 256-bit add stays dirty',
          note: 'VADDPSYrr writes all 256 bits of $ymm2, so the state is still dirty. The next instruction is RET64, and a function boundary must be clean too.',
        },
        {
          title: 'Step 8 · Clean once more before returning',
          note: 'The state is dirty at RET64, so the pass inserts another VZEROUPPER. This function returns $xmm0; if it returned $ymm0 there would be no insertion, because VZEROUPPER would zero the upper bits of the returned value.',
        },
      ],
    },
  },
  { format: 'mir' },
);
