/**
 * T-Score (มาตรฐานการศึกษาไทย)
 * T = 50 + 10 × (X − μ) / σ
 * — μ, σ จากกลุ่มคะแนนที่มีค่า (ข้าม null)
 * — σ ใช้ sample SD (n−1) เมื่อ n ≥ 2
 * — σ = 0 หรือ n < 2 → T = 50
 */

export type TScoreStats = {
  mean: number;
  sd: number;
  n: number;
};

export function computeMeanSd(values: number[]): TScoreStats | null {
  const vals = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { mean, sd: 0, n };
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance), n };
}

/** คะแนนดิบ → T-Score (ทศนิยม 1 ตำแหน่ง) */
export function toTScore(raw: number, stats: TScoreStats | null): number | null {
  if (!Number.isFinite(raw) || !stats) return null;
  if (stats.sd <= 0 || stats.n < 2) return 50;
  const t = 50 + (10 * (raw - stats.mean)) / stats.sd;
  return Math.round(t * 10) / 10;
}

/**
 * แปลงเมทริกซ์คะแนนเป็น T-Score ต่อคอลัมน์
 * — stats คำนวณจากทุกคนในกลุ่มที่มีคะแนนคอลัมน์นั้น
 */
export function mapScoresToTScores(
  students: Array<{ scores: Record<string, number | null> }>,
  columnKeys: string[],
): {
  statsByColumn: Record<string, TScoreStats | null>;
  tScoresByStudent: Record<string, number | null>[];
} {
  const statsByColumn: Record<string, TScoreStats | null> = {};
  for (const key of columnKeys) {
    const vals = students
      .map((s) => s.scores[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    statsByColumn[key] = computeMeanSd(vals);
  }

  const tScoresByStudent = students.map((s) => {
    const out: Record<string, number | null> = {};
    for (const key of columnKeys) {
      const raw = s.scores[key];
      out[key] =
        typeof raw === 'number' && Number.isFinite(raw)
          ? toTScore(raw, statsByColumn[key])
          : null;
    }
    return out;
  });

  return { statsByColumn, tScoresByStudent };
}

/**
 * แปลงคะแนนดิบ (%) → T-Score ต่อกลุ่ม (เช่น ต่อห้องสอบ)
 * — rows ที่ไม่มี group key / คะแนนไม่ valid คงค่าเดิม
 */
export function mapRowsToTScoresByGroup<T extends { pct: number }>(
  rows: T[],
  groupKey: (row: T) => string,
): T[] {
  const byGroup = new Map<string, number[]>();
  for (const row of rows) {
    if (!Number.isFinite(row.pct)) continue;
    const key = groupKey(row);
    const list = byGroup.get(key) ?? [];
    list.push(row.pct);
    byGroup.set(key, list);
  }

  const statsByGroup = new Map<string, TScoreStats | null>();
  byGroup.forEach((vals, key) => {
    statsByGroup.set(key, computeMeanSd(vals));
  });

  return rows.map((row) => {
    if (!Number.isFinite(row.pct)) return row;
    const t = toTScore(row.pct, statsByGroup.get(groupKey(row)) ?? null);
    return t == null ? row : { ...row, pct: t };
  });
}
