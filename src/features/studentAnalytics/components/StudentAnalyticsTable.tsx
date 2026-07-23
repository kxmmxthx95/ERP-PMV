import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { RiskBadge } from './RiskBadge';
import type { StudentAnalyticsRow } from '../types';

function rateColor(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate < 70) return 'text-destructive font-semibold';
  if (rate < 85) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-foreground';
}

export function StudentAnalyticsTable({ rows }: { rows: StudentAnalyticsRow[] }) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">ยังไม่มีนักเรียนในห้องนี้</p>
        <p className="text-xs text-muted-foreground">เลือกห้องเรียนอื่น หรือรอข้อมูลลงทะเบียน</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>นักเรียน</TableHead>
            <TableHead className="text-center">GPA</TableHead>
            <TableHead className="text-center">ติด F</TableHead>
            <TableHead className="text-center">เข้าเรียน</TableHead>
            <TableHead className="text-center">เข้าแถว</TableHead>
            <TableHead className="text-center">ระดับความเสี่ยง</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.studentId}
              className="cursor-pointer"
              onClick={() => navigate(`/portal/students?studentId=${row.studentId}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <StudentAvatar
                    studentId={row.studentId}
                    name={row.fullName}
                    photoURL={row.photoURL}
                    className="h-9 w-9 rounded-lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground">{row.studentCode}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {row.gpa !== null ? row.gpa.toFixed(2) : '—'}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {row.failingSubjects > 0 ? (
                  <span className="font-semibold text-destructive">{row.failingSubjects}</span>
                ) : '—'}
              </TableCell>
              <TableCell className={`text-center tabular-nums ${rateColor(row.attendanceRate)}`}>
                {row.attendanceRate !== null ? `${row.attendanceRate}%` : '—'}
              </TableCell>
              <TableCell className={`text-center tabular-nums ${rateColor(row.rollCallRate)}`}>
                {row.rollCallRate !== null ? `${row.rollCallRate}%` : '—'}
              </TableCell>
              <TableCell className="text-center">
                <RiskBadge level={row.riskLevel} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
