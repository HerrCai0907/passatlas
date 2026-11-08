/**
 * 零依赖的 IR 解析 / 布局测试：Node 24 直接运行 TypeScript。
 * 运行：npm run test:ir
 */
import assert from 'node:assert/strict';
import { makeStep } from '../src/demos/types.ts';
import { diffInstructions, instructionKey } from '../src/lib/ir/diff.ts';
import { functionToIR, parseIR } from '../src/lib/ir/parse.ts';
import { layoutCFG } from '../src/lib/ir/layout.ts';

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

  const commented = parseIR(
    'define void @f() {\nentry: ; 入口\n  ; 整行注释\n  ret void ; 返回\n}\n',
  );
  assert.equal(commented.functions[0].blocks.length, 1);
  assert.equal(commented.functions[0].blocks[0].instructions.length, 1);
  assert.equal(commented.functions[0].blocks[0].instructions[0].text, 'ret void');
}

console.log('IR parser & CFG layout: all assertions passed');
