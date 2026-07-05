import type { Deal } from "@/types";

export const OPEN_DEAL_STAGES = [
  "PROSPECT",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
] as const;

export const PIPELINE_BOARD_STAGES = [...OPEN_DEAL_STAGES, "WON"] as const;

export const DEAL_STAGE_OPTIONS = [...PIPELINE_BOARD_STAGES, "LOST"] as const;

export type PipelineStage = (typeof PIPELINE_BOARD_STAGES)[number];

export function isOpenDealStage(stage: string) {
  return OPEN_DEAL_STAGES.includes(stage as (typeof OPEN_DEAL_STAGES)[number]);
}

export function sumDealValues(deals: Deal[]) {
  return deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
}

export function getPipelineValue(deals: Deal[]) {
  return sumDealValues(deals.filter((deal) => isOpenDealStage(deal.stage)));
}
