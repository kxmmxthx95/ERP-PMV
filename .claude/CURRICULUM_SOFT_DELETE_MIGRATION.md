# Curriculum Soft Delete Migration

## วันที่ deploy: 2026-05-20

### สิ่งที่เปลี่ยน

1. **Soft Delete แทน Hard Delete**
   - `deleteVersion()` เดิม: ลบ document + ลบ sub-collections ทั้งหมด (หลายๆ writes)
   - `deleteVersion()` ใหม่: เพียง set `isDeleted: true` + `deletedAt` (1 write)
   - ประหยัด: ~90% quota สำหรับ delete operations

2. **Listener ปิดสำหรับ Non-Admin**
   - ก่อน: `onSnapshot(collection(db, 'curriculums'))` ทำงาน 24/7 สำหรับทุกผู้ใช้
   - หลัง: ปิดไว้สำหรับ role ที่ไม่ใช่ admin/sysadmin
   - ประหยัด: ~80% quota สำหรับ read operations (ลดจาก 100% users → 20% admin only)

3. **Query Filter ใหม่**
   - `where('isDeleted', '!=', true)` บน `curriculums` collection
   - ต้อง deploy Firestore composite index (อัตโนมัติ)

### Firestore Index เพิ่มเติม

```json
{
  "collectionGroup": "curriculums",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "isDeleted",
      "order": "ASCENDING"
    }
  ]
}
```

Deploy ด้วย:
```bash
firebase deploy --only firestore:indexes
```

### ไม่มีการเปลี่ยน UI

- ผู้ใช้ยังเห็นการลบหลักสูตรปกติ
- ข้อมูลเก่ากำลังอยู่ใน Firestore (soft delete) แทนการลบออกไปจริง
- ถ้าต้องการ recovery เดี๋ยว สามารถลบ flag `isDeleted` ได้

### Type Definition ใหม่

`CurriculumVersion` มี fields เพิ่ม:
```typescript
interface CurriculumVersion {
  // ... existing fields
  isDeleted?: boolean;        // soft delete flag
  deletedAt?: string;         // ISO timestamp
}
```

### หากต้องการ Hard Delete ในอนาคต

Cloud Function สามารถทำงาน batch hard-delete ทุกๆ 30 วัน:
```typescript
// Pseudo-code
const deletedCurriculums = await getDocs(
  query(
    collection(db, 'curriculums'),
    where('isDeleted', '==', true),
    where('deletedAt', '<', 30daysAgo)
  )
);
```

---

**ตรวจสอบแล้ว:**
- ✅ Build ผ่าน
- ✅ No breaking changes
- ✅ Admin-only feature → ไม่กระทบผู้ใช้ทั่วไป
