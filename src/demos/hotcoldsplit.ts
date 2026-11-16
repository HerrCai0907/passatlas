import { makeDemo } from './types.ts';

const before = `
define i32 @read(ptr %p, i1 %ok) {
entry:
  br i1 %ok, label %load, label %fail
load:
  %v = load i32, ptr %p
  ret i32 %v
fail:
  %msg = call ptr @format_error()
  call void @log_error(ptr %msg)
  br label %cleanup
cleanup:
  %code = call i32 @error_code()
  ret i32 %code
}
declare ptr @format_error()
declare void @log_error(ptr) cold
declare i32 @error_code()
`;

const after = `
define i32 @read(ptr %p, i1 %ok) {
entry:
  br i1 %ok, label %load, label %codeRepl
load:
  %v = load i32, ptr %p
  ret i32 %v
codeRepl:
  %0 = call i32 @read.cold.1() noinline
  ret i32 %0
}
define internal i32 @read.cold.1() cold minsize {
  %msg = call ptr @format_error()
  call void @log_error(ptr %msg)
  %code = call i32 @error_code()
  ret i32 %code
}
declare ptr @format_error()
declare void @log_error(ptr) cold
declare i32 @error_code()
`;

const detected = [
  'block     cold   evidence',
  'entry     no     -',
  'load      no     -',
  'fail      yes    cold call @log_error',
  'cleanup   no     -',
].join('\n');

const region = [
  'sink       %fail',
  'preds      %entry    not post-dominated by %fail',
  'succs      %cleanup  dominated by %fail',
  'region     %fail %cleanup',
  'entries    1',
].join('\n');

const profitable = [
  'inputs      0',
  'outputs     0',
  'params      0        <= max 4',
  'benefit     3        non-terminator instrs',
  'penalty     2        threshold + 2*params',
  'split       yes',
].join('\n');

const extracted = [
  'extract     %fail %cleanup -> @read.cold.1',
  'inputs      0',
  'return      i32 %code',
  'rewire      entry -> codeRepl',
  'block       codeRepl: call + ret',
].join('\n');

const marked = [
  'function    @read.cold.1',
  'attrs       cold minsize',
  'entrycount  0',
  'call        noinline',
  'section     __llvm_cold  with -enable-cold-section',
].join('\n');

export const hotColdSplitDemo = makeDemo('hotcoldsplit', 'hotcoldsplit', [
  {
    title: '第 1 步 · 找出冷块：冷调用',
    note: 'HotColdSplitting 先按 RPO 扫每个基本块。%fail 调用了带 cold 属性的 @log_error，静态分析直接把它判冷；entry 和 load 不满足任何冷块条件。RPO 里第一个冷块 %fail 就是这一轮的 sink。',
    before,
    after: before,
    cursor: { line: 'call void @log_error(ptr %msg)' },
    focus: ['call void @log_error(ptr %msg)'],
    state: detected,
  },
  {
    title: '第 2 步 · 从 sink 长出单入口冷区域',
    note: '以 %fail 为 sink 做两次 DFS：反向只保留被 sink 后支配的前驱，entry 还能走到热路径，所以不进来；正向收下被 sink 支配的后继，%cleanup 因此并入区域。整条错误路径被收进一个只有 %fail 一个入口的区域。',
    before,
    after: before,
    cursor: { line: '%msg = call ptr @format_error()' },
    focus: [
      '%msg = call ptr @format_error()',
      'call void @log_error(ptr %msg)',
      'br label %cleanup',
      '%code = call i32 @error_code()',
    ],
    state: region,
  },
  {
    title: '第 3 步 · 用收益 / 代价决定拆不拆',
    note: 'CodeExtractor 先数清区域需要几个输入输出：这里不引用外部值，参数为 0。收益是 3 条非终结指令的 code-size 成本；代价是默认阈值 2 加上每个参数的搬运成本，一共 2。3 > 2，值得拆。把 -hotcoldsplit-threshold 调到 0 可以跳过这一步。',
    before,
    after: before,
    cursor: { line: '%code = call i32 @error_code()' },
    focus: [
      '%msg = call ptr @format_error()',
      'call void @log_error(ptr %msg)',
      '%code = call i32 @error_code()',
    ],
    state: profitable,
  },
  {
    title: '第 4 步 · CodeExtractor 把区域搬成 cold 函数',
    note: '区域整体搬进 @read.cold.1：没有输入，%code 作为返回值。原函数里进入 %fail 的边改接到新的 codeRepl 块，块里只有一条调用和一条 ret。冷路径从此变成真正的函数调用，寄存器和栈帧也分开了。',
    before,
    after,
    cursor: { line: '%0 = call i32 @read.cold.1() noinline', side: 'after' },
    focus: ['codeRepl:', '%0 = call i32 @read.cold.1() noinline'],
    state: extracted,
  },
  {
    title: '第 5 步 · 盖上 cold / minsize，交给链接器',
    note: '新函数立刻带上 cold 和 minsize，entry count 置 0，调用点再加 noinline，防止后续内联把冷代码拉回热函数。配合 function sections 和 profile，后端会把它和冷代码放在一起；-enable-cold-section 则把它直接放进 __llvm_cold。这里没有 .text.split，那是 machine-function-splitter 在 MIR 里做的事。',
    before: after,
    after,
    cursor: {
      line: 'define internal i32 @read.cold.1() cold minsize {',
      side: 'after',
    },
    focus: [
      'define internal i32 @read.cold.1() cold minsize {',
      '%0 = call i32 @read.cold.1() noinline',
    ],
    state: marked,
  },
], {
  en: {
    steps: [
      {
        title: 'Step 1 · Find a cold block: the cold call',
        note: 'HotColdSplitting walks the function in RPO order. %fail calls @log_error, which carries the cold attribute, so static analysis marks it cold; entry and load satisfy no cold condition. The first cold block in RPO order, %fail, becomes the sink for this round.',
      },
      {
        title: 'Step 2 · Grow a single-entry cold region around the sink',
        note: 'Two DFS walks start from %fail: the reverse walk keeps only predecessors post-dominated by the sink, so entry stays out because it can still reach the hot path; the forward walk keeps successors dominated by the sink, which pulls %cleanup in. The whole error path ends up in a region with exactly one entry.',
      },
      {
        title: 'Step 3 · Weigh benefit against penalty',
        note: 'CodeExtractor first counts the inputs and outputs the region needs: it references no outside value, so there are zero parameters. The benefit is the code-size cost of three non-terminator instructions; the penalty is the default threshold of 2 plus the cost of materialising each parameter, also 2. Since 3 > 2, splitting pays off. Setting -hotcoldsplit-threshold to 0 skips this check.',
      },
      {
        title: 'Step 4 · CodeExtractor moves the region into a cold function',
        note: 'The region moves into @read.cold.1 as a unit: no inputs, with %code returned. Edges that entered %fail now target a new codeRepl block containing just one call and one ret. The cold path has become a real function call with its own registers and frame.',
      },
      {
        title: 'Step 5 · Stamp on cold / minsize and hand it to the linker',
        note: 'The new function immediately gets cold and minsize, its entry count is set to 0, and the call site gets noinline so a later inliner cannot pull the cold code back. With function sections and profile data the backend groups it with other cold code; -enable-cold-section puts it in __llvm_cold directly. There is no .text.split here: that is what machine-function-splitter does in Machine IR, after this pass has already split the function at IR level.',
      },
    ],
  },
});
