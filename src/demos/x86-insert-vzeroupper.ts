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

export const x86InsertVZeroUpperDemo = makeDemo(
  'x86-insert-vzeroupper',
  'x86-insert-vzeroupper · x86-64',
  [
    {
      title: '第 1 步 · AVX 把高位写脏',
      note: '两条 256 位 load 填满 $ymm0/$ymm1，VMULPSYrr 之后高 128 位非零。紧接着是一条没有保护的 CALL64pcrel32，callee 用 SSE 编译：此刻 YMM 状态是 dirty，边界上却什么都没有。MIR 打印时 VZEROUPPER 会带一长串 implicit-def $ymm0…$ymm15，演示里省略。',
      before,
      after: before,
      focus: [
        '$ymm0 = VMULPSYrr $ymm0, $ymm1, implicit $mxcsr',
        'CALL64pcrel32 @sse_sum, csr_64, implicit $rdi',
      ],
    },
    {
      title: '第 2 步 · 调用前清一次',
      note: 'pass 在第一个“入口状态为脏”的调用前插 VZEROUPPER，状态回到 clean。插入点在 call 之前，而不是 callee 内部：只有调用方知道自己的高位是不是脏的。',
      before,
      after: guardedCall,
    },
    {
      title: '第 3 步 · 返回前再清一次',
      note: '调用返回后按约定状态是干净的，但后面又用 256 位 load/add 弄脏了 YMM，所以 RET64 前再插一条。如果返回的是 $ymm0，这条不会插——VZEROUPPER 会把返回值的高位清零。',
      before: guardedCall,
      after: guardedAll,
    },
  ],
  {
    en: {
      steps: [
        {
          title: 'Step 1 · AVX leaves the upper bits dirty',
          note: 'Two 256-bit loads fill $ymm0/$ymm1, and after VMULPSYrr the upper 128 bits are non-zero. The next instruction is an unguarded CALL64pcrel32 into a function compiled with SSE: the YMM state is dirty and the boundary has nothing on it. A real MIR dump prints VZEROUPPER with a long list of implicit-def $ymm0…$ymm15; the demo omits it.',
        },
        {
          title: 'Step 2 · Clean once before the call',
          note: 'The pass inserts VZEROUPPER before the first call reached in a dirty state, and the state goes back to clean. The insertion point is before the call, not inside the callee: only the caller knows whether its upper bits are dirty.',
        },
        {
          title: 'Step 3 · Clean again before the return',
          note: 'After the call the state is clean by convention, but the 256-bit load/add below dirties YMM again, so RET64 gets its own VZEROUPPER. If the function returned $ymm0 there would be no insertion — VZEROUPPER would zero the returned value’s upper bits.',
        },
      ],
    },
  },
  { format: 'mir' },
);
