import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { TUITION_TERM_OPTIONS, type NewTuitionCampaign, type TuitionCampaign } from '@/types/tuition';

const COLLECTION = 'tuition_campaigns';
const QUERY_KEY = ['tuitionCampaigns'];
const STUDENT_FEES_COLLECTION = 'student_fees';
const PAYMENT_TRANSACTIONS_COLLECTION = 'payment_transactions';
const BATCH_DELETE_SIZE = 450;

async function deleteDocRefsInChunks(refs: ReturnType<typeof doc>[]) {
  for (let i = 0; i < refs.length; i += BATCH_DELETE_SIZE) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_DELETE_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

const TERM_ORDER = new Map(TUITION_TERM_OPTIONS.map((t, idx) => [t.id, idx]));

export interface AcademicYearCampaignGroup {
  academicYearId: string;
  campaigns: TuitionCampaign[];
}

/** ดึงรอบเก็บค่าเทอมทั้งหมด (ทุกปี/ทุกภาคเรียน) แล้วจัดกลุ่มเป็นการ์ดปีการศึกษา */
export function useTuitionCampaigns() {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TuitionCampaign);
    },
  });

  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);

  const campaignsByYear = useMemo<AcademicYearCampaignGroup[]>(() => {
    const map = new Map<string, TuitionCampaign[]>();
    for (const campaign of campaigns) {
      const list = map.get(campaign.academicYearId) ?? [];
      list.push(campaign);
      map.set(campaign.academicYearId, list);
    }
    return [...map.entries()]
      .map(([academicYearId, list]) => ({
        academicYearId,
        campaigns: [...list].sort((a, b) => (TERM_ORDER.get(a.term) ?? 99) - (TERM_ORDER.get(b.term) ?? 99)),
      }))
      .sort((a, b) => b.academicYearId.localeCompare(a.academicYearId, undefined, { numeric: true }));
  }, [campaigns]);

  const createCampaign = useMutation({
    mutationFn: async (input: NewTuitionCampaign) => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...input,
        createdAt: new Date().toISOString(),
      });
      await logActivity({
        action: 'tuition_campaign_create',
        category: 'academic',
        targetId: ref.id,
        detail: `สร้างรอบเก็บค่าเทอม: ${input.name}`,
      });
      return ref.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TuitionCampaign> }) => {
      await updateDoc(doc(db, COLLECTION, id), { ...patch, updatedAt: new Date().toISOString() });
      await logActivity({ action: 'tuition_campaign_update', category: 'academic', targetId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      queryClient.invalidateQueries({ queryKey: ['studentFeesPending'] });
    },
  });

  /** ลบรอบเก็บค่าเทอมรายภาคเรียน — พร้อมระเบียนนักเรียนและประวัติการชำระเงินของรอบนั้น */
  const deleteCampaign = useMutation({
    mutationFn: async (campaign: TuitionCampaign) => {
      const [feesSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, STUDENT_FEES_COLLECTION), where('campaignId', '==', campaign.id))),
        getDocs(query(collection(db, PAYMENT_TRANSACTIONS_COLLECTION), where('campaignId', '==', campaign.id))),
      ]);

      const refs = [
        doc(db, COLLECTION, campaign.id),
        ...feesSnap.docs.map((d) => d.ref),
        ...txSnap.docs.map((d) => d.ref),
      ];

      await deleteDocRefsInChunks(refs);

      await logActivity({
        action: 'tuition_campaign_delete',
        category: 'academic',
        targetId: campaign.id,
        detail: `ลบรอบเก็บค่าเทอม: ${campaign.name} (${feesSnap.size} ระเบียน, ${txSnap.size} ธุรกรรม)`,
      });

      return { fees: feesSnap.size, transactions: txSnap.size };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      queryClient.invalidateQueries({ queryKey: ['allPaymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['paymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['myStudentFee'] });
    },
  });

  /** ลบปีการศึกษาทั้งหมด — รอบเก็บค่าเทอม + ระเบียนนักเรียน + ประวัติการชำระเงิน */
  const deleteAcademicYear = useMutation({
    mutationFn: async (academicYearId: string) => {
      const [campaignSnap, feesSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTION), where('academicYearId', '==', academicYearId))),
        getDocs(query(collection(db, STUDENT_FEES_COLLECTION), where('academicYearId', '==', academicYearId))),
        getDocs(query(collection(db, PAYMENT_TRANSACTIONS_COLLECTION), where('academicYearId', '==', academicYearId))),
      ]);

      const refs = [
        ...campaignSnap.docs.map((d) => d.ref),
        ...feesSnap.docs.map((d) => d.ref),
        ...txSnap.docs.map((d) => d.ref),
      ];

      if (refs.length > 0) await deleteDocRefsInChunks(refs);

      await logActivity({
        action: 'tuition_year_delete',
        category: 'academic',
        targetId: academicYearId,
        detail: `ลบปีการศึกษา ${academicYearId} (${campaignSnap.size} รอบ, ${feesSnap.size} ระเบียน, ${txSnap.size} ธุรกรรม)`,
      });

      return {
        campaigns: campaignSnap.size,
        fees: feesSnap.size,
        transactions: txSnap.size,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      queryClient.invalidateQueries({ queryKey: ['allPaymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['paymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['myStudentFee'] });
    },
  });

  return {
    campaigns,
    campaignsByYear,
    isLoading: campaignsQuery.isLoading,
    createCampaign: createCampaign.mutateAsync,
    updateCampaign: updateCampaign.mutateAsync,
    deleteCampaign: deleteCampaign.mutateAsync,
    deleteAcademicYear: deleteAcademicYear.mutateAsync,
    isSaving: createCampaign.isPending || updateCampaign.isPending,
    isDeleting: deleteCampaign.isPending || deleteAcademicYear.isPending,
  };
}

/** หา campaign ที่ตรงกับ ปี/ภาคเรียนตัวเลข (1|2) ที่กำลัง active อยู่ในระบบ — ใช้กับ widget สรุปภาพรวม */
export function findCurrentCampaign(
  campaigns: TuitionCampaign[],
  academicYearId: string,
  activeSemester: number,
): TuitionCampaign | null {
  return (
    campaigns.find((c) => c.academicYearId === academicYearId && c.term === String(activeSemester)) ?? null
  );
}
