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
  description: string;
}

export const categories: Record<CategoryId, Category> = {
  dataflow: {
    zh: '数据流与内存',
    en: 'Dataflow & Memory',
    description: '把值从内存搬进寄存器，让依赖关系显式化：SSA 构造、内存提升、别名分析。',
  },
  scalar: {
    zh: '标量优化',
    en: 'Scalar',
    description: '指令级的代数化简、冗余消除、常量传播——编译器最日常的那一层。',
  },
  loop: {
    zh: '循环优化',
    en: 'Loop',
    description: '识别循环结构，化简归纳变量，为展开与向量化做准备。',
  },
  interproc: {
    zh: '跨函数优化',
    en: 'Interprocedural',
    description: '内联、函数属性推导、跨过程的常量传播。',
  },
  vectorize: {
    zh: '向量化',
    en: 'Vectorization',
    description: '把标量循环改写成 SIMD 指令，用一条指令处理多个元素。',
  },
  codegen: {
    zh: '代码生成准备',
    en: 'Codegen Prep',
    description: 'SelectionDAG 之前的规范化、合法化与指令选择辅助。',
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

export const difficultyLabels = ['', '入门', '进阶', '硬核'];
