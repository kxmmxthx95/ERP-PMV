import { Edit2, Trash2, Send, CheckCircle, RotateCcw, ExternalLink, FileText, Link2, Image, Film } from 'lucide-react';
import type { LessonPlan, MaterialType } from '@/types/lessonPlan';
import { LESSON_PLAN_STATUS_CONFIG } from '@/types/lessonPlan';

interface Props {
  plan: LessonPlan;
  isAdmin?: boolean;
  onEdit:    () => void;
  onDelete:  () => void;
  onSubmit:  () => void;
  onApprove: () => void;
  onRevert:  () => void;
}

const MATERIAL_ICON: Record<MaterialType, typeof FileText> = {
  pdf:   FileText,
  link:  Link2,
  image: Image,
  video: Film,
  other: ExternalLink,
};

export default function LessonPlanCard({
  plan, isAdmin, onEdit, onDelete, onSubmit, onApprove, onRevert,
}: Props) {
  const statusCfg = LESSON_PLAN_STATUS_CONFIG[plan.status];

  return (
    <div
      className="rounded-3xl p-5 space-y-4 hover:shadow-lg transition-shadow"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              สัปดาห์ที่ {plan.weekNumber}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full font-sarabun"
              style={{ color: statusCfg.color, background: statusCfg.bg }}>
              {statusCfg.label}
            </span>
            {plan.gradeLevel && (
              <span className="text-xs text-slate-500 font-sarabun">{plan.gradeLevel}</span>
            )}
          </div>
          <h3 className="text-[15px] font-black text-slate-800 font-sukhumvit truncate" title={plan.title}>
            {plan.title}
          </h3>
          <p className="text-xs text-slate-500 font-sarabun mt-0.5">
            {plan.courseId}{plan.courseName ? ` · ${plan.courseName}` : ''} · {plan.teacherName}
          </p>
        </div>
      </div>

      {/* Objectives */}
      {plan.objectives.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-sarabun mb-1.5">จุดประสงค์</p>
          <ul className="space-y-1">
            {plan.objectives.map((obj, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-700 font-sarabun">
                <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evaluation */}
      {plan.evaluationMethod && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-sarabun mb-1">วิธีวัดผล</p>
          <p className="text-xs text-slate-700 font-sarabun">{plan.evaluationMethod}</p>
        </div>
      )}

      {/* Materials */}
      {plan.materials.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-sarabun mb-1.5">สื่อการสอน</p>
          <div className="flex flex-wrap gap-2">
            {plan.materials.map((mat, i) => {
              const Icon = MATERIAL_ICON[mat.type];
              return (
                <a
                  key={i}
                  href={mat.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors font-sarabun"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                >
                  <Icon size={12} />
                  {mat.name || mat.type}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1">
          {plan.status === 'draft' && (
            <>
              <button onClick={onEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors font-sarabun">
                <Edit2 size={12} /> แก้ไข
              </button>
              <button onClick={onSubmit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors font-sarabun">
                <Send size={12} /> ส่งตรวจ
              </button>
            </>
          )}
          {plan.status === 'submitted' && isAdmin && (
            <button onClick={onApprove}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors font-sarabun">
              <CheckCircle size={12} /> อนุมัติ
            </button>
          )}
          {plan.status !== 'draft' && (
            <button onClick={onRevert}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors font-sarabun">
              <RotateCcw size={12} /> ย้อนเป็นร่าง
            </button>
          )}
        </div>
        <button onClick={onDelete}
          className="p-1.5 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
