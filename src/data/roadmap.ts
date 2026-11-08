import type { CategoryId } from '../lib/categories';

export interface RoadmapItem {
  name: string;
  zh: string;
  category: CategoryId;
  note: string;
}

/**
 * 尚未上线的 pass。这里只是规划清单，不会生成页面；
 * 真正开始写某一篇时，把它从这里移到 src/content/passes/ 并从本文件删除。
 */
export const roadmap: RoadmapItem[] = [
  {
    name: 'SROA',
    zh: '聚合体标量化',
    category: 'dataflow',
    note: '先把结构体与数组拆成标量，mem2reg 才有机会接手。',
  },
  {
    name: 'GVN',
    zh: '全局值编号',
    category: 'scalar',
    note: '用值编号识别等价表达式，跨基本块消除冗余计算。',
  },
  {
    name: 'SCCP',
    zh: '稀疏条件常量传播',
    category: 'scalar',
    note: '沿 SSA 边传播常量，顺带判定哪些分支永远不可达。',
  },
  {
    name: 'LICM',
    zh: '循环不变量外提',
    category: 'loop',
    note: '把循环里每次结果都相同的计算搬到 preheader。',
  },
  {
    name: 'loop-unroll',
    zh: '循环展开',
    category: 'loop',
    note: '复制循环体，减少分支与索引开销，为向量化铺路。',
  },
  {
    name: 'SLPVectorizer',
    zh: 'SLP 向量化',
    category: 'vectorize',
    note: '把相邻的同构标量指令打包成向量指令。',
  },
  {
    name: 'loop-vectorize',
    zh: '循环向量化',
    category: 'vectorize',
    note: '把整个循环改写成 SIMD 版本，并处理尾循环。',
  },
  {
    name: 'isel',
    zh: '指令选择',
    category: 'codegen',
    note: 'SelectionDAG 把 IR 映射到目标机器指令。',
  },
];
