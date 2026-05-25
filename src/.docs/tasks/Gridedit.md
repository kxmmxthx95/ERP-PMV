"ปรับปรุง Component หน้าแสดงรายการครูผู้สอน (Teacher Directory) ให้เป็นเลย์เอาต์แบบพอดี 1 หน้าจอ (No Vertical Scroll) และมีจุด Pagination Dots โดยมีข้อกำหนดดังนี้:

จำกัดความสูง (Height Constraint): ตั้งค่า Container หลักที่คลุมหน้าจอนี้ด้วย h-[calc(100vh-200px)] และ overflow-hidden เพื่อล็อกไม่ให้หน้าจอมี Scrollbar แนวตั้งโผล่มา

ระบบแบ่งหน้า (Pagination State): สร้าง State currentPage และกำหนด itemsPerPage (เช่น 8 หรือ 10 ใบต่อหน้า ให้พอดีกับ 2 แถว) จากนั้นให้ใช้คำสั่ง .slice() ตัด Array ของข้อมูลครูเพื่อมา Render เฉพาะหน้าที่กำลังเลือกอยู่

Responsive Grid: ใช้ Tailwind Grid ที่ยืดหยุ่น เช่น grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 (ปรับ gap ให้ระยะห่างสวยงาม) และกำหนด content-start เพื่อไม่ให้การ์ดเทไปกองรวมกัน

Pagination Dots: สร้างจุดวงกลม (Dots) ไว้ด้านล่างใต้ Grid การ์ด (แต่อยู่เหนือแถบ Search) จุดหน้าปัจจุบันให้ขยายกว้างขึ้นนิดหน่อยและเปลี่ยนสีให้ชัดเจน (Active State) และสามารถคลิกที่จุดเพื่อเปลี่ยน