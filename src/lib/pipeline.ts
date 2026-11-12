import { pipelineStages, type PipelineStage } from '../data/pipeline.ts';
import { passPageAlias } from './passes.ts';

/** 管线图里一个阶段面板的锚点 id，/passes 与 pass 详情页共用。 */
export function stageAnchor(stageId: string): string {
  return `stage-${stageId}`;
}

/** MachineTrack 里同一阶段的详细锚点，和管线图的面板区分开。 */
export function machineStageAnchor(stageId: string): string {
  return `machine-${stageId}`;
}

/** 管线节点对应的页面 slug；注册名和页面名不同时以 page / alias 为准。 */
export function pipelinePageSlug(item: { name: string; page?: string }): string {
  return item.page ?? passPageAlias[item.name] ?? item.name;
}

/**
 * 一个 pass 在默认管线里出现的所有阶段，按管线顺序返回。
 * 同一个 pass 可能出现在多个阶段（如 regalloc 在 pre-ra 与 ra 各一次）。
 */
export function stagesForPass(
  slug: string,
  stages: PipelineStage[] = pipelineStages,
): PipelineStage[] {
  return stages.filter((stage) =>
    stage.passes.some((item) => pipelinePageSlug(item) === slug),
  );
}

/** 阶段主图里的序号（从 1 开始），与 PipelineMap 面板上的 01、02 一致。 */
export function pipelineStageNumber(
  stageId: string,
  stages: PipelineStage[] = pipelineStages,
): number {
  return stages.findIndex((stage) => stage.id === stageId) + 1;
}
