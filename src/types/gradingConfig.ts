// src/types/gradingConfig.ts
export interface GradingConfig {
  /** sysadmin-controlled global switch — lets teachers add a manual bonus % to grades */
  bonusScoreEnabled: boolean;
}

export const DEFAULT_GRADING_CONFIG: GradingConfig = {
  bonusScoreEnabled: false,
};
