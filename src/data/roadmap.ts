import type { Locale } from '../i18n/config';
import type { CategoryId } from '../lib/categories';

export interface RoadmapItem {
  name: string;
  category: CategoryId;
  /** 各语言的短名 */
  title: Record<Locale, string>;
  /** 各语言的一句话说明 */
  note: Record<Locale, string>;
}

/**
 * 尚未上线的 pass。这里只是规划清单，不会生成页面；
 * 真正开始写某一篇时，把它从这里移到 src/content/passes/<locale>/ 并从本文件删除。
 */
export const roadmap: RoadmapItem[] = [
  {
    name: 'SROA',
    title: { zh: '聚合体标量化', en: 'Aggregate scalarisation' },
    category: 'dataflow',
    note: {
      zh: '先把结构体与数组拆成标量，mem2reg 才有机会接手。',
      en: 'Split structs and arrays into scalars so mem2reg can take over.',
    },
  },
  {
    name: 'GVN',
    title: { zh: '全局值编号', en: 'Global value numbering' },
    category: 'scalar',
    note: {
      zh: '用值编号识别等价表达式，跨基本块消除冗余计算。',
      en: 'Number values to find equivalent expressions and remove redundant work across blocks.',
    },
  },
  {
    name: 'SCCP',
    title: { zh: '稀疏条件常量传播', en: 'Sparse conditional constant propagation' },
    category: 'scalar',
    note: {
      zh: '沿 SSA 边传播常量，顺带判定哪些分支永远不可达。',
      en: 'Propagate constants along SSA edges and prove which branches are unreachable.',
    },
  },
  {
    name: 'LICM',
    title: { zh: '循环不变量外提', en: 'Loop-invariant code motion' },
    category: 'loop',
    note: {
      zh: '把循环里每次结果都相同的计算搬到 preheader。',
      en: 'Hoist computations that yield the same result on every iteration into the preheader.',
    },
  },
  {
    name: 'loop-unroll',
    title: { zh: '循环展开', en: 'Loop unrolling' },
    category: 'loop',
    note: {
      zh: '复制循环体，减少分支与索引开销，为向量化铺路。',
      en: 'Replicate the loop body to cut branch and index overhead and prepare for vectorisation.',
    },
  },
  {
    name: 'SLPVectorizer',
    title: { zh: 'SLP 向量化', en: 'SLP vectorisation' },
    category: 'vectorize',
    note: {
      zh: '把相邻的同构标量指令打包成向量指令。',
      en: 'Pack adjacent isomorphic scalar instructions into vector instructions.',
    },
  },
  {
    name: 'loop-vectorize',
    title: { zh: '循环向量化', en: 'Loop vectorisation' },
    category: 'vectorize',
    note: {
      zh: '把整个循环改写成 SIMD 版本，并处理尾循环。',
      en: 'Rewrite a whole loop as a SIMD version and handle the tail iterations.',
    },
  },
  {
    name: 'isel',
    title: { zh: '指令选择', en: 'Instruction selection' },
    category: 'codegen',
    note: {
      zh: 'SelectionDAG 把 IR 映射到目标机器指令。',
      en: 'SelectionDAG maps IR to target machine instructions.',
    },
  },
];
