export const OPEN_DEAL_STAGES = [
  'PROSPECT',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
] as const;

export const CLOSED_DEAL_STAGES = ['WON', 'LOST'] as const;

export const DEAL_STAGES = [...OPEN_DEAL_STAGES, ...CLOSED_DEAL_STAGES] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export function isOpenDealStage(stage: string): stage is (typeof OPEN_DEAL_STAGES)[number] {
  return OPEN_DEAL_STAGES.includes(stage as (typeof OPEN_DEAL_STAGES)[number]);
}
