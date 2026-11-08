import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const passes = defineCollection({
  loader: glob({ base: './src/content/passes', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    /** pass 的正式名字，显示为标题，如 mem2reg */
    title: z.string(),
    /** 中文名，一行解释 */
    zh: z.string(),
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
  }),
});

export const collections = { passes };
