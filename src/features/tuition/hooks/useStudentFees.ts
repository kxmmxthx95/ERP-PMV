import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { resolveStudentStudyStatus } from '@/lib/students/studentStatus';
import { logActivity } from '@/lib/activityLogger';
import { computeNetPayable, computeOverallStatus, computeTotalDiscount, sumFeeItems, sumInstallmentsPaid } from '../tuitionCalc';
import {
  enrichStudentFeesWithProfiles,
  formatStudentSnapshot,
  needsFeeSnapshotBackfill,
  resolveStudentsByFeeIds,
} from '../utils/studentFeeDisplay';
import {
  resolveCampaignStudentRoster,
  type CampaignStudentRosterEntry,
} from '../utils/campaignStudentRoster';
import { resolveCampaignFeeProfile, type Installment, type PaymentStatus, type Scholarship, type StudentFee, type StudentFeeRow, type TuitionCampaign } from '@/types/tuition';

const COLLECTION = 'student_fees';

type ClassCurriculumMap = Map<string, string | null>;

async function buildClassCurriculumMap(): Promise<ClassCurriculumMap> {
  const classesSnap = await getDocs(collection(db, 'classes'));
  return new Map(
    classesSnap.docs.map((d) => {
      const data = d.data() as { curriculumPackageId?: string | null; curriculumId?: string };
      return [d.id, data.curriculumPackageId ?? data.curriculumId ?? null] as const;
    }),
  );
}

function resolveEntryFeeDefaults(
  campaign: TuitionCampaign,
  entry: Pick<CampaignStudentRosterEntry, 'departmentId' | 'classId'>,
  classById: ClassCurriculumMap,
) {
  const curriculumPackageId = entry.classId ? classById.get(entry.classId) ?? null : null;
  const feeDefaults = resolveCampaignFeeProfile(campaign, entry.departmentId, curriculumPackageId);
  const defaultScholarships = feeDefaults.defaultScholarships ?? [];
  const defaultInstallments = (feeDefaults.defaultInstallments ?? []).map((inst) => ({
    ...inst,
    status: 'unpaid' as const,
    paidAmount: 0,
  }));

  return {
    feeItems: feeDefaults.defaultFeeItems,
    scholarships: defaultScholarships,
    installments: defaultInstallments,
    totals: recomputeStudentFeeTotals({
      feeItems: feeDefaults.defaultFeeItems,
      scholarships: defaultScholarships,
      installments: defaultInstallments,
    }),
  };
}

function shouldSyncFeeFromCampaign(fee: Pick<StudentFee, 'totalPaid' | 'status'>): boolean {
  if (fee.totalPaid > 0) return false;
  if (fee.status === 'pending_verification') return false;
  return true;
}

function buildPendingFeeRow(
  campaign: TuitionCampaign,
  entry: CampaignStudentRosterEntry,
  classById: ClassCurriculumMap,
): StudentFeeRow {
  const snapshot = formatStudentSnapshot(entry.student as unknown as Record<string, unknown> & { id: string });
  const nowIso = new Date().toISOString();
  const defaults = resolveEntryFeeDefaults(campaign, entry, classById);

  return {
    id: `pending:${entry.studentId}`,
    campaignId: campaign.id,
    academicYearId: campaign.academicYearId,
    term: campaign.term,
    departmentId: entry.departmentId,
    studentId: entry.studentId,
    studentName: snapshot.studentName,
    studentCode: snapshot.studentCode,
    classId: entry.classId,
    className: entry.className,
    gradeLevel: entry.gradeLevel,
    feeItems: defaults.feeItems,
    scholarships: defaults.scholarships,
    installments: defaults.installments,
    ...defaults.totals,
    createdAt: nowIso,
    isPendingRecord: true,
    studyStatus: entry.studyStatus,
  };
}

/** คำนวณค่ารวม/ส่วนลด/สถานะใหม่ทั้งหมดจาก feeItems + scholarships + installments ปัจจุบัน — เรียกก่อน save ทุกครั้ง */
export function recomputeStudentFeeTotals(
  fee: Pick<StudentFee, 'feeItems' | 'scholarships' | 'installments'>,
): Pick<StudentFee, 'totalFee' | 'totalDiscount' | 'netPayable' | 'totalPaid' | 'status'> {
  const totalFee = sumFeeItems(fee.feeItems);
  const totalDiscount = computeTotalDiscount(totalFee, fee.scholarships);
  const netPayable = computeNetPayable(totalFee, fee.scholarships);
  const totalPaid = sumInstallmentsPaid(fee.installments);
  const status = computeOverallStatus(netPayable, totalPaid, fee.installments);
  return { totalFee, totalDiscount, netPayable, totalPaid, status };
}

/**
 * รายชื่อค่าเทอมนักเรียนทั้งหมดของ "รอบเก็บค่าเทอม" (campaign) หนึ่งรอบ — ใช้ในหน้ารายชื่อนักเรียน
 *
 * includePending: true เปิด pendingFees (นักเรียนที่ยังไม่มีระเบียนค่าเทอม) — คำนวณจาก
 * resolveCampaignStudentRoster() ซึ่งสแกน students/enrollments/classes ทั้งโรงเรียนแบบไม่กรอง
 * ปีการศึกษา แพงมาก ใช้เฉพาะหน้าจัดการ campaign เต็ม (AdminTuitionView) ที่ต้องใช้ข้อมูลนี้จริง
 * — อย่าเปิดจาก widget สรุป/หน้ารายชื่อที่ใช้แค่ studentFees
 */
export function useStudentFeesByCampaign(
  campaignId: string | null,
  campaign: TuitionCampaign | null = null,
  options: { includePending?: boolean } = {},
) {
  const includePending = options.includePending ?? false;
  const queryClient = useQueryClient();
  const queryKey = ['studentFees', campaignId];

  const feesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const q = query(collection(db, COLLECTION), where('campaignId', '==', campaignId));
      const snap = await getDocs(q);
      const rawFees = snap.docs.map((d) => {
        const fee = { id: d.id, ...d.data() } as StudentFee;
        if (!fee.gradeLevel?.trim() && fee.className) {
          const [grade] = fee.className.split(/[/／]/);
          fee.gradeLevel = grade?.trim() || undefined;
        }
        return fee;
      });

      const enriched = await enrichStudentFeesWithProfiles(rawFees);
      const lookup = await resolveStudentsByFeeIds(enriched.map((fee) => fee.studentId));
      const withStudyStatus = enriched.map((fee) => {
        const student = lookup.get(fee.studentId);
        const statusLike = student
          ? {
              status: String(student.status ?? ''),
              currentStatus: String(student.currentStatus ?? ''),
            }
          : null;
        return {
          ...fee,
          studyStatus: statusLike ? resolveStudentStudyStatus(statusLike) : ('studying' as const),
        };
      });

      const toBackfill = withStudyStatus.filter((fee, idx) => needsFeeSnapshotBackfill(rawFees[idx], fee));
      if (toBackfill.length > 0) {
        void Promise.all(
          toBackfill.map((fee) =>
            updateDoc(doc(db, COLLECTION, fee.id), {
              studentName: fee.studentName,
              studentCode: fee.studentCode,
              updatedAt: new Date().toISOString(),
            }),
          ),
        );
      }

      return withStudyStatus;
    },
    enabled: !!campaignId,
  });

  const pendingQuery = useQuery({
    queryKey: [
      'studentFeesPending',
      campaign?.id,
      campaign?.updatedAt,
      campaign?.feeProfiles?.length ?? 0,
      campaign?.defaultFeeItems?.length ?? 0,
    ],
    queryFn: async () => {
      if (!campaign) return [] as StudentFeeRow[];

      const [roster, feesSnap, classById] = await Promise.all([
        resolveCampaignStudentRoster(campaign),
        getDocs(query(collection(db, COLLECTION), where('campaignId', '==', campaign.id))),
        buildClassCurriculumMap(),
      ]);

      const existingStudentIds = new Set(feesSnap.docs.map((d) => (d.data() as StudentFee).studentId));
      const lookup = await resolveStudentsByFeeIds(
        roster.filter((entry) => !existingStudentIds.has(entry.studentId)).map((entry) => entry.studentId),
      );

      return roster
        .filter((entry) => !existingStudentIds.has(entry.studentId))
        .map((entry) => {
          const resolvedStudent = lookup.get(entry.studentId);
          const row = buildPendingFeeRow(campaign, entry, classById);
          if (!resolvedStudent) return row;
          const snapshot = formatStudentSnapshot(resolvedStudent);
          return {
            ...row,
            studentName: snapshot.studentName || row.studentName,
            studentCode: snapshot.studentCode || row.studentCode,
          };
        });
    },
    enabled: includePending && !!campaign,
  });

  /** สร้าง/อัปเดตระเบียนค่าเทอมจากโครงสร้างที่ตั้งไว้ใน campaign */
  async function applyCampaignFeesToStudentsFn(campaign: TuitionCampaign) {
      const [roster, existingSnap, classById] = await Promise.all([
        resolveCampaignStudentRoster(campaign),
        getDocs(query(collection(db, COLLECTION), where('campaignId', '==', campaign.id))),
        buildClassCurriculumMap(),
      ]);

      const existingByStudentId = new Map(
        existingSnap.docs.map((d) => {
          const fee = { id: d.id, ...d.data() } as StudentFee;
          return [fee.studentId, fee] as const;
        }),
      );

      const toCreate = roster.filter((entry) => !existingByStudentId.has(entry.studentId));
      const lookup = await resolveStudentsByFeeIds(toCreate.map((entry) => entry.studentId));
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      let created = 0;
      let updated = 0;

      for (const entry of roster) {
        const defaults = resolveEntryFeeDefaults(campaign, entry, classById);
        if (defaults.feeItems.length === 0) continue;

        const existing = existingByStudentId.get(entry.studentId);
        if (!existing) {
          const snapshot = formatStudentSnapshot(entry.student as unknown as Record<string, unknown> & { id: string });
          const resolved = lookup.get(entry.studentId);
          const finalSnapshot = resolved ? formatStudentSnapshot(resolved) : snapshot;
          const feeDoc: Omit<StudentFee, 'id'> = {
            campaignId: campaign.id,
            academicYearId: campaign.academicYearId,
            term: campaign.term,
            departmentId: entry.departmentId,
            studentId: entry.studentId,
            studentName: finalSnapshot.studentName,
            studentCode: finalSnapshot.studentCode,
            classId: entry.classId,
            className: entry.className,
            gradeLevel: entry.gradeLevel,
            feeItems: defaults.feeItems,
            scholarships: defaults.scholarships,
            installments: defaults.installments,
            createdAt: nowIso,
            ...defaults.totals,
          };
          batch.set(doc(collection(db, COLLECTION)), feeDoc);
          created += 1;
          continue;
        }

        if (!shouldSyncFeeFromCampaign(existing)) continue;

        batch.update(doc(db, COLLECTION, existing.id), {
          feeItems: defaults.feeItems,
          scholarships: defaults.scholarships,
          installments: defaults.installments,
          ...defaults.totals,
          updatedAt: nowIso,
        });
        updated += 1;
      }

      if (created + updated > 0) await batch.commit();

      await logActivity({
        action: 'tuition_fee_generate',
        category: 'academic',
        targetId: campaign.id,
        detail: `ซิงก์ค่าเทอมจาก campaign: สร้าง ${created} อัปเดต ${updated} รายการ`,
      });

      return { created, updated };
  }

  const applyCampaignFeesToStudents = useMutation({
    mutationFn: applyCampaignFeesToStudentsFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studentFeesPending'] });
    },
  });

  /** สร้างระเบียนค่าเทอมให้นักเรียนทุกคนที่ลงทะเบียนปี/เทอมนี้ (ข้ามคนที่มีระเบียนอยู่แล้ว) */
  const generateFeesForCampaign = useMutation({
    mutationFn: async (campaign: TuitionCampaign) => {
      const result = await applyCampaignFeesToStudentsFn(campaign);
      return result.created + result.updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studentFeesPending'] });
    },
  });

  /** แก้ไขทุน/ส่วนลด และแผนผ่อนชำระของนักเรียนรายคน — recompute totals ก่อนบันทึกเสมอ */
  const updateStudentFee = useMutation({
    mutationFn: async ({
      id,
      feeItems,
      scholarships,
      installments,
    }: {
      id: string;
      feeItems: StudentFee['feeItems'];
      scholarships: Scholarship[];
      installments: Installment[];
    }) => {
      const totals = recomputeStudentFeeTotals({ feeItems, scholarships, installments });
      await updateDoc(doc(db, COLLECTION, id), {
        feeItems,
        scholarships,
        installments,
        ...totals,
        updatedAt: new Date().toISOString(),
      });
      await logActivity({
        action: 'tuition_fee_update',
        category: 'academic',
        targetId: id,
        detail: `แก้ไขค่าเทอม/ทุนการศึกษา`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studentFeesPending'] });
    },
  });

  const updateStudentFeeStatus = useMutation({
    mutationFn: async ({ fee, status }: { fee: StudentFee; status: PaymentStatus }) => {
      const patch: Partial<StudentFee> = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (status === 'paid') {
        patch.totalPaid = fee.netPayable;
        if (fee.installments.length > 0) {
          patch.installments = fee.installments.map((i) => ({
            ...i,
            status: 'paid',
            paidAmount: i.amount,
          }));
        }
      } else if (status === 'unpaid') {
        patch.totalPaid = 0;
        if (fee.installments.length > 0) {
          patch.installments = fee.installments.map((i) => ({
            ...i,
            status: 'unpaid',
            paidAmount: 0,
          }));
        }
      } else if (status === 'partial') {
        if (fee.totalPaid <= 0 || fee.totalPaid >= fee.netPayable) {
          throw new Error('ไม่สามารถตั้งเป็นชำระบางส่วนได้ — กรุณาบันทึกยอดชำระก่อน');
        }
        patch.status = 'partial';
      } else if (status === 'pending_verification') {
        patch.status = 'pending_verification';
      }

      await updateDoc(doc(db, COLLECTION, fee.id), patch);
      await logActivity({
        action: 'tuition_fee_status_update',
        category: 'academic',
        targetId: fee.id,
        detail: `เปลี่ยนสถานะค่าเทอมเป็น ${status}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studentFeesPending'] });
    },
  });

  return {
    studentFees: feesQuery.data ?? [],
    pendingFees: pendingQuery.data ?? [],
    isLoading: feesQuery.isLoading || (includePending && pendingQuery.isLoading),
    generateFeesForCampaign: generateFeesForCampaign.mutateAsync,
    applyCampaignFeesToStudents: applyCampaignFeesToStudents.mutateAsync,
    isGenerating: generateFeesForCampaign.isPending || applyCampaignFeesToStudents.isPending,
    updateStudentFee: updateStudentFee.mutateAsync,
    updateStudentFeeStatus: updateStudentFeeStatus.mutateAsync,
    isSaving: updateStudentFee.isPending || updateStudentFeeStatus.isPending,
  };
}

/** ค่าเทอมของนักเรียนที่ล็อกอินอยู่ (ใช้ใน StudentFeeWidget) — เลือกระเบียนของปีนี้ที่ตรง term ปัจจุบันก่อน ไม่งั้นเอาล่าสุด */
export function useMyStudentFee() {
  const { user, userData } = useAuth();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!user?.uid) {
        if (!cancelled) {
          setStudentId(null);
          setResolving(false);
        }
        return;
      }

      setResolving(true);
      try {
        const student = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });
        if (!cancelled) setStudentId(student?.id ?? null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [user?.uid, user?.email, userData?.studentCode]);

  const queryKey = ['myStudentFee', year, studentId];

  const feeQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, COLLECTION),
          where('academicYearId', '==', year),
          where('studentId', '==', studentId),
        ),
      );
      if (snap.empty) return null;
      const fees = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentFee);
      const exactTerm = fees.find((f) => f.term === String(activeSemester));
      if (exactTerm) return exactTerm;
      return [...fees].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    },
    enabled: isLoaded && !!year && !!studentId,
  });

  return {
    studentFee: feeQuery.data ?? null,
    isLoading: resolving || feeQuery.isLoading,
  };
}
