import { defaultLocale, type Locale } from '../i18n/config.ts';
import type { Demo } from './types.ts';
import { localizeDemo } from './types.ts';
import { dceDemo } from './dce.ts';
import { heroDemo } from './hero.ts';
import { inlineFunctionDemo } from './inline-function.ts';
import { instcombineDemo } from './instcombine.ts';
import { iselDemo } from './isel.ts';
import { loopReduceDemo } from './loop-reduce.ts';
import { mem2regDemo } from './mem2reg.ts';
import { pgoInstrGenDemo } from './pgo-instr-gen.ts';
import { phiElimDemo } from './phi-elim.ts';
import { regallocDemo } from './regalloc.ts';
import { sampleProfileInlineDemo } from './sample-profile-inline.ts';

/**
 * pass 内容里的 frontmatter `demo: <id>` 通过这里找到对应的分步演示。
 * 新增演示 = 写一个 demos/<id>.ts + 在这里注册 + 在 makeDemo 的第四个参数里补英文文案。
 */
export const demos: Record<string, Demo> = {
  dce: dceDemo,
  hero: heroDemo,
  'inline-function': inlineFunctionDemo,
  instcombine: instcombineDemo,
  isel: iselDemo,
  'loop-reduce': loopReduceDemo,
  mem2reg: mem2regDemo,
  'pgo-instr-gen': pgoInstrGenDemo,
  'phi-elim': phiElimDemo,
  regalloc: regallocDemo,
  'sample-profile-inline': sampleProfileInlineDemo,
};

export function getDemo(id?: string, locale: Locale = defaultLocale): Demo | undefined {
  if (!id) return undefined;
  const demo = demos[id];
  return demo ? localizeDemo(demo, locale) : undefined;
}
