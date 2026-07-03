export type AgentMenuView = 'tasks' | 'timeline' | 'activity' | 'history' | 'command';
export type AgentDossierTab = 'profile' | 'tasks' | 'chat';

export interface AgentKpiMetric {
  label: string;
  weight: number;
  score: number;
}

export interface AgentTask {
  id: string;
  title: string;
  progress: number;
  status: 'running' | 'idle' | 'done' | 'blocked';
}

export interface AiAgent {
  id: string;
  name: string;
  role: string;
  roleTh: string;
  description: string;
  avatarColor: string;
  skinTone: string;
  shirtColor: string;
  position: { x: number; y: number };
  capacity: number;
  progress: number;
  kpiScore: number;
  currentTask: string;
  kpiMetrics: AgentKpiMetric[];
  tasks: AgentTask[];
  chatIntro: string;
  featureKey?: string;
  /** เชื่อม LLM จริง — ตอนนี้รองรับ gemini สำหรับ QB Analyst */
  llmProvider?: 'gemini';
}
