import { IDealStage, IMainStage } from "../types";

export interface CreateMainStageRequest {
  name: string;
  position: number;
}

export type UpdateMainStageRequest = Partial<CreateMainStageRequest>;

export type MainStageResponse = IMainStage;

export interface CreateDealStageRequest {
  name: string;
  sortOrder: number;
  isWon?: boolean;
  isLost?: boolean;
  mainStageId: string;
}

export type UpdateDealStageRequest = Partial<CreateDealStageRequest>;

export type DealStageResponse = IDealStage;
