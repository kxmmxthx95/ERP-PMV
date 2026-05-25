import { useState } from 'react';
import { collection, collectionGroup, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CourseMigrationTool() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<{type: 'info' | 'success' | 'error', msg: string}[]>([]);

  const addLog = (type: 'info' | 'success' | 'error', msg: string) => {
    setLogs(p => [...p, { type, msg }]);
  };

  const runMigration = async () => {
    if (!window.confirm('คุณต้องการเริ่มกระบวนการจับคู่วิชาในห้องเรียนใหม่ใช่หรือไม่? (การกระทำนี้จะแก้ไขฐานข้อมูล)')) return;

    try {
      setLoading(true);
      setLogs([]);
      addLog('info', 'เริ่มกระบวนการตรวจสอบข้อมูลวิชาทั้งหมด...');

      // 1. Fetch all courses
      const coursesSnap = await getDocs(collectionGroup(db, 'courses'));
      const courseLookup = new Map<string, any>(); 
      const codeMap = new Map<string, any[]>();
      
      coursesSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        courseLookup.set(docSnap.id, { id: docSnap.id, ...data });
        
        const code = (data.courseCode || '').toUpperCase();
        if (!codeMap.has(code)) codeMap.set(code, []);
        codeMap.get(code)!.push({ id: docSnap.id, ...data });
      });
      
      addLog('success', `พบข้อมูลวิชาทั้งหมด ${coursesSnap.size} รายการ (รวมทุกเวอร์ชัน)`);

      // Sort each group so the newest is first
      codeMap.forEach((list) => {
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      });

      // 2. Fetch all classes
      addLog('info', 'กำลังดึงข้อมูลห้องเรียนเพื่อตรวจสอบตารางสอน...');
      const classesSnap = await getDocs(collection(db, 'classes'));
      addLog('success', `พบห้องเรียนทั้งหมด ${classesSnap.size} ห้อง`);

      let migratedCount = 0;
      const batch = writeBatch(db);

      classesSnap.docs.forEach(classDoc => {
        const classData = classDoc.data();
        let changed = false;
        
        const newEnrolled = (classData.enrolledCourses || []).map((ec: any) => {
          const currentId = ec.subjectId;
          const oldCourse = courseLookup.get(currentId);
          
          if (oldCourse) {
            const code = (oldCourse.courseCode || '').toUpperCase();
            const newestCourse = codeMap.get(code)?.[0];
            
            if (newestCourse && newestCourse.id !== currentId) {
              addLog('success', `[${classData.className}] อัปเดตวิชา ${code}: เปลี่ยนไปยัง ID ตัวใหม่ล่าสุด`);
              changed = true;
              return { ...ec, subjectId: newestCourse.id };
            }
          } else {
             addLog('error', `[${classData.className}] หาวิชาเดิม ID: ${currentId} ไม่พบในฐานข้อมูลเลย (วิชาอาจถูกลบถาวรไปแล้ว) แนะนำให้ไปกดเพิ่มใหม่ที่หน้าห้องเรียน`);
          }
          return ec;
        });

        if (changed) {
          batch.update(classDoc.ref, { enrolledCourses: newEnrolled });
          migratedCount++;
        }
      });

      if (migratedCount > 0) {
        addLog('info', `กำลังบันทึกการเปลี่ยนแปลงสำหรับ ${migratedCount} ห้องเรียนลงฐานข้อมูล (Firestore)...`);
        await batch.commit();
        addLog('success', '✅ อัปเดตข้อมูลและบันทึกสำเร็จเรียบร้อย!');
        toast.success(`จับคู่วิชาใหม่สำเร็จ ${migratedCount} ห้องเรียน`);
      } else {
        addLog('success', '✨ ไม่มีห้องเรียนไหนที่ต้องอัปเดต (ข้อมูลผูกกับวิชาตัวล่าสุดอยู่แล้ว)');
        toast.info('ไม่ต้องมีอัปเดต ทุกอย่างถูกต้องอยู่แล้ว');
      }

    } catch (err: any) {
      addLog('error', `ERROR: ${err.message}`);
      toast.error('เกิดข้อผิดพลาดในการรัน Migration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 font-sukhumvit">Curriculum Migration Tool</h1>
        <p className="text-slate-500 font-sarabun">เครื่องมือแก้ปัญหารายวิชาในห้องเรียนหายไป จากการขึ้นหลักสูตรเวอร์ชันใหม่ หรือลบวิชาเก่าทิ้งแล้วสร้างใหม่</p>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
        <h3 className="font-bold text-blue-900 mb-2 font-sukhumvit text-lg">การทำงานของเครื่องมือนี้:</h3>
        <ul className="list-disc pl-5 text-[15px] text-blue-800/80 space-y-1.5 font-sarabun">
          <li>สแกน <strong>"รายวิชาทั้งหมด"</strong> ในระบบ (รวมถึงวิชาเก่าที่ซ่อนอยู่)</li>
          <li>สแกน <strong>"ห้องเรียนและตารางสอน"</strong> ทั้งหมดในฐานข้อมูล</li>
          <li>ถ้าพบว่าห้องเรียนไหนผูกกับวิชาที่เป็นเวอร์ชันเก่า จะทำการจับคู่ <strong>รหัสวิชา (Course Code)</strong> ไปยังวิชาตัวล่าสุดให้อัตโนมัติ</li>
          <li>หากไม่พบรหัสวิชาที่ตรงกัน ระบบจะข้ามไปไม่ทำอะไร (ไม่มีผลกระทบต่อข้อมูลอื่น)</li>
        </ul>
        
        <div className="mt-8">
          <Button 
            onClick={runMigration} 
            disabled={loading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm gap-2 h-11 px-6 font-bold"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play size={18} />
            )}
            <span>{loading ? 'กำลังประมวลผลข้อมูล โปรดรอ...' : 'เริ่มอัปเดตฐานข้อมูล (Run Migration)'}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] bg-[#1e1e1e] rounded-2xl p-4 overflow-y-auto border border-slate-800 shadow-inner font-mono text-[13px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600">
            [ ระบบพร้อมทำงาน รอรับคำสั่งรัน Migration... ]
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-2 ${
                  log.type === 'error' ? 'text-rose-400' : 
                  log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                <span className="shrink-0 mt-0.5 opacity-50">
                  {log.type === 'info' ? 'ℹ' : log.type === 'success' ? '✓' : '✖'}
                </span>
                <span>{log.msg}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
