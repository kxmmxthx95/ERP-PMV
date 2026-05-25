import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Star,
  Users,
  GraduationCap,
  BookOpen,
  BarChart3,
} from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ClassRoom } from '@/types/class';

import ClassTeacherTab from './ClassTeacherTab';
import ClassCourseTab from './ClassCourseTab';
import { toast } from 'sonner';

interface ClassStudentPanelProps {
  classRoom: ClassRoom;
  onBack: () => void;
}

export default function ClassStudentPanel({ classRoom, onBack }: ClassStudentPanelProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'advisors' | 'courses' | 'analytics'>('roster');
  const [viewMode] = useState<'list' | 'grid'>('list');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);



  // 🚀 ดึงข้อมูลนักเรียนโดยตรงจาก Classroom ID เพื่อความแม่นยำสูงสุด
  React.useEffect(() => {
    // 1. ดึงจากฟิลด์ classroomId ใน Student Document (Primary)
    const q = query(
      collection(db, 'students'),
      where('classroomId', '==', classRoom.id)
    );

    const unsub = onSnapshot(q, async (snap) => {
      let students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fallback: ถ้าไม่พบ ให้ลองหาจากคอลเลกชัน Enrollments (Secondary)
      if (students.length === 0) {
        const enq = query(collection(db, 'enrollments'), where('classId', '==', classRoom.id));
        const enSnap = await getDocs(enq);
        const studentIds = enSnap.docs.map(d => d.data().studentId);

        if (studentIds.length > 0) {
          // ดึงข้อมูลนักเรียนตาม IDs ที่ได้จาก Enrollment
          const stq = query(collection(db, 'students'), where('__name__', 'in', studentIds));
          const stSnap = await getDocs(stq);
          students = stSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      setClassStudents(students.sort((a: any, b: any) =>
        (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true })
      ));
    });

    return () => unsub();
  }, [classRoom.id]);






  // Mock attendance stats based on student count for now, until real attendance module is ready
  const attendanceStats = [
    { name: 'มาเรียน (Present)', value: 85, color: '#4ade80' },
    { name: 'สาย (Late)', value: 10, color: '#facc15' },
    { name: 'ขาด/ลา (Absent)', value: 5, color: '#f87171' },
  ];

  const isLoading = false; // Hooks are real-time, no explicit loading needed here as lists will just be empty initially

  const togglePresident = async (studentId: string, currentStatus: boolean) => {
    try {
      const batch = writeBatch(db);

      // 1. Reset all students in this class to not be president
      classStudents.forEach(s => {
        if (s.isPresident) {
          batch.update(doc(db, 'students', s.id), { isPresident: false });
        }
      });

      // 2. Set the new one if we're not just unsetting
      if (!currentStatus) {
        batch.update(doc(db, 'students', studentId), { isPresident: true });
        const st = classStudents.find(s => s.id === studentId);
        toast.success(`ตั้ง ${st?.firstName} ${st?.lastName} เป็นหัวหน้าห้องแล้ว`);
      } else {
        toast.success(`ยกเลิกตำแหน่งหัวหน้าห้องแล้ว`);
      }

      await batch.commit();
    } catch (err) {
      console.error('Error toggling president:', err);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  // Render Content แยกตามแต่ละ Tab
  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-black/40 gap-3">
          <div className="w-6 h-6 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
          <p className="text-sm font-medium">กำลังโหลดข้อมูลห้องเรียน...</p>
        </div>
      );
    }

    switch (activeTab) {
      // Tab 1: รายชื่อนักเรียน และเลือกหัวหน้าห้อง
      case 'roster': {
        const totalCount = classStudents.length;
        const maleCount = classStudents.filter(s => s.gender === 'male' || ['เด็กชาย', 'นาย', 'ด.ช.'].includes(s.prefix)).length;
        const femaleCount = classStudents.filter(s => s.gender === 'female' || ['เด็กหญิง', 'นางสาว', 'นาง', 'ด.ญ.'].includes(s.prefix)).length;
        
        const theme = 
          classRoom.departmentId === 'secondary' ? { gradient: 'from-indigo-600 to-purple-700', label: 'Secondary' } :
          classRoom.departmentId === 'primary' ? { gradient: 'from-blue-500 to-cyan-500', label: 'Primary' } :
          { gradient: 'from-rose-500 to-orange-500', label: 'Early' };

        return (
          <div className="space-y-8">
            {/* ── Apple Music Style Header ── */}
            <div className="flex flex-col lg:flex-row gap-8 items-end mb-8">
              {/* 1. Class Hero Card (Album Cover) */}
              <div className="flex flex-col gap-3 shrink-0">
                <div className={`w-48 h-48 lg:w-56 lg:h-56 rounded-xl bg-gradient-to-br ${theme.gradient} relative overflow-hidden shadow-lg shadow-black/5 group`}>
                  <div className="absolute inset-0 bg-black/10 opacity-40" />
                  <div className="absolute top-4 right-4 text-white/90 font-bold text-sm tracking-tight drop-shadow-sm">
                    {classRoom.gradeLevel}
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <h2 className="text-white text-xl font-bold tracking-tight leading-none drop-shadow-sm">
                      {theme.label}
                    </h2>
                  </div>
                  <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/20 rounded-full blur-3xl" />
                </div>
              </div>

              {/* 2. Summary Widget (Album Metadata) */}
              <div className="flex-1 w-full pb-2">
                <div className="flex flex-col gap-5">
                  <div className="w-full flex items-start flex-col justify-center">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">นักเรียนทั้งหมด</p>
                    <p className="text-3xl font-black text-slate-800 leading-none tracking-tight">{totalCount} <span className="text-[13px] font-bold text-slate-400 ml-1">คน</span></p>
                  </div>
                  
                  <div className="w-full flex items-start flex-col justify-center">
                    <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-1.5">นักเรียนชาย</p>
                    <p className="text-3xl font-black text-blue-600 leading-none tracking-tight">{maleCount} <span className="text-[13px] font-bold text-blue-400 ml-1">คน</span></p>
                  </div>
                  
                  <div className="w-full flex items-start flex-col justify-center">
                    <p className="text-[11px] font-black text-pink-400 uppercase tracking-widest mb-1.5">นักเรียนหญิง</p>
                    <p className="text-3xl font-black text-pink-600 leading-none tracking-tight">{femaleCount} <span className="text-[13px] font-bold text-pink-400 ml-1">คน</span></p>
                  </div>
                </div>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="bg-transparent overflow-x-auto pb-8">
                <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[600px]">
                  <thead>
                    <tr className="border-b border-black/[0.08] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold w-[45%]">ชื่อ-นามสกุล</th>
                      <th className="py-3 px-4 font-semibold w-[20%] border-l border-black/[0.08]">รหัสนักเรียน</th>
                      <th className="py-3 px-4 font-semibold w-[15%] border-l border-black/[0.08]">เพศ</th>
                      <th className="py-3 px-4 font-semibold w-[10%] border-l border-black/[0.08] text-center">เลขที่</th>
                      <th className="py-3 px-4 font-semibold w-[10%] text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((student, index) => {
                      const isSelected = selectedStudentId === student.id;
                      
                      return (
                      <tr 
                        key={student.id} 
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`transition-colors group cursor-pointer ${
                          isSelected ? 'bg-blue-600' : 'hover:bg-black/[0.02]'
                        }`}
                      >
                        <td className={`py-3 px-4 first:rounded-l-2xl transition-colors ${!isSelected && 'border-b border-black/[0.04]'}`}>
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            {student.photoURL ? (
                              <img src={student.photoURL} alt={student.firstName} className="w-10 h-10 rounded-lg object-cover shadow-sm border border-black/5" />
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border border-black/5 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {student.firstName.charAt(0)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className={`font-semibold text-[13px] ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                {student.prefix}{student.firstName} {student.lastName}
                                {(student as any).isPresident && <Star size={12} className={`inline ml-1.5 mb-0.5 ${isSelected ? 'fill-white text-white' : 'fill-yellow-400 text-yellow-400'}`} />}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className={`py-3 px-4 font-medium text-[12px] transition-colors ${isSelected ? 'text-white/80' : 'text-slate-500 border-b border-black/[0.04]'}`}>
                          {student.studentCode || '-'}
                        </td>
                        <td className={`py-3 px-4 font-medium text-[12px] transition-colors ${isSelected ? 'text-white/80' : 'text-slate-500 border-b border-black/[0.04]'}`}>
                          {student.gender === 'male' || ['เด็กชาย', 'นาย', 'ด.ช.'].includes(student.prefix) ? 'ชาย' : 'หญิง'}
                        </td>
                        <td className={`py-3 px-4 font-medium text-[12px] text-center transition-colors ${isSelected ? 'text-white/80' : 'text-slate-500 border-b border-black/[0.04]'}`}>
                          {index + 1}
                        </td>
                        <td className={`py-3 px-4 text-center last:rounded-r-2xl transition-colors ${!isSelected && 'border-b border-black/[0.04]'}`}>
                          <button
                            className={`p-1.5 rounded-full transition-all ${
                              isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-black/5 text-slate-400'
                            }`}
                            title={(student as any).isPresident ? "ยกเลิกหัวหน้าห้อง" : "ตั้งเป็นหัวหน้าห้อง"}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePresident(student.id, !!(student as any).isPresident);
                            }}
                          >
                            <Star 
                              size={18} 
                              className={
                                isSelected 
                                  ? "text-white" 
                                  : (student as any).isPresident 
                                    ? "text-yellow-400 fill-yellow-400" 
                                    : ""
                              } 
                            />
                          </button>
                        </td>
                      </tr>
                    )})}
                    {classStudents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium text-sm">
                          ไม่พบรายชื่อนักเรียนในห้องนี้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {classStudents.map((student, index) => (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative bg-white rounded-[2.5rem] p-6 border border-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden text-center"
                  >
                    {/* Index Badge */}
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[12px] font-black text-slate-300">
                      {index + 1}
                    </div>

                    {/* President Star */}
                    <button
                      onClick={() => togglePresident(student.id, !!(student as any).isPresident)}
                      className="absolute top-4 right-4 p-2 rounded-full hover:bg-yellow-50 transition-colors z-10"
                    >
                      <Star
                        size={20}
                        className={(student as any).isPresident ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-slate-100 group-hover:text-slate-200"}
                      />
                    </button>

                    {/* Avatar Container */}
                    <div className="w-20 h-20 mx-auto rounded-[2rem] overflow-hidden bg-slate-50 shadow-inner mb-4 relative ring-4 ring-black/[0.02]">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`}
                        alt="student"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-[14px] font-bold text-slate-900 truncate leading-tight">
                        {student.prefix}{student.firstName}
                      </h4>
                      <h4 className="text-[14px] font-bold text-slate-900 truncate leading-tight">
                        {student.lastName}
                      </h4>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2">
                        {student.studentCode || 'NO CODE'}
                      </p>
                    </div>
                  </motion.div>
                ))}
                {classStudents.length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-300 font-bold italic border-2 border-dashed border-slate-100 rounded-[3rem]">
                    ไม่พบรายชื่อนักเรียนในห้องนี้
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // Tab 2: ครูประจำชั้น (Advisors)
      case 'advisors':
        return (
          <ClassTeacherTab
            classRoom={classRoom}
            cfg={{
              bg: 'rgba(59,130,246,0.08)',
              color: '#3b82f6',
              label: 'ครูประจำชั้น'
            }}
          />
        );

      // Tab 3: รายวิชาที่เปิดสอน
      case 'courses':
        return (
          <ClassCourseTab
            classRoom={classRoom}
            cfg={{
              bg: 'rgba(59,130,246,0.08)',
              color: '#3b82f6',
              label: 'วิชาเรียน'
            }}
          />
        );

      // Tab 4: สถิติการเข้าเรียน (Glassmorphism + Recharts)
      case 'analytics':
        return (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-full max-w-2xl bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <h3 className="text-center text-lg font-bold text-black/80 mb-8">อัตราการเข้าเรียนเฉลี่ยของห้องนี้</h3>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={attendanceStats}
                      cx="50%" cy="50%"
                      innerRadius={90} outerRadius={125}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {attendanceStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }}
                      itemStyle={{ color: '#000', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '14px', fontWeight: 500 }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
    }
  };

  const tabs = [
    { id: 'roster', label: 'รายชื่อนักเรียน', icon: Users },
    { id: 'advisors', label: 'ครูประจำชั้น', icon: GraduationCap },
    { id: 'courses', label: 'วิชาเรียน', icon: BookOpen },
    { id: 'analytics', label: 'สถิติข้อมูล', icon: BarChart3 },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ── Header Portal: Navigation Tabs (Same as Curriculum Design) ── */}
      {typeof document !== 'undefined' && document.getElementById('header-portal-center') && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center h-9 border border-black/[0.07] p-1 rounded-full bg-white/50 backdrop-blur-md pointer-events-auto"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center h-full px-5 rounded-full text-[10.5px] font-black transition-all whitespace-nowrap ${active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-black/35 hover:text-black/60 hover:bg-black/[0.02]'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </motion.div>,
        document.getElementById('header-portal-center')!
      )}

      {/* ── Header Portal: Right Actions (Back Button) ── */}
      {typeof document !== 'undefined' && document.getElementById('header-portal-right-actions') && createPortal(
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-white/40 transition-colors"
          style={{
            background: 'rgba(255,255,255,0.35)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.55)',
          }}
          title="ย้อนกลับ"
        >
          <ArrowLeft size={16} />
        </button>,
        document.getElementById('header-portal-right-actions')!
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}