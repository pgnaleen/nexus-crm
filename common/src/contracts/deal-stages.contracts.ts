import { IDealStage, IMainStage } from "../types";

export interface CreateMainStageRequest {
  name: string;
  position: number;
  isWon?: boolean;
  isLost?: boolean;
}

export type UpdateMainStageRequest = Partial<CreateMainStageRequest>;

export interface MainStageResponse extends IMainStage {
  /** Active (non-deleted) Sub Stages under this Main Stage -- deleting it cascades to these. */
  dependentCount: number;
}

export interface CreateDealStageRequest {
  name: string;
  sortOrder: number;
  isWon?: boolean;
  isLost?: boolean;
  mainStageId: string;
}

export type UpdateDealStageRequest = Partial<CreateDealStageRequest>;

export type DealStageResponse = IDealStage;
