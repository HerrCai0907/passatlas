/**
 * 零依赖的 IR 解析 / 布局测试：Node 24 直接运行 TypeScript。
 * 运行：npm run test:ir
 */
import assert from 'node:assert/strict';
import { cfgSamples, localizeSample } from '../src/data/cfg-samples.ts';
import { machineSnapshots, machineStages } from '../src/data/machine.ts';
import { pipelineStages } from '../src/data/pipeline.ts';
import { getDemo } from '../src/demos/registry.ts';
import { makeDemo, makeStep } from '../src/demos/types.ts';
import { localizedPath, pathWithoutLocale } from '../src/i18n/paths.ts';
import { t } from '../src/i18n/ui.ts';
import { diffInstructions, instructionKey } from '../src/lib/ir/diff.ts';
import { canRenderCFG, functionToIR, parseIR } from '../src/lib/ir/parse.ts';
import { layoutCFG } from '../src/lib/ir/layout.ts';
import { tokenizeIR, highlightToHtml } from '../src/lib/ir/highlight.ts';
import { parseSource } from '../src/lib/ir/source.ts';
import { parseMIR } from '../src/lib/mir/parse.ts';

const diamond = `define i32 @pick(i1 %c) {
entry:
  %slot = alloca i32, align 4
  br i1 %c, label %then, label %else

then:
  store i32 1, ptr %slot, align 4
  br label %merge

else:
  store i32 2, ptr %slot, align 4
  br label %merge

merge:
  %v = load i32, ptr %slot, align 4
  ret i32 %v
}
`;

const loopIR = `define i32 @sum(i32 %n) {
entry:
  br label %loop

loop:
  %i = phi i32 [ 0, %entry ], [ %i.next, %body ]
  %cond = icmp slt i32 %i, %n
  br i1 %cond, label %body, label %exit

body:
  %i.next = add i32 %i, 1
  br label %loop

exit:
  ret i32 %i
}
`;

const switchIR = `define i32 @classify(i32 %x) {
entry:
  switch i32 %x, label %other [
    i32 0, label %zero
    i32 1, label %one
    i32 2, label %two
  ]

zero:
  ret i32 10

one:
  ret i32 20

two:
  ret i32 30

other:
  ret i32 -1
}
`;

const scanIR = `define i32 @scan(ptr %p, i32 %n) {
entry:
  br label %cond

cond:
  %i = phi i32 [ 0, %entry ], [ %next, %inc ]
  %cmp = icmp slt i32 %i, %n
  br i1 %cmp, label %body, label %exit

body:
  %v = load i32, ptr %p, align 4
  %iszero = icmp eq i32 %v, 0
  br i1 %iszero, label %done, label %inc

inc:
  %next = add i32 %i, 1
  br label %cond

done:
  ret i32 %v

exit:
  ret i32 -1

dead:
  ret i32 0
}
`;

// ---- 基本切块 ----
{
  const parsed = parseIR(diamond);
  assert.equal(parsed.issues.length, 0, '菱形样例不应有解析问题');
  assert.equal(parsed.functions.length, 1);

  const fn = parsed.functions[0];
  assert.equal(fn.name, 'pick');
  assert.deepEqual(
    fn.blocks.map((block) => block.label),
    ['entry', 'then', 'else', 'merge'],
  );
  assert.equal(fn.edges.length, 4);
  assert.deepEqual(fn.edges.map((edge) => edge.kind).sort(), [
    'branch',
    'branch',
    'false',
    'true',
  ]);
  assert.ok(fn.blocks[0].terminator?.text.startsWith('br i1'));

  const graph = layoutCFG(fn);
  assert.equal(graph.blocks.length, 4);
  assert.ok(graph.width > 0 && graph.height > 0);

  const byLabel = new Map(graph.blocks.map((block) => [block.label, block]));
  assert.ok(byLabel.get('then').rank > byLabel.get('entry').rank);
  assert.ok(byLabel.get('merge').rank > byLabel.get('then').rank);
  // 菱形汇合：merge 必须排在 then/else 之后，且两条分支边都不是回边
  assert.equal(graph.edges.filter((edge) => edge.back).length, 0);
}

// ---- 行级 diff：focus 行不带缩进也能命中 ----
{
  const step = makeStep({
    title: '只观察',
    note: '',
    before: `define i32 @f() {
  ret i32 1
}
`,
    after: `define i32 @f() {
  ret i32 1
}
`,
    focus: ['ret i32 1'],
  });
  assert.equal(step.before.find((line) => line.text.trim() === 'ret i32 1')?.mark, 'focus');
  assert.equal(step.after.find((line) => line.text.trim() === 'ret i32 1')?.mark, 'focus');
}

// ---- 指令级 diff：CFG 视图的增删标记 ----
{
  const source = (comment = '') => `define i32 @f(i32 %x) {
entry:
  %dead = mul i32 %x, 7${comment}
  %live = add i32 %x, 1${comment}
  %cmp = icmp sgt i32 %live, 0${comment}
  ret i32 %live${comment}
}
`;
  const before = parseIR(source()).functions[0];
  const after = parseIR(`define i32 @f(i32 %x) {
entry:
  %live = add i32 %x, 1
  ret i32 %live
}
`).functions[0];

  const diff = diffInstructions(before, after);
  assert.equal(diff.removed, 2);
  assert.equal(diff.added, 0);
  assert.equal(diff.before.get(instructionKey('entry', 0)), 'del');
  assert.equal(diff.before.get(instructionKey('entry', 2)), 'del');
  assert.equal(diff.before.get(instructionKey('entry', 1)), undefined);
  assert.equal(diff.after.size, 0);

  // focus 只升级两侧都保留的指令，删除/新增优先
  const framed = diffInstructions(before, after, [
    '%live = add i32 %x, 1',
    '%dead = mul i32 %x, 7',
  ]);
  assert.equal(framed.before.get(instructionKey('entry', 1)), 'focus');
  assert.equal(framed.after.get(instructionKey('entry', 0)), 'focus');
  assert.equal(framed.before.get(instructionKey('entry', 0)), 'del');

  // 只改注释时，解析后的指令没有变化，CFG 不应出现红绿标记
  const commented = parseIR(source('  ; 讲解用注释')).functions[0];
  const commentOnly = diffInstructions(parseIR(source()).functions[0], commented);
  assert.equal(commentOnly.added, 0);
  assert.equal(commentOnly.removed, 0);
}

// ---- 文本视图：序列化后仍能解析回同样的块 ----
{
  const fn = parseIR(diamond).functions[0];
  const again = parseIR(functionToIR(fn)).functions[0];
  assert.equal(again.blocks.length, fn.blocks.length);
  assert.deepEqual(
    again.blocks.map((block) => block.instructions.map((instruction) => instruction.text)),
    fn.blocks.map((block) => block.instructions.map((instruction) => instruction.text)),
  );
}

// ---- 循环：回边与秩 ----
{
  const fn = parseIR(loopIR).functions[0];
  const graph = layoutCFG(fn);
  const backEdges = graph.edges.filter((edge) => edge.back);
  assert.equal(backEdges.length, 1);
  assert.equal(backEdges[0].from, 'body');
  assert.equal(backEdges[0].to, 'loop');

  const loop = graph.blocks.find((block) => block.label === 'loop');
  const body = graph.blocks.find((block) => block.label === 'body');
  assert.ok(loop && body && loop.rank < body.rank);
}

// ---- switch 的 default 与 case 标签 ----
{
  const fn = parseIR(switchIR).functions[0];
  assert.equal(fn.blocks.length, 5);
  assert.equal(fn.edges.length, 4);
  assert.deepEqual(
    fn.edges.map((edge) => edge.label),
    ['default', '0', '1', '2'],
  );
}

// ---- 不可达基本块放到最后一层 ----
{
  const graph = layoutCFG(parseIR(scanIR).functions[0]);
  const dead = graph.blocks.find((block) => block.label === 'dead');
  const maxRank = Math.max(...graph.blocks.map((block) => block.rank));
  assert.equal(dead.rank, maxRank);
}

// ---- 错误处理 ----
{
  const broken = parseIR('define i32 @f() {\nentry:\n  %x = add i32 1, 2\n');
  assert.ok(broken.issues.some((issue) => issue.message.includes('缺少结尾')));
  assert.ok(broken.issues.some((issue) => issue.message.includes('没有终结指令')));

  const badJump = parseIR('define void @f() {\nentry:\n  br label %nope\n}\n');
  assert.ok(badJump.issues.some((issue) => issue.message.includes('不存在')));
  assert.equal(badJump.functions[0].edges.length, 0);
}

// ---- 多函数与注释 ----
{
  const two = parseIR(
    'define void @a() {\nentry:\n  ret void\n}\n\ndefine void @b() {\nentry:\n  ret void\n}\n',
  );
  assert.equal(two.functions.length, 2);

  // CFG 一次只画一个函数：多函数 IR 不能再提供 CFG 模式
  assert.equal(canRenderCFG(parseIR(diamond)), true);
  assert.equal(canRenderCFG(two), false);

  const commented = parseIR(
    'define void @f() {\nentry: ; 入口\n  ; 整行注释\n  ret void ; 返回\n}\n',
  );
  assert.equal(commented.functions[0].blocks.length, 1);
  assert.equal(commented.functions[0].blocks[0].instructions.length, 1);
  assert.equal(commented.functions[0].blocks[0].instructions[0].text, 'ret void');
}

// ---- 多函数演示：播放器必须禁用 CFG 模式 ----
{
  const toIR = (lines) => lines.map((line) => line.text).join('\n');
  const demo = getDemo('inline-function', 'zh');
  const multi = demo.steps.some((step) =>
    [step.before, step.after].some((lines) => !canRenderCFG(parseIR(toIR(lines)))),
  );
  assert.equal(multi, true, 'inline-function 演示包含多函数 IR');

  const single = getDemo('mem2reg', 'zh');
  assert.ok(
    single.steps.every((step) =>
      [step.before, step.after].every((lines) => canRenderCFG(parseIR(toIR(lines)))),
    ),
    '单函数演示应继续使用 CFG 模式',
  );
}

// ---- 算法状态：快照逐步 diff，新增行标绿，高度按最长快照预留 ----
{
  const demo = makeDemo('state', 'state', [
    {
      title: '一',
      note: '',
      before: 'define void @f() {\nentry:\n  ret void\n}',
      after: 'define void @f() {\nentry:\n  ret void\n}',
      state: 'slot  color\n.0    -',
    },
    {
      title: '二',
      note: '',
      before: 'define void @f() {\nentry:\n  ret void\n}',
      after: 'define void @f() {\nentry:\n  ret void\n}',
      state: 'slot  color\n.0    0',
    },
    {
      title: '三',
      note: '',
      before: 'define void @f() {\nentry:\n  ret void\n}',
      after: 'define void @f() {\nentry:\n  ret void\n}',
      state: 'slot  color\n.0    0\n.1    1',
    },
  ]);
  assert.equal(demo.stateMaxLines, 3);
  assert.equal(demo.steps[0].state[1].mark, 'keep');
  assert.equal(demo.steps[1].state[1].mark, 'add');
  assert.equal(demo.steps[2].state[1].mark, 'keep');
  assert.equal(demo.steps[2].state[2].mark, 'add');
  assert.equal(demo.steps[2].state.length, 3);
}

// ---- cursor：指向当前处理的指令，一步最多一个，构建期解析成面板行号 ----
{
  const source = {
    title: 'cursor',
    note: '',
    before: 'define void @f() {\nentry:\n  %x = add i32 1, 2\n  ret void\n}',
    after: 'define void @f() {\nentry:\n  %x = add i32 1, 2\n  ret void\n}',
  };
  const onBefore = makeStep({ ...source, cursor: { line: '%x = add i32 1, 2' } });
  assert.equal(onBefore.cursor.side, 'before');
  assert.equal(onBefore.cursor.index, 2);
  assert.equal(onBefore.cursor.line.trim(), '%x = add i32 1, 2');

  const onAfter = makeStep({ ...source, cursor: { line: 'ret void', side: 'after' } });
  assert.equal(onAfter.cursor.side, 'after');
  assert.equal(onAfter.cursor.index, 3);

  assert.throws(
    () => makeStep({ ...source, cursor: { line: '%missing' } }),
    /cursor not found/,
  );
}

// ---- 播放器高度预留：maxLines 取所有步骤、两侧的最大行数 ----
{
  const demo = makeDemo('height', 'height', [
    {
      title: '短',
      note: '',
      before: 'define void @f() {\nentry:\n  ret void\n}',
      after: 'define void @f() {\nentry:\n  ret void\n}',
    },
    {
      title: '长',
      note: '',
      before: 'define void @f() {\nentry:\n  %x = add i32 1, 2\n  ret void\n}',
      after: 'define void @f() {\nentry:\n  ret void\n}',
    },
  ]);
  assert.equal(demo.maxLines, 5);
  assert.equal(demo.stateMaxLines, 0);
}


// ---- i18n：路径前缀、文案回退与内容本地化 ----
{
  assert.equal(localizedPath('/passes/mem2reg/', 'zh'), '/passes/mem2reg/');
  assert.equal(localizedPath('/passes/mem2reg/', 'en'), '/en/passes/mem2reg/');
  assert.equal(localizedPath('/', 'en'), '/en/');
  assert.equal(pathWithoutLocale('/en/passes/mem2reg/', 'en'), '/passes/mem2reg/');
  assert.equal(pathWithoutLocale('/passes/mem2reg/', 'zh'), '/passes/mem2reg/');

  assert.equal(t('zh', 'nav.passes'), '图鉴');
  assert.equal(t('en', 'nav.passes'), 'Passes');
  assert.equal(t('en', 'cfg.metaBlocks', { blocks: 3, edges: 4 }), 'Basic blocks: 3 · control-flow edges: 4');
  assert.equal(t('zh', 'cfg.metaBlocks', { blocks: 3, edges: 4 }), '3 个基本块 · 4 条控制流边');

  const zhDemo = getDemo('mem2reg', 'zh');
  const enDemo = getDemo('mem2reg', 'en');
  assert.ok(zhDemo && enDemo);
  assert.equal(zhDemo.steps.length, enDemo.steps.length);
  assert.match(zhDemo.steps[0].title, /第 1 步/);
  assert.match(enDemo.steps[0].title, /^Step 1/);
  assert.ok(enDemo.steps.every((step) => Array.isArray(step.before)));
  assert.deepEqual(
    enDemo.steps.map((step) => step.before.map((line) => line.text)),
    zhDemo.steps.map((step) => step.before.map((line) => line.text)),
  );

  const enSample = localizeSample(cfgSamples[0], 'en');
  assert.equal(enSample.label, 'Diamond branch');
  assert.equal(localizeSample(cfgSamples[0], 'zh').label, '菱形分支');

  const brokenEn = parseIR('define i32 @f() {\nentry:\n  %x = add i32 1, 2\n', 'en');
  assert.ok(brokenEn.issues.some((issue) => issue.message.includes('missing its closing')));
  assert.ok(brokenEn.issues.some((issue) => issue.message.includes('has no terminator')));
}

// ---- Machine IR：两条目标线、管线接入与 MIR 演示 ----
{
  const ids = machineStages.map((stage) => stage.id);
  assert.deepEqual(ids, ['isel', 'ssa', 'pre-ra', 'ra', 'post-ra', 'emit']);

  for (const stage of machineStages) {
    assert.ok(stage.shared.length > 0, `${stage.id} 应有共享 pass`);
    assert.ok(stage.lanes['x86-64'].length > 0, `${stage.id} 应有 x86-64 lane`);
    assert.ok(stage.lanes.aarch64.length > 0, `${stage.id} 应有 AArch64 lane`);
  }

  const byId = (id) => machineStages.find((stage) => stage.id === id);
  assert.ok(byId('isel').lanes['x86-64'].some((item) => item.name === 'x86-isel' && item.label === 'X86DAGToDAGISel'));
  assert.ok(byId('isel').lanes.aarch64.some((item) => item.name === 'aarch64-isel' && item.label === 'AArch64DAGToDAGISel'));
  assert.ok(byId('ra').shared.some((item) => item.name === 'greedy' && item.page === 'regalloc'));
  assert.ok(byId('pre-ra').shared.some((item) => item.name === 'phi-node-elimination' && item.page === 'phi-elim'));

  const codegenStages = pipelineStages.filter((stage) => stage.level === 'codegen');
  assert.ok(codegenStages.some((stage) => stage.id === 'codegen-isel'));
  assert.ok(codegenStages.some((stage) => stage.id === 'codegen-ra'));
  const machineNodes = codegenStages.flatMap((stage) => stage.passes).filter((item) => item.mir);
  assert.ok(machineNodes.length > 40, '主图应接入完整的 Machine IR 阶段');
  assert.ok(
    machineNodes.every((item) => !item.targets || item.targets.every((t) => t === 'x86-64' || t === 'aarch64')),
    'target 徽标只能是 x86-64 或 aarch64',
  );

  const isel = machineSnapshots.find((snapshot) => snapshot.id === 'isel');
  assert.ok(isel.before.includes('define i32 @scale'));
  assert.match(isel.targets['x86-64'], /LEA32r/);
  assert.match(isel.targets.aarch64, /ADDWrs/);
  assert.match(machineSnapshots.find((snapshot) => snapshot.id === 'ra').targets['x86-64'], /\$eax/);
  assert.match(machineSnapshots.find((snapshot) => snapshot.id === 'ra').targets.aarch64, /\$w0/);

  for (const id of ['isel', 'phi-elim', 'regalloc', 'machine-function-splitter', 'stack-slot-coloring']) {
    const zh = getDemo(id, 'zh');
    const en = getDemo(id, 'en');
    assert.ok(zh && en, `${id} 演示应存在`);
    assert.equal(zh.format, 'mir', `${id} 应标记为 MIR`);
    assert.ok(zh.steps.length >= 2, `${id} 至少两步`);
    assert.equal(zh.steps.length, en.steps.length, `${id} 中英文步骤数一致`);
    assert.ok(zh.steps.every((step) => step.before.length > 0 && step.after.length > 0));
    assert.match(zh.steps[0].title, /第 1 步/);
    assert.match(en.steps[0].title, /^Step 1/);
  }

  const ssc = getDemo('stack-slot-coloring', 'zh');
  assert.ok(ssc, 'stack-slot-coloring 演示应存在');
  assert.ok(ssc.stateMaxLines >= 5, '栈槽着色演示应带算法状态');
  assert.ok(ssc.steps.every((step) => (step.state?.length ?? 0) > 0), '每一步都应有状态快照');
  assert.ok(
    ssc.steps.some((step) => step.state.some((line) => line.mark === 'add')),
    '状态快照应显示新增的中间状态',
  );
  assert.ok(ssc.steps.every((step) => step.cursor), '栈槽着色每一步都应有 cursor');
  assert.ok(
    ssc.steps.every((step) => {
      const lines = step.cursor.side === 'before' ? step.before : step.after;
      return step.cursor.index >= 0 && step.cursor.index < lines.length;
    }),
    'cursor 必须落在对应面板的行号范围内',
  );
}

// ---- Machine IR：独立解析器、successors / 跳转目标与 CFG ----
{
  const toIR = (lines) => lines.map((line) => line.text).join('\n');
  const pickMIR = toIR(getDemo('phi-elim', 'zh').steps[0].before);
  const parsed = parseMIR(pickMIR);
  assert.equal(parsed.issues.length, 0, 'phi-elim 的 MIR 不应有解析问题');
  assert.equal(parsed.functions.length, 1);

  const fn = parsed.functions[0];
  assert.equal(fn.name, 'pick');
  assert.ok(fn.source.includes('body: |'));
  assert.deepEqual(fn.blocks.map((block) => block.id), [
    'bb.0.entry',
    'bb.1.then',
    'bb.2.else',
    'bb.3.merge',
    'bb.4.other',
  ]);
  assert.deepEqual(
    fn.edges.map((edge) => `${edge.from}>${edge.to}:${edge.kind}`),
    [
      'bb.0.entry>bb.1.then:branch',
      'bb.0.entry>bb.2.else:taken',
      'bb.1.then>bb.3.merge:branch',
      'bb.2.else>bb.3.merge:taken',
      'bb.2.else>bb.4.other:branch',
    ],
  );

  const graph = layoutCFG(fn);
  assert.equal(graph.blocks.length, 5);
  assert.equal(graph.edges.filter((edge) => edge.back).length, 0);

  // 没有 successors 行时，条件跳转后的下一个块要补一条 fallthrough
  const splitter = parseMIR(
    toIR(getDemo('machine-function-splitter', 'zh').steps[0].before),
  ).functions[0];
  const hot = splitter.edges.find((edge) => edge.to === 'bb.1.hot');
  const cold = splitter.edges.find((edge) => edge.to === 'bb.2.cold');
  assert.equal(hot?.kind, 'fallthrough');
  assert.equal(cold?.kind, 'taken');

  // 块属性属于标签的一部分：MFS 只改属性，指令不变
  const splitStep = parseMIR(
    toIR(getDemo('machine-function-splitter', 'zh').steps[1].after),
  ).functions[0];
  assert.equal(
    splitStep.blocks.find((block) => block.id === 'bb.2.cold')?.label,
    'bb.2.cold (bbsections Cold)',
  );

  // MIR 循环：body 的 JMP 是回边
  const loopSample = cfgSamples.find((sample) => sample.id === 'mir-loop');
  assert.ok(loopSample && loopSample.format === 'mir');
  const loopFn = parseMIR(loopSample.ir).functions[0];
  const loopGraph = layoutCFG(loopFn);
  const backEdges = loopGraph.edges.filter((edge) => edge.back);
  assert.equal(backEdges.length, 1);
  assert.equal(backEdges[0].from, 'bb.2.body');
  assert.equal(backEdges[0].to, 'bb.1.loop');

  // 按格式分发：同一个入口不会把 MIR 喂给 LLVM IR 解析器
  assert.equal(parseSource(pickMIR, 'mir').functions[0].name, 'pick');
  assert.equal(parseSource(diamond, 'llvm-ir').functions[0].name, 'pick');
  assert.equal(canRenderCFG(parseMIR(pickMIR)), true);

  const brokenMIR = parseMIR('---\nname: f\nbody: |\n  bb.0:\n    JMP_1 %bb.9\n');
  assert.ok(brokenMIR.issues.some((issue) => issue.message.includes('不存在')));
}

// ---- 两种 IR 的高亮方案：token 可无损拼回原文，且 MIR 用独立 token 类 ----
{
  const join = (tokens) => tokens.map((token) => token.text).join('');
  const mirLine = '    %0:gr32 = COPY $edi';
  const mirTokens = tokenizeIR(mirLine, 'mir');
  assert.equal(join(mirTokens), mirLine);
  assert.ok(mirTokens.some((token) => token.kind === 'value' && token.text === '%0'));
  assert.ok(mirTokens.some((token) => token.kind === 'class' && token.text === 'gr32'));
  assert.ok(mirTokens.some((token) => token.kind === 'register' && token.text === '$edi'));
  assert.ok(mirTokens.some((token) => token.kind === 'opcode' && token.text === 'COPY'));

  const mirJump = tokenizeIR('    JCC_1 %bb.2.else, 5, implicit $eflags', 'mir');
  assert.equal(join(mirJump), '    JCC_1 %bb.2.else, 5, implicit $eflags');
  assert.ok(mirJump.some((token) => token.kind === 'control' && token.text === 'JCC_1'));
  assert.ok(mirJump.some((token) => token.kind === 'label' && token.text === '%bb.2.else'));

  const llvmLine = '  br i1 %c, label %then, label %else';
  const llvmTokens = tokenizeIR(llvmLine, 'llvm-ir');
  assert.equal(join(llvmTokens), llvmLine);
  assert.ok(llvmTokens.some((token) => token.kind === 'control' && token.text === 'br'));
  assert.ok(llvmTokens.some((token) => token.kind === 'type' && token.text === 'i1'));
  assert.ok(llvmTokens.some((token) => token.kind === 'value' && token.text === '%c'));

  const html = highlightToHtml('define void @f() {', 'llvm-ir');
  assert.match(html, /ir-tok--keyword">define/);
  assert.ok(!highlightToHtml('<script>alert(1)</script>', 'mir').includes('<script>'));
}

console.log('IR parser, CFG layout, Machine IR & i18n: all assertions passed');
