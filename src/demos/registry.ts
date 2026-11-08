import type { Demo } from './types';
import { dceDemo } from './dce';
import { heroDemo } from './hero';
import { inlinerDemo } from './inliner';
import { instcombineDemo } from './instcombine';
import { mem2regDemo } from './mem2reg';

/**
 * pass 内容里的 frontmatter `demo: <id>` 通过这里找到对应的分步演示。
 * 新增演示 = 写一个 demos/<id>.ts + 在这里注册。
 */
export const demos: Record<string, Demo> = {
  dce: dceDemo,
  hero: heroDemo,
  inliner: inlinerDemo,
  instcombine: instcombineDemo,
  mem2reg: mem2regDemo,
};

export function getDemo(id?: string): Demo | undefined {
  return id ? demos[id] : undefined;
}
