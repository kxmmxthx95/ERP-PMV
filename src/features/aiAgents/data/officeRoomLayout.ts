/** Top-down office room layout — positions are % of the inner floor area */

export interface RoomRect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OFFICE_WALL_INSET = { top: 6, left: 5, right: 5, bottom: 8 } as const;

export const OFFICE_FURNITURE: RoomRect[] = [
  { id: 'desk-1', label: 'Desk', x: 10, y: 14, w: 14, h: 10 },
  { id: 'desk-2', label: 'Desk', x: 10, y: 32, w: 14, h: 10 },
  { id: 'monitor-1', label: 'Monitor', x: 12, y: 12, w: 8, h: 5 },
  { id: 'monitor-2', label: 'Monitor', x: 12, y: 30, w: 8, h: 5 },
  { id: 'meeting', label: 'Meeting table', x: 38, y: 22, w: 24, h: 14 },
  { id: 'cabinet', label: 'Cabinet', x: 78, y: 12, w: 12, h: 18 },
  { id: 'kpi-board', label: 'KPI Board', x: 52, y: 8, w: 18, h: 10 },
  { id: 'plant-1', label: 'Plant', x: 8, y: 72, w: 7, h: 7 },
  { id: 'plant-2', label: 'Plant', x: 84, y: 68, w: 7, h: 7 },
  { id: 'cooler', label: 'Water cooler', x: 88, y: 38, w: 5, h: 12 },
  { id: 'sofa', label: 'Lounge', x: 68, y: 58, w: 18, h: 10 },
];

export const OFFICE_AGENT_ZONES: Record<string, { x: number; y: number }> = {
  'question-bank-analyst': { x: 22, y: 28 },
  'exam-proctor': { x: 50, y: 32 },
  'attendance-scribe': { x: 72, y: 48 },
  'curriculum-mapper': { x: 42, y: 58 },
};
