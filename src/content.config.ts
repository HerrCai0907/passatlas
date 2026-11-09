import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * 内容按语言放在子目录里：
 *   src/content/passes/zh/mem2reg.mdx  → /passes/mem2reg/
 *   src/content/passes/en/mem2reg.mdx  → /en/passes/mem2reg/
 * 文件名（id 最后一段）在两种语言之间必须一致，上一篇 / 下一篇和语言选择器靠它配对。
 */
const passSchema = z.object({
  /** pass 的正式名字，显示为标题，如 mem2reg */
  title: z.string(),
  /** 当前语言的短名，一行解释，如「内存到寄存器提升」/ “Memory to register promotion” */
  subtitle: z.string(),
  /** 卡片与 meta description 用的一句话 */
  summary: z.string(),
  category: z.enum(['dataflow', 'scalar', 'loop', 'interproc', 'vectorize', 'codegen']),
  difficulty: z.number().int().min(1).max(3),
  /** ready 才会生成页面；draft 只存在于草稿分支 */
  status: z.enum(['ready', 'draft']).default('ready'),
  order: z.number().default(100),
  /** 该 pass 出现在哪些优化级别里 */
  stage: z.array(z.enum(['-O0', '-O1', '-O2', '-O3', '-Os'])).default([]),
  tags: z.array(z.string()).default([]),
  /** src/demos/registry.ts 里的演示 id */
  demo: z.string().optional(),
  /** src/data/cfg-samples.ts 里的示例 id，用于在页面上画控制流图 */
  cfg: z.string().optional(),
  /** LLVM 源码路径，如 llvm/lib/Transforms/Utils/Mem2Reg.cpp */
  source: z.string().optional(),
  updated: z.coerce.date().optional(),
});

const passes = defineCollection({
  loader: glob({ base: './src/content/passes', pattern: '**/*.{md,mdx}' }),
  schema: passSchema,
});

/**
 * IR PGO 的采样点不是 pass，单独用一个集合：
 *   src/content/pgo/zh/basic-block.mdx  → /pgo/basic-block/
 *   src/content/pgo/en/basic-block.mdx  → /en/pgo/basic-block/
 * 结构化的事实（采样什么、写成什么、喂给谁）在 src/data/pgo.ts；
 * 这里只放正文与每页自己的标题、摘要、排序。
 */
const pgoSchema = z.object({
  /** 采样点的标识符，如 function-entry */
  title: z.string(),
  /** 当前语言的短名，如「函数入口计数」 */
  subtitle: z.string(),
  /** 列表与 meta description 用的一句话 */
  summary: z.string(),
  status: z.enum(['ready', 'draft']).default('ready'),
  order: z.number().default(100),
  /** LLVM 源码路径，页面底部给出固定 commit 的链接 */
  source: z.string().optional(),
  updated: z.coerce.date().optional(),
});

const pgo = defineCollection({
  loader: glob({ base: './src/content/pgo', pattern: '**/*.{md,mdx}' }),
  schema: pgoSchema,
});

export const collections = { passes, pgo };
