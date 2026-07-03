# PMV Fingerprint Terminal (ESP32 + AS608 + LVGL)

เทอร์มินัลลงเวลาด้วยลายนิ้วมือ ส่งข้อมูลเข้าระบบ PMV-ONE ผ่าน WiFi

## สิ่งที่ต้องมี

| อุปกรณ์ | หมายเหตุ |
|---------|----------|
| ESP32 | แนะนำ ESP32-2432S028 หรือ ESP32 + จอ ILI9341 320×240 |
| AS608 | เชื่อม UART (57600 baud) |
| จอ TFT | SPI — ปรับขาใน `platformio.ini` |

## การเชื่อมต่อ AS608

### บอร์ด ESP32-2432S028 (Cheap Yellow Display) — แนะนำ

ใช้ขา **P3** หรือ **CN1** บนบอร์ด (อย่าใช้ GPIO16/17 — ชน PSRAM บนบอร์ด CYD):

```
พอร์ต P3/CN1 บนบอร์ด CYD (4 ขา):
  GND   → AS608 GND (ดำ)
  3.3V  → AS608 VCC (แดง)
  IO22  → สายข้อมูล AS608 (เขียว/ขาว สลับกันได้)
  IO27  → สายข้อมูล AS608 (อีกเส้น)
```

Firmware จะลองทั้ง IO22↔IO27 และสลับ TX/RX ให้อัตโนมัติ — ไม่ต้องกังวลสีสายมาก

ถ้าต้องการต่อแบบมาตรฐาน (DevKit):
```
AS608 TX  →  ESP32 GPIO16 (RX)
AS608 RX  →  ESP32 GPIO17 (TX)
```

## ตั้งค่า Cloud (ครั้งเดียว)

### 1. Deploy Cloud Function

```bash
cd src/functions && npm run build
firebase deploy --only functions:deviceFingerprintAttendance
firebase deploy --only hosting   # rewrite /api/device-fingerprint
```

หรือตั้ง `DEVICE_FINGERPRINT_MASTER_KEY` ใน Firebase Functions config สำหรับทดสอบ:

```bash
firebase functions:config:set device.master_key="your-dev-key"
```

(ในโค้ดใช้ env `DEVICE_FINGERPRINT_MASTER_KEY` — ตั้งใน Firebase Console → Functions → Environment variables)

### 2. ลงทะเบียนอุปกรณ์

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
node scripts/register-fingerprint-device.mjs gate-01 "your-secret-api-key" "ประตูหลัก"
```

สร้างเอกสาร `attendance_devices/gate-01`:

```json
{
  "name": "ประตูหลัก",
  "apiKeyHash": "<sha256 ของ api key>",
  "active": true
}
```

### 3. ผูกลายนิ้วมือกับผู้ใช้

ใน Firestore `users/{uid}` เพิ่มฟิลด์:

```json
{
  "fingerprintTemplateId": 12,
  "role": "teacher",
  "status": "active"
}
```

`fingerprintTemplateId` ต้องตรงกับ slot ที่ enroll บน AS608 (1–127)

### 4. Enroll ลายนิ้วบน AS608

ใช้โปรแกรม enroll ของ Adafruit หรือเพิ่มโหมด enroll ใน firmware (ลงทะเบียนลายนิ้ว → จดเลข slot → ใส่ใน Firestore)

## ตั้งค่า Firmware

```bash
cd firmware/pmv-fingerprint-terminal
cp include/config.example.h include/config.h
# แก้ WiFi, PMV_API_URL, PMV_DEVICE_ID, PMV_DEVICE_API_KEY
pio run -t upload
pio device monitor
```

## API Contract

```http
POST https://<your-host>/api/device-fingerprint
Authorization: Bearer <DEVICE_API_KEY>
Content-Type: application/json

{
  "deviceId": "gate-01",
  "fingerprintTemplateId": 12,
  "action": "toggle"
}
```

| action | พฤติกรรม |
|--------|----------|
| `toggle` | ยังไม่เช็คอิน → เช็คอิน / เช็คอินแล้ว → เช็คเอาต์ |
| `checkIn` | บังคับเช็คอิน |
| `checkOut` | บังคับเช็คเอาต์ |
| `status` | ดูสถานะวันนี้ |

ข้อมูลบันทึกที่ `staff_attendance_by_date/{date}/entries/{userId}` พร้อม `source: "fingerprint_device"`

## แสดงผล LVGL

- หัวข้อ PMV Check-In
- สถานะ WiFi (มุมขวาบน)
- **ไอคอนเมนู** มุมซ้ายบน: ฟันเฟือง (ตั้งค่า) และ WiFi (ตั้งค่าการเชื่อมต่อ)
- หน้าตั้งค่า → ตั้งค่า WiFi → **คีย์บอร์ดบนจอ** พิมพ์ SSID/รหัสผ่าน + ปุ่ม Save / Connect
- ค่า WiFi บันทึกลง **NVS (flash)** — ไม่ต้อง flash ใหม่ทุกครั้งที่เปลี่ยน WiFi (ครั้งแรกใช้ค่าจาก `config.h`)
- ชื่อผู้ใช้ + ผลเช็คอิน/เช็คเอาต์ (หน้าหลัก)

บอร์ด **ESP32-2432S028** ใช้ touch **XPT2046 บน SPI แยก** (ขา 32/39/25/33) — แตะไอคอนเพื่อเข้าเมนู  
WiFi SSID/รหัสผ่านตั้งบนจอได้แล้ว (คีย์บอร์ด LVGL) — หรือใส่ค่าเริ่มต้นใน `include/config.h` ก่อน flash ครั้งแรก

## Troubleshooting

| อาการ | แก้ไข |
|-------|--------|
| AS608 ไม่พบ | สลับ TX/RX, ตรวจ baud 57600, ใช้ 3.3V |
| 401 Unauthorized | ตรวจ API key และ `attendance_devices` |
| 404 ไม่พบผู้ใช้ | ตั้ง `fingerprintTemplateId` ใน users |
| WiFi ไม่ติด | 2.4 GHz เท่านั้น (ESP32 ไม่รองรับ 5 GHz) |
| จอไม่แสดง | ปรับ `TFT_*` pins ใน `platformio.ini` ให้ตรงบอร์ด |
| แตะเมนูไม่ได้ / ตำแหน่งเพี้ยน | ใช้ env `esp32-2432s028` — ปรับ `TOUCH_MAP_*` ใน `config.h` หรือ `touch_cyd.h` |

## Live mirror ผ่าน Web Serial (Portal)

Firmware ส่ง telemetry บรรทัดละ JSON ขึ้นต้นด้วย `@PMV` ที่ **115200 baud** (USB debug serial) ทุกครั้งที่หน้าจอหรือสถานะเปลี่ยน

ตัวอย่าง:
```
@PMV{"v":1,"ev":"screen","screen":"home"}
@PMV{"v":1,"ev":"home","status":"วางนิ้วบนเซ็นเซอร์","name":"","time":"","wifi":true,"fp":true}
@PMV{"v":1,"ev":"enroll","phase":"wait_finger1","status":"วางนิ้วบนเซ็นเซอร์","detail":"ครั้งที่ 1"}
```

หน้า `/portal/fingerprint-devices` → กด **เชื่อมบอร์ดจริง** (Chrome/Edge, localhost) → จอจำลอง sync แบบ real-time  
Log debug ปกติ (`[AS608]`, `[WiFi]`) ไม่ถูก parse — แยกจาก `@PMV` โดยเฉพาะ

หลังแก้ telemetry ต้อง flash firmware ใหม่:
```bash
cd firmware/pmv-fingerprint-terminal
pio run -e esp32-2432s028 -t upload --upload-port /dev/cu.usbserial-XXXX
```

## โครงสร้างไฟล์

```
firmware/pmv-fingerprint-terminal/
  platformio.ini
  include/config.example.h   → copy เป็น config.h
  include/pmv_telemetry.h  ← @PMV JSON สำหรับ Web Serial mirror
  include/lv_conf.h
  src/main.cpp
src/functions/src/deviceFingerprintAttendance.ts   ← Cloud Function
scripts/register-fingerprint-device.mjs
```
