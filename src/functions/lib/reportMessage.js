"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDailyMessage = void 0;
const LINE_TEXT_MAX = 4800;
function formatThaiDate(dateStr) {
    try {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("th-TH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }
    catch {
        return dateStr;
    }
}
function formatNameLines(title, names, emptyLabel, maxItems = 20) {
    if (names.length === 0) {
        return [`  ${title}: ${emptyLabel}`];
    }
    const shown = names.slice(0, maxItems);
    const lines = shown.map((name) => `    • ${name}`);
    if (names.length > maxItems) {
        lines.push(`    … และอีก ${names.length - maxItems} คน`);
    }
    return [`  ${title}:`, ...lines];
}
function formatStudentLines(title, students, emptyLabel, maxItems = 25) {
    if (students.length === 0) {
        return [`  ${title}: ${emptyLabel}`];
    }
    const shown = students.slice(0, maxItems);
    const lines = shown.map((s) => `    • ${s.name} (${s.className})`);
    if (students.length > maxItems) {
        lines.push(`    … และอีก ${students.length - maxItems} คน`);
    }
    return [`  ${title}:`, ...lines];
}
function clampMessage(lines) {
    let text = lines.join("\n");
    if (text.length <= LINE_TEXT_MAX)
        return text;
    return `${text.slice(0, LINE_TEXT_MAX - 20).trimEnd()}\n\n… (ข้อความยาวเกินไป)`;
}
function buildDailyMessage(date, staff, student) {
    const thaiDate = formatThaiDate(date);
    const absentPercent = staff.total > 0 ? Math.round((staff.absent / staff.total) * 100) : 0;
    const lateNames = staff.lateNames ?? [];
    const pendingNames = staff.pendingNames ?? [];
    const absentStudents = student.absentStudents ?? [];
    const leaveStudents = student.leaveStudents ?? [];
    const lines = [
        "📊 รายงานประจำวัน",
        `${thaiDate}`,
        "",
        `👨‍🏫 บุคลากร (${staff.total} คน)`,
        `  ✅ มาปกติ: ${staff.present} คน`,
        `  ⏰ มาสาย: ${staff.late} คน`,
        ...formatNameLines("รายชื่อมาสาย", lateNames, "—"),
        `  ❌ ขาด: ${staff.absent} คน (${absentPercent}%)`,
        `  📝 ลา: ${staff.leave} คน`,
        ...(staff.pending ?? 0) > 0
            ? [`  ⏳ รอเช็ก: ${staff.pending} คน`, ...formatNameLines("รายชื่อรอเช็ก", pendingNames, "—")]
            : [],
        "",
        "🎓 นักเรียน",
        `  🏫 เช็คชื่อเข้าแถวแล้ว: ${student.classes} ห้อง`,
        `  ✅ เข้าเรียน: ${student.present} คน`,
        `  ⏰ มาสาย: ${student.late} คน`,
        `  ❌ ขาด: ${student.absent} คน`,
        ...formatStudentLines("รายชื่อขาดเรียน", absentStudents, "—"),
        `  📝 ลา: ${student.leave} คน`,
        ...formatStudentLines("รายชื่อลา", leaveStudents, "—"),
        "",
        "🔗 ระบบบริหารโรงเรียน PMV-ONE",
    ];
    return clampMessage(lines);
}
exports.buildDailyMessage = buildDailyMessage;
//# sourceMappingURL=reportMessage.js.map