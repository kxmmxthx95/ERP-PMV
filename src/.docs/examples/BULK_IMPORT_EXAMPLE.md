# Student Bulk Import — Usage Example

## End-to-End Workflow

This example shows how an administrator would use the Student Bulk Import feature to add 50 new students to the secondary school for the 2569 academic year.

---

## Step 1: Prepare CSV File

Create a file named `students_2569_m1.csv`:

```csv
studentCode,prefix,firstName,lastName,departmentId,gradeLevel
69001,เด็กชาย,สมชาย,ใจดี,secondary,ม.1
69002,เด็กหญิง,สมหญิง,รักเรียน,secondary,ม.1
69003,เด็กชาย,วิทยา,ศรีบัณฑิต,secondary,ม.1
69004,นาย,สิทธิ์,ชมเชย,secondary,ม.1
69005,นางสาว,นฤมล,ประเสริฐ,secondary,ม.1
69006,เด็กหญิง,ญาณ,อริยะ,secondary,ม.1
69007,เด็กชาย,ธวัชชัย,วิมลศรี,secondary,ม.1
69008,นาย,อภัย,กิจจา,secondary,ม.1
69009,นางสาว,ดารา,มานิตย์,secondary,ม.1
69010,เด็กหญิง,สินชัย,สัมพันธ์,secondary,ม.1
... (40 more rows)
```

---

## Step 2: Open Student Manager

1. Navigate to **จัดการนักเรียน** (Student Manager) portal
2. Click the **"นำเข้า"** (Import) button in the toolbar
3. **StudentCsvImportModal** opens with upload zone

**UI at Step 1:**
```
┌─────────────────────────────────────────┐
│ นำเข้านักเรียนจาก CSV                     │
│ อัปโหลดไฟล์ CSV                           │
├─────────────────────────────────────────┤
│                                         │
│  ⬆️  ลากไฟล์ CSV มาวางที่นี่             │
│      หรือ                               │
│      [เลือกไฟล์]                        │
│                                         │
│  💡 ไม่รู้ format ที่ถูกต้อง?            │
│     [📄 ดาวน์โหลดไฟล์ตัวอย่าง]           │
│                                         │
├─────────────────────────────────────────┤
│                       [ปิด]             │
└─────────────────────────────────────────┘
```

---

## Step 3: Upload CSV File

### Option A: Drag & Drop
- Drag `students_2569_m1.csv` into the drop zone
- System immediately parses the file

### Option B: Click to Browse
- Click "เลือกไฟล์" link
- Select `students_2569_m1.csv` from file picker

**Behind the scenes:**
```typescript
Papa.parse(csvFile, {
  header: true,
  skipEmptyLines: true,
  encoding: 'UTF-8',
  complete: (results) => {
    // Validate all rows
    const parsed = rows.map((row, i) => 
      validateRow(row, i + 2, existingCodes)
    );
    // Move to configuration step
    setStep('config');
  },
});
```

---

## Step 4: Configure Batch Import

**Modal transitions to "config" step**

**UI at Step 2:**
```
┌─────────────────────────────────────────┐
│ นำเข้านักเรียนจาก CSV                     │
│ ตั้งค่าการนำเข้า                         │
├─────────────────────────────────────────┤
│                                         │
│  ⚙️ ตั้งค่าการนำเข้า                    │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ปีการศึกษา   │ [ปีการศึกษา 2569 ▼]  ││
│  │ แผนก        │ [มัธยมศึกษา ▼]       ││
│  │ ระดับชั้น    │ [ม.1 ▼]             ││
│  └─────────────────────────────────────┘│
│                                         │
│  💡 ระบบจะสร้างเรกคอร์ด Enrollment ให้ │
│                                         │
│  📊 พร้อมนำเข้า: 50 แถว                 │
│                                         │
├─────────────────────────────────────────┤
│  [⬅️ ย้อนกลับ]            [ถัดไป]       │
└─────────────────────────────────────────┘
```

**Admin selects:**
- **Academic Year:** ปีการศึกษา 2569
- **Department:** มัธยมศึกษา (secondary)
- **Grade Level:** ม.1 (M.1)

---

## Step 5: Review & Validate

**Modal moves to "preview" step**

System displays validation results in a table:

```
┌────┬──────┬────────┬────────┬──────────┬──────┬──────┐
│ #  │ รหัส │ คำนำหน้า│ ชื่อ    │ นามสกุล  │ แผนก │ ชั้น │
├────┼──────┼────────┼────────┼──────────┼──────┼──────┤
│ 2  │69001 │เด็กชาย │สมชาย   │ใจดี      │ม.1  │✓    │
│ 3  │69002 │เด็กหญิง│สมหญิง   │รักเรียน  │ม.1  │✓    │
│ 4  │69003 │เด็กชาย │วิทยา   │ศรีบัณฑิต │ม.1  │✓    │
│ ... │ ...  │ ...    │ ...     │ ...      │ ...  │ ... │
│ 51 │69050 │นางสาว │กัญญา   │สวรรค์    │ม.1  │✓    │
└────┴──────┴────────┴────────┴──────────┴──────┴──────┘
```

**UI Summary:**
```
✅ ตั้งค่า: ปีการศึกษา 2569 · มัธยมศึกษา · ม.1
✓ 50 แถวพร้อมนำเข้า

💡 ระบบจะสร้างเรกคอร์ด Enrollment ให้โดยอัตโนมัติ
  สามารถเพิ่มการลงทะเบียนห้องเรียนได้ในภายหลัง
```

**All rows valid, no errors shown.**

---

## Step 6: Execute Batch Import

**Click "นำเข้า 50 รายการ" button**

System initiates Firestore batch write:

```typescript
const batch = writeBatch(db);

for (let i = 0; i < 50; i++) {
  const row = validRows[i];
  
  // Create Student document
  const studentDocRef = doc(collection(db, 'students'));
  batch.set(studentDocRef, {
    studentCode: '69001',
    prefix: 'เด็กชาย',
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    gender: 'male',  // derived from prefix
    status: 'active',
    createdAt: '2026-04-26',
    // ... other defaults
  });
  
  // Create Enrollment document
  const enrollmentDocRef = doc(collection(db, 'enrollments'));
  batch.set(enrollmentDocRef, {
    studentId: studentDocRef.id,
    classId: '',        // empty — to be assigned later
    className: '',
    gradeLevel: 'ม.1',
    departmentId: 'secondary',
    academicYearId: '2569',
    semester: 1,
    status: 'studying',
    enrolledAt: '2026-04-26',
  });
  
  // Update progress
  setImportProgress(Math.round(((i + 1) / 50) * 100));
}

// Commit all writes atomically
await batch.commit();
```

**UI shows progress bar:**
```
┌─────────────────────────────────────────┐
│ กำลังนำเข้า...                          │
│ [████████░░░░░░░░░░] 45%               │
└─────────────────────────────────────────┘
```

---

## Step 7: Confirm Success

**Modal transitions to "result" step**

```
┌─────────────────────────────────────────┐
│ นำเข้านักเรียนจาก CSV                     │
│ ผลการนำเข้า                             │
├─────────────────────────────────────────┤
│                                         │
│        ✓  นำเข้าสำเร็จ                  │
│                                         │
│               50                        │
│        นักเรียนถูกเพิ่มเข้าระบบ           │
│                                         │
├─────────────────────────────────────────┤
│                        [ปิด]            │
└─────────────────────────────────────────┘
```

**Admin clicks "ปิด" to close modal**

System automatically refreshes Student Manager list.

---

## Step 8: Verify in Student Manager

After closing modal, admin can immediately see the new students:

```
📋 จัดการนักเรียน
ปีการศึกษา 2569 · 50 คน (กำลังศึกษา) · 25 ชาย 25 หญิง

[ปี 2569 ▼] [มัธยมศึกษา ▼] [ม.1 ▼] [ทุกห้อง ▼] [นำเข้า] [เพิ่มนักเรียน]

Left Panel (Students List):
┌────────────────────────────────┐
│ 📌 69001 - สมชาย ใจดี          │
│ 📌 69002 - สมหญิง รักเรียน     │
│ 📌 69003 - วิทยา ศรีบัณฑิต     │
│ 📌 69004 - สิทธิ์ ชมเชย        │
│ 📌 69005 - นฤมล ประเสริฐ       │
│ ... (45 more)                  │
└────────────────────────────────┘

Right Panel (Selected Student Details):
┌────────────────────────────────┐
│ 👤 สมชาย ใจดี                  │
│ Code: 69001                     │
│ Gender: Male                    │
│ Status: Active                  │
│                                │
│ Enrollment:                     │
│ Year: 2569                      │
│ Class: (Unassigned)             │
│ Grade: ม.1                      │
│                                │
│ [✎ แก้ไข] [🗑️ ลบ] [•••]       │
└────────────────────────────────┘
```

---

## Step 9: Assign to Classrooms (Optional)

To assign students to classrooms:

1. Click on each student in the list
2. Click "✎ แก้ไข" in the detail panel
3. In StudentDetailPanel:
   - Find the Enrollment section
   - Click "Edit Enrollment"
   - Select a classroom from `availableClasses`
   - Save changes

```typescript
// System updates enrollment
enrollmentDocRef.update({
  classId: 'cls_m1_1',
  className: 'ม.1/1',
});
```

---

## Firestore Final State

After successful import, Firestore contains:

### students collection (50 new documents)
```json
{
  "id": "auto_generated_id_1",
  "studentCode": "69001",
  "prefix": "เด็กชาย",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "gender": "male",
  "status": "active",
  "nationality": "ไทย",
  "religion": "พุทธ",
  "createdAt": "2026-04-26",
  ... other default fields
}
```

### enrollments collection (50 new documents)
```json
{
  "id": "auto_generated_id_2",
  "studentId": "auto_generated_id_1",
  "classId": "",
  "className": "",
  "gradeLevel": "ม.1",
  "departmentId": "secondary",
  "academicYearId": "2569",
  "semester": 1,
  "status": "studying",
  "enrolledAt": "2026-04-26"
}
```

---

## Error Scenarios

### Scenario 1: Invalid Student Code Format

**CSV has:** `studentCode: "ABC"` (not numeric)

**Result:** ✗ Row marked invalid
- Error: "กรุณากรอกเลขประจำตัวนักเรียน"
- Admin can fix in CSV and re-upload

### Scenario 2: Duplicate Student Code in Batch

**CSV has:** 
```
69001, เด็กชาย, สมชาย, ใจดี
69001, เด็กหญิง, ต่างคน, อื่น
```

**Result:** ✗ Second row marked invalid
- Error: "รหัสนักเรียนซ้ำกันในไฟล์ (แถวที่ 3)"

### Scenario 3: Missing Required Field

**CSV missing `prefix` column:**

**Result:** ✗ All rows marked invalid
- Error: "กรุณาเลือกคำนำหน้า"
- Admin must add prefix column and retry

### Scenario 4: Invalid Prefix Value

**CSV has:** `prefix: "ดร."` (not in allowed list)

**Result:** ✗ Row marked invalid
- Error: "คำนำหน้าไม่ถูกต้อง (ใช้: เด็กชาย / เด็กหญิง / นาย / นางสาว)"

---

## Success Metrics

✅ **50 students imported successfully in ~2 seconds**
✅ **50 enrollment records created atomically**
✅ **All students visible in Student Manager**
✅ **Ready for classroom assignment**
✅ **No data loss due to batch atomicity**

---

## Tips & Best Practices

1. **Validate CSV locally first**
   - Open in Excel/Sheets to check format
   - Ensure column headers match exactly

2. **Use the sample template**
   - Download from import modal
   - Copy/paste your data into template

3. **Test with small batch first**
   - Import 5-10 students to verify process
   - Then import remaining students

4. **Classroom assignment in separate step**
   - Import creates unassigned enrollments
   - Assign to classrooms after confirming student data

5. **Keep backup of original CSV**
   - In case you need to reference import data
   - Useful for audit trail

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "ไฟล์ CSV ไม่ถูกต้อง" | Ensure file extension is `.csv` not `.xlsx` |
| "กรุณากรอกข้อมูล..." in config | Academic year, department, and grade are required |
| "เกิดข้อผิดพลาด..." during import | Check Firestore permissions or network connection |
| Students not appearing | Refresh page or clear browser cache |
| Enrollment records missing | Ensure import completed (check progress bar) |

---

**Ready to bulk import? Follow this workflow and you'll have 50+ students in the system in minutes!**
