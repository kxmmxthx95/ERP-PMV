#pragma once

// ESP32-2432S028 (Cheap Yellow Display) — touch ใช้ SPI คนละ bus กับจอ
// ไม่ใช้ TFT_eSPI getTouch() (ใช้ไม่ได้บนบอร์ดนี้)

#define XPT2046_IRQ 36
#define XPT2046_MOSI 32
#define XPT2046_MISO 39
#define XPT2046_CLK 25
#define XPT2046_CS 33

// ค่า map เริ่มต้น (landscape rotation=1, 320×240) — ปรับใน config.h ถ้าแตะเพี้ยน
#ifndef TOUCH_MAP_X_MIN
#define TOUCH_MAP_X_MIN 200
#endif
#ifndef TOUCH_MAP_X_MAX
#define TOUCH_MAP_X_MAX 3700
#endif
#ifndef TOUCH_MAP_Y_MIN
#define TOUCH_MAP_Y_MIN 240
#endif
#ifndef TOUCH_MAP_Y_MAX
#define TOUCH_MAP_Y_MAX 3800
#endif
