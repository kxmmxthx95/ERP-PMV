const fs = require('fs');

let content = fs.readFileSync('src/features/grades/GradeBookPage.tsx', 'utf8');

// 1. Update Tab type
content = content.replace(
  "type Tab = 'table' | 'config';",
  "type Tab = 'table' | 'config' | 'exams';"
);

// 2. Remove view state
content = content.replace(
  "  const [view, setView] = useState<'exams' | 'detail'>('exams');\n",
  ""
);

// 3. Update resets
content = content.replace(
  "    setView('exams');\n  }, [selectedSemester, selectedClassId]);",
  "    setActiveTab('table');\n  }, [selectedSemester, selectedClassId]);"
);

content = content.replace(
  "  // reset view เมื่อเปลี่ยนวิชา\n  useEffect(() => {\n    setSelectedExamId('');\n    setView('exams');\n  }, [selectedSubjectId]);",
  "  // reset tab เมื่อเปลี่ยนวิชา\n  useEffect(() => {\n    setSelectedExamId('');\n    setActiveTab('table');\n  }, [selectedSubjectId]);"
);

// 4. Update Header Step 1-3
content = content.replace(
  '        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">',
  '        {!selectedSubjectId && (\n          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">'
);

content = content.replace(
  '        {selectedClassId && (\n          <div className="flex flex-col gap-2">',
  '        {selectedClassId && !selectedSubjectId && (\n          <div className="flex flex-col gap-2">'
);

// We need to add the closing parenthesis for `{!selectedSubjectId && (`
content = content.replace(
  '        {selectedClassId && selectedSubjectId && (',
  '        {selectedClassId && selectedSubjectId && ('
);
// Wait, the grid grid-cols-1 is closed just before selectedClassId check.
content = content.replace(
  '          </SelectField>\n        </div>\n\n        {selectedClassId && !selectedSubjectId && (',
  '          </SelectField>\n        </div>\n        )}\n\n        {selectedClassId && !selectedSubjectId && ('
);

// 5. Update Top Header content
content = content.replace(
  /<div className="flex items-center gap-2">\s+<div className="w-9 h-9 rounded-2xl flex items-center justify-center"\s+style={{ background: 'linear-gradient\(135deg,#7c3aed,#6d28d9\)' }}>\s+<GraduationCap size={16} className="text-white" \/>\s+<\/div>\s+<div>\s+<p className="text-\[14px\] font-black text-slate-800 font-sukhumvit">สมุดบันทึกคะแนน<\/p>\s+<p className="text-\[11px\] text-slate-400 font-sarabun">\s+ปีการศึกษา {academicYear} · ภาคเรียนที่ {selectedSemester}\s+<\/p>\s+<\/div>/,
  `<div className="flex items-center gap-2">
          {selectedSubjectId ? (
            <button
              onClick={() => { setSelectedSubjectId(''); setSelectedExamId(''); }}
              className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/60 text-slate-500 hover:bg-white/80 transition-colors shadow-sm"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              <GraduationCap size={16} className="text-white" />
            </div>
          )}
          <div>
            <p className="text-[14px] font-black text-slate-800 font-sukhumvit">
              {selectedSubjectId && selectedSubject ? selectedSubject.name : 'สมุดบันทึกคะแนน'}
            </p>
            <p className="text-[11px] text-slate-400 font-sarabun">
              {selectedSubjectId && selectedClass ? \`\${selectedClass.className} · \` : ''}ปีการศึกษา {academicYear} · ภาคเรียนที่ {selectedSemester}
            </p>
          </div>`
);


// 6. Tabs Array
content = content.replace(
  "{ key: 'config' as Tab, icon: <Settings2 size={11} />, label: 'ตั้งค่าเกรด' },",
  "{ key: 'config' as Tab, icon: <Settings2 size={11} />, label: 'ตั้งค่าเกรด' },\n                { key: 'exams' as Tab, icon: <ClipboardList size={11} />, label: 'คะแนนการสอบ' },"
);

// 7. Publish button wrapper
content = content.replace(
  /<motion\.button\s+whileHover={{ scale: 1\.01 }} whileTap={{ scale: 0\.99 }}\s+onClick={handlePublish}/,
  `{activeTab !== 'exams' && (
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handlePublish}`
);

content = content.replace(
  /{publishDone \? 'บันทึกแล้ว ✓' : 'บันทึกเกรด'}\s+<\/motion\.button>\s+<\/div>\s+)}/,
  `{publishDone ? 'บันทึกแล้ว ✓' : 'บันทึกเกรด'}
              </motion.button>
            )}
          </div>
        )}`
);

// 8. Exam Overview Logic Replacement
// I will replace everything from `) : view === 'exams' ? (` up to `) : (` for the detail view
content = content.replace(
  ") : view === 'exams' ? (",
  ") : activeTab === 'exams' ? ("
);

// Disable setView inside Exam Card mapping
content = content.replace(
  "setSelectedExamId(exam.id);\n                          setView('detail');",
  "setSelectedExamId(exam.id);"
);

// Grade summary shortcut button
content = content.replace(
  "onClick={() => setView('detail')}",
  "onClick={() => setActiveTab('table')}"
);

// Back button in Detail View
content = content.replace(
  "onClick={() => { setView('exams'); setSelectedExamId(''); }}",
  "onClick={() => { setSelectedExamId(''); }}"
);

// Remove the `setView` completely from the exam detail view if any other exists.

fs.writeFileSync('src/features/grades/GradeBookPage.tsx', content);
console.log('Done!');
