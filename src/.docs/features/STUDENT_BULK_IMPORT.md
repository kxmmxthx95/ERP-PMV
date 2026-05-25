# Student Bulk Import Feature

## Overview

The **Student Bulk Import** feature allows administrators to import multiple students into the system from a CSV file with automatic Firestore batch writes. The system validates all data before import and creates both Student and Enrollment records simultaneously.

## Architecture

### Workflow (Wizard Mode)

```
Upload → Config → Preview → Result
  ↓        ↓         ↓        ↓
CSV    Settings   Validate  Success
file   (Year/     & Confirm  Screen
       Grade/
       Dept)
```

### Components

**[StudentCsvImportModal.tsx](../../features/students/components/StudentCsvImportModal.tsx)**
- Main modal component with 4-step wizard
- Handles file parsing with Papa Parse
- Validates student data before import
- Performs batch write to Firestore

## Step-by-Step Workflow

### Step 1: Upload
- User drags & drops or selects a CSV file
- Supports `.csv` format only
- Sample CSV template available for download

**CSV Format:**
```csv
studentCode,prefix,firstName,lastName,departmentId,gradeLevel
67001,เด็กชาย,สมชาย,ใจดี,secondary,ม.1
67002,เด็กหญิง,สมหญิง,รักเรียน,primary,ป.3
```

### Step 2: Configuration
User sets batch context:
- **Academic Year** (select from Firebase `academic_years` collection)
- **Department** (early, primary, secondary)
- **Grade Level** (dynamic based on department)

All records imported in this batch will:
- Use the selected academic year
- Belong to the selected department and grade level
- Create Enrollment records automatically with `semester: 1` and `status: 'studying'`

### Step 3: Preview & Validation
- Shows all parsed rows in table format
- Highlights invalid rows in red
- Displays validation errors (missing fields, invalid prefixes, etc.)
- Shows count of valid vs. invalid records

**Validation Rules:**
| Field | Rule | Error Message |
|-------|------|---------------|
| studentCode | Required, unique within batch | "กรุณากรอกเลขประจำตัวนักเรียน" |
| prefix | Required, one of: เด็กชาย / เด็กหญิง / นาย / นางสาว | "คำนำหน้าไม่ถูกต้อง" |
| firstName | Required | "กรุณากรอกชื่อ" |
| lastName | Required | "กรุณากรอกนามสกุล" |
| departmentId | Required, one of: early / primary / secondary | "แผนกไม่ถูกต้อง" |
| gradeLevel | Required, non-empty | "กรุณากรอกระดับชั้น" |

### Step 4: Result
- Shows number of successful imports
- Lists any failed records with error messages
- User can close modal to return to Student Manager

## Firebase Integration

### Batch Write Logic

When user confirms import, the system:

1. **Creates Student Documents**
   ```typescript
   {
     studentCode: string
     prefix: string
     firstName: string
     lastName: string
     gender: 'male' | 'female' (derived from prefix)
     status: 'active'
     firstNameEn: ''
     lastNameEn: ''
     birthDate: ''
     nationality: 'ไทย'
     religion: 'พุทธ'
     bloodType?: undefined
     allergies: ''
     address: ''
     guardianName: ''
     guardianPhone: ''
     guardianRelation: 'บิดา'
     createdAt: string (ISO date)
   }
   ```

2. **Creates Enrollment Documents**
   ```typescript
   {
     studentId: string (ref to newly created student)
     classId: '' (unassigned - can be set later)
     className: ''
     gradeLevel: string (from config)
     departmentId: string (from config)
     academicYearId: string (from config)
     semester: 1
     status: 'studying'
     enrolledAt: string (ISO date)
   }
   ```

3. **Atomic Operation**
   - Uses `writeBatch()` for atomic writes
   - All-or-nothing: batch succeeds or fails entirely
   - No partial imports due to failures

### Progress Tracking

- Shows real-time progress bar during import
- Updates percentage as each student is processed
- Prevents concurrent imports

## UI/UX Features

### Styling
- Glassmorphism design consistent with system theme
- Background: `rgba(255,255,255,0.96)` with backdrop blur
- Smooth animations using Framer Motion
- Color-coded validation feedback (green = valid, red = invalid)

### Icons (lucide-react)
- `<Upload />` - File upload zone
- `<Settings2 />` - Configuration panel
- `<FileText />` - Sample download
- `<CheckCircle2 />` - Success confirmation
- `<AlertCircle />` - Error messages
- `<Loader />` - Loading indicator
- `<ArrowLeft />` - Back navigation

### Keyboard & Accessibility
- Modal overlay with click-to-close
- Drag & drop support
- File input accept filter (`.csv`)
- Tab navigation through form fields
- ARIA labels for form fields

## Data Flow Integration

```
StudentManager.tsx
    ↓
StudentCsvImportModal
    ├── Upload → Parse CSV with Papa Parse
    ├── Config → Set batch context
    ├── Preview → Validate rows
    └── Result → Firestore batch.commit()
        ├── Creates students/ documents
        └── Creates enrollments/ documents
```

## Error Handling

### Parse Errors
- Invalid file format
- UTF-8 encoding issues
- Malformed CSV structure

### Validation Errors
- Missing required fields
- Invalid enum values
- Duplicate student codes within batch

### Write Errors
- Firestore permission denied
- Network failure
- Batch commit timeout

All errors are displayed with Thai language messages in the result screen.

## Post-Import

After successful import, students:
- Can be viewed in Student Manager list
- Can be assigned to classrooms later
- Have Enrollment records with `status: 'studying'`
- Can have their details edited individually

**To assign to classroom later:**
1. Open Student Detail Panel
2. Edit enrollment information
3. Set `classId` and `className` from available classes

## Type Definitions

```typescript
// Batch configuration for import
interface BatchConfig {
  academicYearId: string;  // e.g., "2569"
  gradeLevel: string;      // e.g., "ม.1"
  departmentId: string;    // "early" | "primary" | "secondary"
}

// Parsed CSV row with validation
interface CsvParsedRow {
  rowIndex: number;
  raw: CsvRawRow;
  data: NewStudent | null;
  errors: string[];
  isValid: boolean;
}

// Import result with statistics
interface ImportResult {
  succeeded: number;
  failed: number;
  errors: Array<{ rowIndex: number; message: string }>;
}
```

## Testing Checklist

- [ ] Upload CSV file with valid data
- [ ] Try uploading non-CSV file (should reject)
- [ ] Verify configuration panel is shown after upload
- [ ] Change academic year, department, grade level
- [ ] Verify preview table displays all rows correctly
- [ ] Test validation errors for missing fields
- [ ] Test duplicate student code detection
- [ ] Verify progress bar updates during import
- [ ] Check students appear in Student Manager after import
- [ ] Verify Enrollment records created in Firestore
- [ ] Test batch failure scenarios
- [ ] Download sample CSV template

## Limitations & Future Enhancements

### Current Limitations
- Supports CSV only (not Excel .xlsx)
- All imported students go to semester 1 only
- Classroom assignment must be done separately
- No bulk classroom assignment during import
- No curriculum binding during import

### Planned Enhancements
- [ ] Add Excel (.xlsx) file support using `xlsx` library
- [ ] Allow classroom assignment during import
- [ ] Add curriculum binding selection
- [ ] Support multiple semesters in batch import
- [ ] Add import history logging
- [ ] Export import results to PDF/Excel
- [ ] Duplicate student detection across system
- [ ] Guardian information import

## References

- CLAUDE.md: Student Management System specifications
- [Student Types](../../types/student.ts): NewStudent, Enrollment, StudentCard
- [useStudentManager Hook](../../hooks/useStudentManager.ts): CRUD operations
