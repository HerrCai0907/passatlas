import type { Locale } from '../i18n/config';

export type CategoryId =
  | 'dataflow'
  | 'scalar'
  | 'loop'
  | 'interproc'
  | 'vectorize'
  | 'codegen';

export interface Category {
  zh: string;
  en: string;
  description: Record<Locale, string>;
}

export const categories: Record<CategoryId, Category> = {
  dataflow: {
    zh: '数据流与内存',
    en: 'Dataflow & Memory',
    description: {
      zh: '把值从内存搬进寄存器，让依赖关系显式化：SSA 构造、内存提升、别名分析。',
      en: 'Move values from memory into registers so dependencies become explicit: SSA construction, promotion, alias analysis.',
    },
  },
  scalar: {
    zh: '标量优化',
    en: 'Scalar',
    description: {
      zh: '指令级的代数化简、冗余消除、常量传播——编译器最日常的那一层。',
      en: 'Instruction-level algebraic simplification, redundancy elimination and constant propagation — the compiler’s daily bread.',
    },
  },
  loop: {
    zh: '循环优化',
    en: 'Loop',
    description: {
      zh: '识别循环结构，化简归纳变量，为展开与向量化做准备。',
      en: 'Recognise loop structure, simplify induction variables and prepare for unrolling and vectorisation.',
    },
  },
  interproc: {
    zh: '跨函数优化',
    en: 'Interprocedural',
    description: {
      zh: '内联、函数属性推导、跨过程的常量传播。',
      en: 'Inlining, function attribute inference and interprocedural constant propagation.',
    },
  },
  vectorize: {
    zh: '向量化',
    en: 'Vectorization',
    description: {
      zh: '把标量循环改写成 SIMD 指令，用一条指令处理多个元素。',
      en: 'Rewrite scalar loops with SIMD instructions so one instruction handles several elements.',
    },
  },
  codegen: {
    zh: '代码生成准备',
    en: 'Codegen Prep',
    description: {
      zh: 'SelectionDAG 之前的规范化、合法化与指令选择辅助。',
      en: 'Normalisation, legalisation and instruction-selection support before SelectionDAG.',
    },
  },
};

export const categoryOrder: CategoryId[] = [
  'dataflow',
  'scalar',
  'loop',
  'interproc',
  'vectorize',
  'codegen',
];

/** 分类名按当前语言取；分类 id 永远是英文标识符 */
export function categoryName(id: CategoryId, locale: Locale): string {
  return categories[id][locale];
}

export function categoryDescription(id: CategoryId, locale: Locale): string {
  return categories[id].description[locale];
}

export const difficultyLabels: Record<Locale, readonly string[]> = {
  zh: ['', '入门', '进阶', '硬核'],
  en: ['', 'Intro', 'Intermediate', 'Advanced'],
};

export function difficultyLabel(level: number, locale: Locale): string {
  return difficultyLabels[locale][level] ?? '';
}
