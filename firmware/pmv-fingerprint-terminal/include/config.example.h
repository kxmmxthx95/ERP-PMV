#pragma once

// คัดลอกไฟล์นี้เป็น config.h แล้วกรอกค่าจริง (อย่า commit config.h)

// --- WiFi ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// --- PMV Cloud API ---
// ใช้ URL จาก Firebase Hosting rewrite หรือ Cloud Functions โดยตรง
#define PMV_API_URL "https://pmv1-90180.web.app/api/device-fingerprint"
#define PMV_DEVICE_ID "gate-01"
#define PMV_DEVICE_API_KEY "replace-with-your-device-api-key"

// --- AS608 Fingerprint (HardwareSerial UART2) ---
// CYD ESP32-2432S028: ใช้ P3/CN1 (GPIO22 RX, GPIO27 TX)
// บอร์ด ESP32 DevKit ทั่วไป: ใช้ GPIO16/17 ได้
// CYD P3/CN1: GND, 3.3V, IO22, IO27 — สลับสายข้อมูลได้ firmware จะสแกนให้
#define FP_RX_PIN 27   // ESP32 RX ← สายจาก AS608 TX
#define FP_TX_PIN 22   // ESP32 TX → สายจาก AS608 RX
#define FP_BAUD 57600

// --- จอ TFT (backlight) ---
// ESP32-2432S028 ใช้ GPIO21 — ถ้าไม่มีขา BL แยก ใส่ -1
#define TFT_BL_PIN 21
#define TFT_BL_ON HIGH

// --- การทำงาน ---
#define SCAN_COOLDOWN_MS 2500   // กันสแกนซ้ำเร็วเกินไป
#define WIFI_RETRY_MS 15000
