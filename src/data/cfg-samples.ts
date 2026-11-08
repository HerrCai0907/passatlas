import type { Locale } from '../i18n/config';

export interface CFGSample {
  id: string;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
  ir: string;
}

/** 传给客户端组件的形状：文案已经按当前语言展开，避免把两套文案都塞进 island */
export interface LocalizedCFGSample {
  id: string;
  label: string;
  description: string;
  ir: string;
}

/** CFG 实验室的预置示例；也是 pass 页面里嵌图用的数据源 */
export const cfgSamples: CFGSample[] = [
  {
    id: 'diamond',
    label: { zh: '菱形分支', en: 'Diamond branch' },
    description: {
      zh: '一个 if/else 汇合：两条分支分别 store，merge 处一次 load。',
      en: 'An if/else merge: both arms store and the merge block loads once.',
    },
    ir: `define i32 @pick(i1 %c) {
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
`,
  },
  {
    id: 'loop',
    label: { zh: '循环与 φ', en: 'Loop and φ' },
    description: {
      zh: '循环头部的两个 φ，回边用虚线标出，可以看到归纳变量的闭环。',
      en: 'Two phis in the loop header; the dashed back edge closes the induction-variable cycle.',
    },
    ir: `define i32 @sum(i32 %n) {
entry:
  br label %loop

loop:
  %i = phi i32 [ 0, %entry ], [ %i.next, %body ]
  %acc = phi i32 [ 0, %entry ], [ %acc.next, %body ]
  %cond = icmp slt i32 %i, %n
  br i1 %cond, label %body, label %exit

body:
  %acc.next = add i32 %acc, %i
  %i.next = add i32 %i, 1
  br label %loop

exit:
  ret i32 %acc
}
`,
  },
  {
    id: 'switch',
    label: { zh: 'switch 多路', en: 'switch dispatch' },
    description: {
      zh: 'switch 的 default 与每个 case 都会成为一条边，边上标着 case 的常量。',
      en: 'The switch default and every case become an edge labelled with the case constant.',
    },
    ir: `define i32 @classify(i32 %x) {
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
`,
  },
  {
    id: 'scan',
    label: { zh: '提前退出', en: 'Early exit' },
    description: {
      zh: '带 break 的循环：done 是提前返回，exit 是正常结束，dead 永远不可达。',
      en: 'A loop with a break: done returns early, exit ends normally, and dead is unreachable.',
    },
    ir: `define i32 @scan(ptr %p, i32 %n) {
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
`,
  },
];

export function localizeSample(sample: CFGSample, locale: Locale): LocalizedCFGSample {
  return {
    id: sample.id,
    label: sample.label[locale],
    description: sample.description[locale],
    ir: sample.ir,
  };
}

export function localizeSamples(samples: CFGSample[], locale: Locale): LocalizedCFGSample[] {
  return samples.map((sample) => localizeSample(sample, locale));
}

export const diamondSample = cfgSamples[0]!;
