/**
 * PMV-ONE Fingerprint Attendance Terminal
 * ESP32 + AS608 + LVGL + WiFi → POST /api/device-fingerprint
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <lvgl.h>
#if PMV_TOUCH_XPT2046
#include <SPI.h>
#include <XPT2046_Touchscreen.h>
#include "touch_cyd.h"
#endif

#include "config.h"
#include "fonts.h"
#include "ui_theme.h"
#include "pmv_telemetry.h"

#ifndef TOUCH_CS
#define TOUCH_CS -1
#endif

#if PMV_TOUCH_XPT2046
static SPIClass touchSpi(VSPI);
static XPT2046_Touchscreen touchScreen(XPT2046_CS, XPT2046_IRQ);
#endif

// --- Hardware ---
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);
TFT_eSPI tft = TFT_eSPI();

static lv_disp_draw_buf_t drawBuf;
static lv_color_t buf1[320 * 10];
static lv_color_t buf2[320 * 10];

enum UiScreen : uint8_t {
  UI_HOME = 0,
  UI_SETTINGS = 1,
  UI_WIFI = 2,
  UI_ENROLL = 3,
  UI_USERS = 4,
  UI_USERS_LIST = 5,
};

// --- Screens ---
static lv_obj_t* scrHome;
static lv_obj_t* scrSettings;
static lv_obj_t* scrWifi;
static lv_obj_t* scrEnroll;
static lv_obj_t* scrUsers;
static lv_obj_t* scrUsersList;

// --- Home UI ---
static lv_obj_t* labelTitle;
static lv_obj_t* labelStatus;
static lv_obj_t* labelName;
static lv_obj_t* labelTime;
static lv_obj_t* labelWifi;

// --- Settings / WiFi UI ---
static lv_obj_t* taWifiPass;
static lv_obj_t* kbWifi;
static lv_obj_t* labelWifiStatus;
static lv_obj_t* listWifiScan;
static lv_obj_t* panelWifiConnect;
static lv_obj_t* labelSelectedSsid;

static lv_obj_t* labelEnrollStatus;
static lv_obj_t* labelEnrollDetail;
static lv_obj_t* labelEnrollStep1;
static lv_obj_t* labelEnrollStepLift;
static lv_obj_t* labelEnrollStep2;

static lv_obj_t* listUsers;
static lv_obj_t* labelUsersStatus;
static lv_obj_t* labelUsersListTitle;
static lv_obj_t* btnUsersCat[4];
static bool usersFetchPending = false;
static bool usersSkipRefetch = false;
static int8_t usersSelectedCategory = -1;
static int8_t usersPendingListCategory = -1;
static bool usersCacheValid = false;
static StaticJsonDocument<8192> usersCacheDoc;

static const char* USERS_CAT_IDS[] = {"student", "teacher", "special_teacher", "staff"};
static const char* USERS_CAT_TITLES[] = {"นักเรียน", "ครูผู้สอน", "ครูพิเศษ", "เจ้าหน้าที่"};
static const char* USERS_CAT_ICONS[] = {LV_SYMBOL_FILE, LV_SYMBOL_SETTINGS, LV_SYMBOL_TINT, LV_SYMBOL_DIRECTORY};

static char wifiSsid[33] = "";
static char wifiPass[65] = "";

static int selectedScanIdx = -1;

struct WifiScanEntry {
  char ssid[33];
  int32_t rssi;
  wifi_auth_mode_t auth;
};

static WifiScanEntry scanCache[16];
static int scanResultCount = 0;

static Preferences wifiPrefs;

// --- State ---
static UiScreen currentScreen = UI_HOME;
static uint32_t lastScanMs = 0;
static bool wifiReady = false;
static bool fpReady = false;
static uint32_t lastFpRetryMs = 0;

static void showScreen(UiScreen screen);
static void setWifiLabel(bool ok);
static void layoutHomeLabels();
static void setStatus(const char* status, const char* name = "", const char* time = "");
static void updateWifiDetailLabels();
static void connectWifi(bool updateHomeStatus = true);
static void hideWifiKeyboard();
static void readWifiFromUi();
static void loadWifiConfig();
static void saveWifiConfig();
static void scanWifiNetworks();
static void rebuildWifiList();
static void onWifiScanClicked(lv_event_t* e);
static void onWifiNetworkSelected(lv_event_t* e);
static void onWifiConnectClicked(lv_event_t* e);
static void onWifiConnectCancel(lv_event_t* e);
static void showWifiConnectPanel(int idx);
static void hideWifiConnectPanel();
static void startWifiConnection();
static void setEnrollLabels(const char* status, const char* detail = "");
static void resetEnrollFlow();
static void startEnrollFlow();
static void handleEnrollTick();

enum EnrollPhase : uint8_t {
  ENROLL_IDLE = 0,
  ENROLL_WAIT_FINGER1,
  ENROLL_WAIT_RELEASE,
  ENROLL_WAIT_FINGER2,
  ENROLL_DONE,
  ENROLL_FAIL,
};

static void updateEnrollVisual(EnrollPhase phase);

static EnrollPhase enrollPhase = ENROLL_IDLE;
static uint8_t enrollSlot = 0;

static bool findEmptyEnrollSlot(uint8_t* outSlot) {
  finger.getParameters();
  const uint16_t capacity = finger.capacity > 0 ? finger.capacity : 127;
  for (uint16_t id = 1; id <= capacity; id++) {
    if (finger.loadModel(id) != FINGERPRINT_OK) {
      *outSlot = (uint8_t)id;
      return true;
    }
  }
  return false;
}

static void loadWifiConfig() {
  wifiPrefs.begin("pmv-wifi", true);
  const String ssid = wifiPrefs.getString("ssid", "");
  const String pass = wifiPrefs.getString("pass", "");
  wifiPrefs.end();

  if (ssid.length() > 0) {
    ssid.toCharArray(wifiSsid, sizeof(wifiSsid));
    pass.toCharArray(wifiPass, sizeof(wifiPass));
    Serial.println("[WiFi] Loaded credentials from NVS");
  } else {
    strncpy(wifiSsid, WIFI_SSID, sizeof(wifiSsid) - 1);
    strncpy(wifiPass, WIFI_PASSWORD, sizeof(wifiPass) - 1);
    Serial.println("[WiFi] Using config.h defaults");
  }
  wifiSsid[sizeof(wifiSsid) - 1] = '\0';
  wifiPass[sizeof(wifiPass) - 1] = '\0';
}

static void saveWifiConfig() {
  readWifiFromUi();
  wifiPrefs.begin("pmv-wifi", false);
  wifiPrefs.putString("ssid", wifiSsid);
  wifiPrefs.putString("pass", wifiPass);
  wifiPrefs.end();
  Serial.printf("[WiFi] Saved SSID=%s\n", wifiSsid);
}

static void persistWifiConfig() {
  wifiPrefs.begin("pmv-wifi", false);
  wifiPrefs.putString("ssid", wifiSsid);
  wifiPrefs.putString("pass", wifiPass);
  wifiPrefs.end();
  Serial.printf("[WiFi] Saved SSID=%s\n", wifiSsid);
}

static bool isNetworkOpen(int idx) {
  return idx >= 0 && idx < scanResultCount && scanCache[idx].auth == WIFI_AUTH_OPEN;
}

static void readWifiFromUi() {
  if (!taWifiPass) return;
  strncpy(wifiPass, lv_textarea_get_text(taWifiPass), sizeof(wifiPass) - 1);
  wifiPass[sizeof(wifiPass) - 1] = '\0';
}

static void hideWifiConnectPanel() {
  selectedScanIdx = -1;
  if (panelWifiConnect) lv_obj_add_flag(panelWifiConnect, LV_OBJ_FLAG_HIDDEN);
  if (taWifiPass) lv_textarea_set_text(taWifiPass, "");
  if (listWifiScan) {
    lv_obj_set_size(listWifiScan, 288, 178);
    lv_obj_align(listWifiScan, LV_ALIGN_TOP_MID, 0, 52);
  }
}

static void hideWifiKeyboard() {
  if (!kbWifi) return;
  lv_keyboard_set_textarea(kbWifi, NULL);
  lv_obj_add_flag(kbWifi, LV_OBJ_FLAG_HIDDEN);
  if (listWifiScan && selectedScanIdx < 0) lv_obj_clear_flag(listWifiScan, LV_OBJ_FLAG_HIDDEN);
  if (labelWifiStatus) lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  if (panelWifiConnect && selectedScanIdx >= 0) lv_obj_clear_flag(panelWifiConnect, LV_OBJ_FLAG_HIDDEN);
}

static void textareaFocusCb(lv_event_t* e) {
  const lv_event_code_t code = lv_event_get_code(e);
  lv_obj_t* ta = lv_event_get_target(e);
  if (code == LV_EVENT_FOCUSED) {
    if (listWifiScan) lv_obj_add_flag(listWifiScan, LV_OBJ_FLAG_HIDDEN);
    if (labelWifiStatus) lv_obj_add_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
    lv_keyboard_set_textarea(kbWifi, ta);
    lv_obj_clear_flag(kbWifi, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(kbWifi);
  }
}

static void keyboardEventCb(lv_event_t* e) {
  const lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_READY || code == LV_EVENT_CANCEL) {
    hideWifiKeyboard();
  }
}

static lv_obj_t* createWifiTextarea(lv_obj_t* parent, lv_coord_t y, const char* placeholder,
                                    bool passwordMode) {
  lv_obj_t* ta = lv_textarea_create(parent);
  lv_obj_set_size(ta, 288, 34);
  lv_obj_align(ta, LV_ALIGN_TOP_MID, 0, y);
  lv_obj_set_style_bg_color(ta, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_border_color(ta, lv_color_hex(PMV_COL_BORDER), 0);
  lv_obj_set_style_border_width(ta, 1, 0);
  lv_obj_set_style_text_color(ta, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_radius(ta, 8, 0);
  lv_textarea_set_one_line(ta, true);
  lv_textarea_set_max_length(ta, passwordMode ? 63 : 32);
  lv_textarea_set_placeholder_text(ta, placeholder);
  if (passwordMode) lv_textarea_set_password_mode(ta, true);
  lv_obj_set_style_text_font(ta, PMV_FONT_BODY, 0);
  lv_obj_add_event_cb(ta, textareaFocusCb, LV_EVENT_FOCUSED, NULL);
  return ta;
}

static void initBacklight() {
#if TFT_BL_PIN >= 0
  pinMode(TFT_BL_PIN, OUTPUT);
  digitalWrite(TFT_BL_PIN, TFT_BL_ON);
  Serial.printf("[TFT] Backlight GPIO%d ON\n", TFT_BL_PIN);
#endif
}

static void refreshUiNow() {
  for (int i = 0; i < 8; i++) {
    lv_timer_handler();
    delay(5);
  }
  lv_refr_now(NULL);
}

static void lvFlushCb(lv_disp_drv_t* disp, const lv_area_t* area, lv_color_t* color_p) {
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.pushColors((uint16_t*)&color_p->full, w * h, true);
  tft.endWrite();
  lv_disp_flush_ready(disp);
}

#if PMV_TOUCH_XPT2046
static bool readTouchPoint(int16_t* outX, int16_t* outY) {
  if (!touchScreen.tirqTouched() || !touchScreen.touched()) return false;

  const TS_Point p = touchScreen.getPoint();
  int16_t x = map(p.x, TOUCH_MAP_X_MIN, TOUCH_MAP_X_MAX, 0, 319);
  int16_t y = map(p.y, TOUCH_MAP_Y_MIN, TOUCH_MAP_Y_MAX, 0, 239);
  if (x < 0) x = 0;
  if (x > 319) x = 319;
  if (y < 0) y = 0;
  if (y > 239) y = 239;
  *outX = x;
  *outY = y;
  return true;
}

static void initTouchInput() {
  touchSpi.begin(XPT2046_CLK, XPT2046_MISO, XPT2046_MOSI, XPT2046_CS);
  touchScreen.begin(touchSpi);
  touchScreen.setRotation(1);
  Serial.println("[Touch] XPT2046 ready (SPI 25/32/39, CS=33)");
}

static void touchReadCb(lv_indev_drv_t* drv, lv_indev_data_t* data) {
  (void)drv;
  int16_t x = 0;
  int16_t y = 0;
  if (!readTouchPoint(&x, &y)) {
    data->state = LV_INDEV_STATE_RELEASED;
    return;
  }
  data->state = LV_INDEV_STATE_PRESSED;
  data->point.x = x;
  data->point.y = y;
}
#elif TOUCH_CS >= 0
static void touchReadCb(lv_indev_drv_t* drv, lv_indev_data_t* data) {
  (void)drv;
  uint16_t x = 0;
  uint16_t y = 0;
  const bool pressed = tft.getTouch(&x, &y);
  if (!pressed) {
    data->state = LV_INDEV_STATE_RELEASED;
    return;
  }
  data->state = LV_INDEV_STATE_PRESSED;
  data->point.x = x;
  data->point.y = y;
}
#endif

static lv_obj_t* createIconButton(lv_obj_t* parent, const char* symbol, lv_coord_t x, lv_coord_t y,
                                  lv_event_cb_t cb, bool accent = false) {
  lv_obj_t* btn = lv_btn_create(parent);
  lv_obj_set_size(btn, 36, 36);
  lv_obj_set_pos(btn, x, y);
  lv_obj_set_style_radius(btn, 8, 0);
  lv_obj_set_style_bg_color(btn, lv_color_hex(accent ? PMV_COL_BTN_DARK : PMV_COL_BTN), 0);
  lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(btn, 0, 0);
  lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t* icon = lv_label_create(btn);
  lv_label_set_text(icon, symbol);
  lv_obj_set_style_text_color(icon, lv_color_hex(PMV_COL_BTN_TEXT), 0);
  lv_obj_set_style_text_font(icon, PMV_FONT_ICON, 0);
  lv_obj_center(icon);
  return btn;
}

static lv_obj_t* createBackButton(lv_obj_t* parent, lv_event_cb_t cb) {
  return createIconButton(parent, LV_SYMBOL_LEFT, 8, 8, cb, false);
}

static void onHomeSettingsClicked(lv_event_t* e) {
  (void)e;
  showScreen(UI_SETTINGS);
}

static void onSettingsBackClicked(lv_event_t* e) {
  (void)e;
  showScreen(UI_HOME);
}

static void onSettingsWifiClicked(lv_event_t* e) {
  (void)e;
  updateWifiDetailLabels();
  showScreen(UI_WIFI);
}

static void onSettingsEnrollClicked(lv_event_t* e) {
  (void)e;
  showScreen(UI_ENROLL);
}

static void onSettingsUsersClicked(lv_event_t* e) {
  (void)e;
  showScreen(UI_USERS);
}

static void onUsersBackClicked(lv_event_t* e) {
  (void)e;
  if (currentScreen == UI_USERS_LIST) {
    usersSkipRefetch = true;
    showScreen(UI_USERS);
    return;
  }
  showScreen(UI_SETTINGS);
}

static void onUsersListBackClicked(lv_event_t* e) {
  (void)e;
  usersSkipRefetch = true;
  showScreen(UI_USERS);
}

static void onUsersRefreshClicked(lv_event_t* e) {
  (void)e;
  usersFetchPending = true;
}

static void onEnrollBackClicked(lv_event_t* e) {
  (void)e;
  resetEnrollFlow();
  showScreen(UI_SETTINGS);
}

static void onEnrollRetryClicked(lv_event_t* e) {
  (void)e;
  startEnrollFlow();
}

static void onWifiBackClicked(lv_event_t* e) {
  (void)e;
  hideWifiKeyboard();
  hideWifiConnectPanel();
  showScreen(UI_SETTINGS);
}

static void onWifiConnectCancel(lv_event_t* e) {
  (void)e;
  hideWifiKeyboard();
  hideWifiConnectPanel();
  if (scanResultCount > 0) {
    lv_obj_add_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_label_set_text(labelWifiStatus, "แตะค้นหา WiFi");
    lv_obj_set_style_text_color(labelWifiStatus, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
    lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  }
}

static void onWifiConnectClicked(lv_event_t* e) {
  (void)e;
  startWifiConnection();
}

static void startWifiConnection() {
  if (selectedScanIdx < 0 || selectedScanIdx >= scanResultCount) return;
  hideWifiKeyboard();
  if (!isNetworkOpen(selectedScanIdx)) {
    readWifiFromUi();
  }
  persistWifiConfig();
  lv_label_set_text(labelWifiStatus, "กำลังเชื่อม WiFi...");
  lv_obj_set_style_text_color(labelWifiStatus, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
  lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  refreshUiNow();
  connectWifi(false);
  if (wifiReady) {
    hideWifiConnectPanel();
    rebuildWifiList();
  }
}

static void showWifiConnectPanel(int idx) {
  if (idx < 0 || idx >= scanResultCount || !panelWifiConnect || !labelSelectedSsid || !taWifiPass) return;

  selectedScanIdx = idx;
  const bool hasSavedPass =
      strcmp(scanCache[idx].ssid, wifiSsid) == 0 && wifiPass[0] != '\0';
  strncpy(wifiSsid, scanCache[idx].ssid, sizeof(wifiSsid) - 1);
  wifiSsid[sizeof(wifiSsid) - 1] = '\0';

  lv_label_set_text(labelSelectedSsid, wifiSsid);
  lv_textarea_set_text(taWifiPass, hasSavedPass ? wifiPass : "");
  lv_obj_clear_flag(panelWifiConnect, LV_OBJ_FLAG_HIDDEN);
  lv_obj_set_size(listWifiScan, 288, 88);
  lv_obj_align(listWifiScan, LV_ALIGN_TOP_MID, 0, 52);

  lv_label_set_text(labelWifiStatus, "กรอกรหัสผ่านแล้วกดเชื่อมต่อ");
  lv_obj_set_style_text_color(labelWifiStatus, lv_color_hex(PMV_COL_INFO), 0);
  lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
}

static void styleWifiListRow(lv_obj_t* btn, const char* icon, bool isCurrent) {
  if (!btn || !icon) return;

  lv_obj_t* iconLbl = lv_label_create(btn);
  lv_label_set_text(iconLbl, icon);
  lv_obj_set_style_text_font(iconLbl, PMV_FONT_ICON, 0);
  lv_obj_set_style_text_color(iconLbl,
                              lv_color_hex(isCurrent ? PMV_COL_OK : PMV_COL_TEXT_MUTED), 0);
  lv_obj_move_to_index(iconLbl, 0);

  const uint32_t childCount = lv_obj_get_child_cnt(btn);
  for (uint32_t i = 0; i < childCount; i++) {
    lv_obj_t* child = lv_obj_get_child(btn, i);
    if (child == iconLbl || !lv_obj_check_type(child, &lv_label_class)) continue;
    lv_obj_set_style_text_font(child, PMV_FONT_BODY, 0);
    if (isCurrent) {
      lv_obj_set_style_text_color(child, lv_color_hex(PMV_COL_OK), 0);
    }
    break;
  }
}

static void rebuildWifiList() {
  if (!listWifiScan) return;

  lv_obj_clean(listWifiScan);

  const bool connected = wifiReady && WiFi.status() == WL_CONNECTED;
  for (int i = 0; i < scanResultCount; i++) {
    const bool isCurrent = connected && strcmp(scanCache[i].ssid, wifiSsid) == 0;

    char line[36];
    snprintf(line, sizeof(line), "%s %ddBm", scanCache[i].ssid, scanCache[i].rssi);

    const char* icon = isCurrent ? LV_SYMBOL_OK : LV_SYMBOL_WIFI;
    lv_obj_t* btn = lv_list_add_btn(listWifiScan, NULL, line);
    styleWifiListRow(btn, icon, isCurrent);
    lv_obj_add_event_cb(btn, onWifiNetworkSelected, LV_EVENT_CLICKED,
                        reinterpret_cast<void*>(static_cast<intptr_t>(i)));
  }
}

static void onWifiNetworkSelected(lv_event_t* e) {
  const int idx = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
  if (idx < 0 || idx >= scanResultCount) return;

  hideWifiKeyboard();
  strncpy(wifiSsid, scanCache[idx].ssid, sizeof(wifiSsid) - 1);
  wifiSsid[sizeof(wifiSsid) - 1] = '\0';

  if (isNetworkOpen(idx)) {
    selectedScanIdx = idx;
    wifiPass[0] = '\0';
    startWifiConnection();
    return;
  }

  showWifiConnectPanel(idx);
}

static void scanWifiNetworks() {
  if (!listWifiScan || !labelWifiStatus) return;

  hideWifiKeyboard();
  hideWifiConnectPanel();
  lv_obj_add_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  refreshUiNow();
  pmvEmitWifi(true, wifiReady, wifiSsid, "");

  WiFi.mode(WIFI_STA);
  WiFi.scanDelete();
  const int found = WiFi.scanNetworks(false, false);

  scanResultCount = 0;

  if (found <= 0) {
    lv_obj_clean(listWifiScan);
    const char* errMsg = found == 0 ? "ไม่พบ WiFi รอบๆ" : "ค้นหา WiFi ล้มเหลว";
    lv_label_set_text(labelWifiStatus, errMsg);
    lv_obj_set_style_text_color(labelWifiStatus, lv_color_hex(PMV_COL_ERR), 0);
    lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
    WiFi.scanDelete();
    pmvEmitWifi(false, wifiReady, wifiSsid, errMsg);
    StaticJsonDocument<64> emptyDoc;
    JsonArray emptyArr = emptyDoc.to<JsonArray>();
    pmvEmitWifiScan(emptyArr);
    refreshUiNow();
    return;
  }

  WifiScanEntry entries[24];
  int entryCount = 0;

  for (int i = 0; i < found && entryCount < 24; i++) {
    const String ssid = WiFi.SSID(i);
    if (ssid.length() == 0) continue;

    const int32_t rssi = WiFi.RSSI(i);
    const wifi_auth_mode_t auth = WiFi.encryptionType(i);

    int existing = -1;
    for (int j = 0; j < entryCount; j++) {
      if (strcmp(entries[j].ssid, ssid.c_str()) == 0) {
        existing = j;
        break;
      }
    }

    if (existing >= 0) {
      if (rssi > entries[existing].rssi) {
        entries[existing].rssi = rssi;
        entries[existing].auth = auth;
      }
    } else {
      ssid.toCharArray(entries[entryCount].ssid, sizeof(entries[entryCount].ssid));
      entries[entryCount].rssi = rssi;
      entries[entryCount].auth = auth;
      entryCount++;
    }
  }

  for (int i = 0; i < entryCount - 1; i++) {
    for (int j = i + 1; j < entryCount; j++) {
      if (entries[j].rssi > entries[i].rssi) {
        const WifiScanEntry tmp = entries[i];
        entries[i] = entries[j];
        entries[j] = tmp;
      }
    }
  }

  scanResultCount = entryCount > 16 ? 16 : entryCount;
  for (int i = 0; i < scanResultCount; i++) {
    scanCache[i] = entries[i];
  }

  WiFi.scanDelete();
  rebuildWifiList();

  if (scanResultCount > 0) {
    lv_obj_add_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_label_set_text(labelWifiStatus, "ไม่พบ WiFi รอบๆ");
    lv_obj_set_style_text_color(labelWifiStatus, lv_color_hex(PMV_COL_ERR), 0);
    lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  }

  StaticJsonDocument<1024> scanDoc;
  JsonArray networks = scanDoc.to<JsonArray>();
  const int emitCount = scanResultCount > 8 ? 8 : scanResultCount;
  for (int i = 0; i < emitCount; i++) {
    JsonObject net = networks.add<JsonObject>();
    net["ssid"] = scanCache[i].ssid;
    net["rssi"] = scanCache[i].rssi;
  }
  pmvEmitWifi(false, wifiReady, wifiSsid, scanResultCount > 0 ? "" : "ไม่พบ WiFi รอบๆ");
  pmvEmitWifiScan(networks);

  refreshUiNow();
}

static void onWifiScanClicked(lv_event_t* e) {
  (void)e;
  scanWifiNetworks();
}

static void initDisplay() {
  initBacklight();

  tft.init();
  tft.setRotation(1);  // landscape 320x240
  tft.fillScreen(TFT_WHITE);
  delay(120);
  tft.fillScreen(TFT_WHITE);

#if PMV_TOUCH_XPT2046
  Serial.printf("[TFT] %dx%d rotation=%d touch=XPT2046\n", tft.width(), tft.height(), 1);
#else
  Serial.printf("[TFT] %dx%d rotation=%d touch_cs=%d\n", tft.width(), tft.height(), 1, TOUCH_CS);
#endif

  lv_init();
  lv_disp_draw_buf_init(&drawBuf, buf1, buf2, 320 * 10);

  static lv_disp_drv_t disp_drv;
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res = tft.width();
  disp_drv.ver_res = tft.height();
  disp_drv.flush_cb = lvFlushCb;
  disp_drv.draw_buf = &drawBuf;
  lv_disp_drv_register(&disp_drv);

#if PMV_TOUCH_XPT2046
  initTouchInput();
  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = touchReadCb;
  lv_indev_drv_register(&indev_drv);
  Serial.println("[TFT] Touch input enabled");
#elif TOUCH_CS >= 0
  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = touchReadCb;
  lv_indev_drv_register(&indev_drv);
  Serial.println("[TFT] Touch input enabled");
#endif
}

static void styleEnrollStepLabel(lv_obj_t* lbl, bool active, bool done) {
  if (!lbl) return;
  const uint32_t color = done ? PMV_COL_OK : active ? PMV_COL_TITLE : PMV_COL_TEXT_MUTED;
  lv_obj_set_style_text_color(lbl, lv_color_hex(color), 0);
  lv_obj_set_style_bg_color(lbl, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_bg_opa(lbl, active ? LV_OPA_50 : LV_OPA_0, 0);
  lv_obj_set_style_radius(lbl, 6, 0);
  lv_obj_set_style_pad_hor(lbl, 6, 0);
  lv_obj_set_style_pad_ver(lbl, 2, 0);
}

static void createHomeScreen() {
  scrHome = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(scrHome, lv_color_hex(PMV_COL_BG), 0);

  const lv_coord_t headerY = 8;
  const lv_coord_t headerBtnSize = 36;

  createIconButton(scrHome, LV_SYMBOL_LIST, 8, headerY, onHomeSettingsClicked, false);

  labelTitle = lv_label_create(scrHome);
  lv_label_set_text(labelTitle, "PMV Check-In");
  lv_obj_set_style_text_color(labelTitle, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(labelTitle, PMV_FONT_TITLE, 0);
  lv_obj_align(labelTitle, LV_ALIGN_TOP_MID, 0, headerY + 8);

  labelWifi = lv_label_create(scrHome);
  lv_label_set_text(labelWifi, LV_SYMBOL_WIFI);
  lv_obj_set_style_text_color(labelWifi, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
  lv_obj_set_style_text_font(labelWifi, PMV_FONT_ICON, 0);
  lv_obj_align(labelWifi, LV_ALIGN_TOP_RIGHT, -12, headerY + (headerBtnSize - 14) / 2);

  labelStatus = lv_label_create(scrHome);
  lv_label_set_text(labelStatus, "วางนิ้วบนเซ็นเซอร์");
  lv_obj_set_style_text_color(labelStatus, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_text_font(labelStatus, PMV_FONT_TITLE, 0);
  lv_obj_set_style_text_align(labelStatus, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_width(labelStatus, 304);
  lv_label_set_long_mode(labelStatus, LV_LABEL_LONG_WRAP);

  labelName = lv_label_create(scrHome);
  lv_label_set_text(labelName, "");
  lv_obj_set_style_text_color(labelName, lv_color_hex(PMV_COL_NAME), 0);
  lv_obj_set_style_text_font(labelName, PMV_FONT_TITLE, 0);
  lv_obj_set_style_text_align(labelName, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_width(labelName, 304);
  lv_label_set_long_mode(labelName, LV_LABEL_LONG_WRAP);

  labelTime = lv_label_create(scrHome);
  lv_label_set_text(labelTime, "");
  lv_obj_set_style_text_color(labelTime, lv_color_hex(PMV_COL_TIME), 0);
  lv_obj_set_style_text_font(labelTime, PMV_FONT_BODY, 0);
  lv_obj_set_style_text_align(labelTime, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_width(labelTime, 304);
  lv_label_set_long_mode(labelTime, LV_LABEL_LONG_WRAP);

  layoutHomeLabels();
}

static void layoutHomeLabels() {
  if (!labelStatus) return;

  const char* nameText = labelName ? lv_label_get_text(labelName) : "";
  const char* timeText = labelTime ? lv_label_get_text(labelTime) : "";
  const bool hasName = nameText && nameText[0] != '\0';
  const bool hasTime = timeText && timeText[0] != '\0';
  const lv_coord_t midY = 110;

  if (!hasName && !hasTime) {
    lv_obj_align(labelStatus, LV_ALIGN_TOP_MID, 0, midY);
    if (labelName) lv_obj_add_flag(labelName, LV_OBJ_FLAG_HIDDEN);
    if (labelTime) lv_obj_add_flag(labelTime, LV_OBJ_FLAG_HIDDEN);
    return;
  }

  lv_obj_align(labelStatus, LV_ALIGN_TOP_MID, 0, midY - 28);
  if (labelName) {
    if (hasName) {
      lv_obj_clear_flag(labelName, LV_OBJ_FLAG_HIDDEN);
      lv_obj_align(labelName, LV_ALIGN_TOP_MID, 0, midY);
    } else {
      lv_obj_add_flag(labelName, LV_OBJ_FLAG_HIDDEN);
    }
  }
  if (labelTime) {
    if (hasTime) {
      lv_obj_clear_flag(labelTime, LV_OBJ_FLAG_HIDDEN);
      lv_obj_align(labelTime, LV_ALIGN_TOP_MID, 0, midY + (hasName ? 24 : 0));
    } else {
      lv_obj_add_flag(labelTime, LV_OBJ_FLAG_HIDDEN);
    }
  }
}

static lv_obj_t* createMenuGridTile(lv_obj_t* parent, lv_coord_t x, lv_coord_t y, lv_coord_t w,
                                    lv_coord_t h, const char* icon, lv_event_cb_t cb) {
  lv_obj_t* btn = lv_btn_create(parent);
  lv_obj_set_size(btn, w, h);
  lv_obj_set_pos(btn, x, y);
  lv_obj_set_style_bg_color(btn, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_border_color(btn, lv_color_hex(PMV_COL_BORDER), 0);
  lv_obj_set_style_border_width(btn, 1, 0);
  lv_obj_set_style_radius(btn, 10, 0);
  lv_obj_set_style_shadow_width(btn, 0, 0);
  lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t* iconLbl = lv_label_create(btn);
  lv_label_set_text(iconLbl, icon);
  lv_obj_set_style_text_color(iconLbl, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(iconLbl, PMV_FONT_ICON, 0);
  lv_obj_center(iconLbl);

  return btn;
}

struct MenuGridEntry {
  const char* icon;
  lv_event_cb_t cb;
};

static void createSettingsScreen() {
  scrSettings = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(scrSettings, lv_color_hex(PMV_COL_BG), 0);

  createBackButton(scrSettings, onSettingsBackClicked);

  lv_obj_t* title = lv_label_create(scrSettings);
  lv_label_set_text(title, "เมนู");
  lv_obj_set_style_text_color(title, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(title, PMV_FONT_TITLE, 0);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 12);

  static const MenuGridEntry menuItems[] = {
      {LV_SYMBOL_WIFI, onSettingsWifiClicked},
      {LV_SYMBOL_UPLOAD, onSettingsEnrollClicked},
      {LV_SYMBOL_LIST, onSettingsUsersClicked},
  };
  static const int menuItemCount = sizeof(menuItems) / sizeof(menuItems[0]);

  static const lv_coord_t gridCols = 3;
  static const lv_coord_t gridRows = 3;
  static const lv_coord_t gridGap = 8;
  static const lv_coord_t gridW = 288;
  static const lv_coord_t gridTopY = 56;
  static const lv_coord_t gridBottomPad = 10;
  const lv_coord_t tileW = (gridW - gridGap * (gridCols - 1)) / gridCols;
  const lv_coord_t tileH =
      (240 - gridTopY - gridBottomPad - gridGap * (gridRows - 1)) / gridRows;
  const lv_coord_t gridH = tileH * gridRows + gridGap * (gridRows - 1);

  lv_obj_t* grid = lv_obj_create(scrSettings);
  lv_obj_set_size(grid, gridW, gridH);
  lv_obj_align(grid, LV_ALIGN_TOP_MID, 0, gridTopY);
  lv_obj_set_style_bg_opa(grid, LV_OPA_0, 0);
  lv_obj_set_style_border_width(grid, 0, 0);
  lv_obj_set_style_pad_all(grid, 0, 0);
  lv_obj_clear_flag(grid, LV_OBJ_FLAG_SCROLLABLE);

  for (int i = 0; i < menuItemCount; i++) {
    const lv_coord_t col = i % gridCols;
    const lv_coord_t row = i / gridCols;
    const lv_coord_t x = col * (tileW + gridGap);
    const lv_coord_t y = row * (tileH + gridGap);
    createMenuGridTile(grid, x, y, tileW, tileH, menuItems[i].icon, menuItems[i].cb);
  }
}

static void styleActionButton(lv_obj_t* btn) {
  lv_obj_set_style_bg_color(btn, lv_color_hex(PMV_COL_BTN), 0);
  lv_obj_set_style_radius(btn, 8, 0);
}

static void styleActionButtonLabel(lv_obj_t* lbl) {
  lv_obj_set_style_text_color(lbl, lv_color_hex(PMV_COL_BTN_TEXT), 0);
  lv_obj_set_style_text_font(lbl, PMV_FONT_BODY, 0);
  lv_obj_center(lbl);
}

static void createWifiScreen() {
  scrWifi = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(scrWifi, lv_color_hex(PMV_COL_BG), 0);

  createBackButton(scrWifi, onWifiBackClicked);
  createIconButton(scrWifi, LV_SYMBOL_REFRESH, 276, 8, onWifiScanClicked, false);

  lv_obj_t* title = lv_label_create(scrWifi);
  lv_label_set_text(title, "ตั้งค่า WiFi");
  lv_obj_set_style_text_color(title, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(title, PMV_FONT_TITLE, 0);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 10);

  labelWifiStatus = lv_label_create(scrWifi);
  lv_label_set_text(labelWifiStatus, "");
  lv_obj_add_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
  lv_obj_set_style_text_color(labelWifiStatus, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
  lv_obj_set_style_text_font(labelWifiStatus, PMV_FONT_BODY, 0);
  lv_obj_align(labelWifiStatus, LV_ALIGN_TOP_MID, 0, 36);

  listWifiScan = lv_list_create(scrWifi);
  lv_obj_set_size(listWifiScan, 288, 178);
  lv_obj_align(listWifiScan, LV_ALIGN_TOP_MID, 0, 52);
  lv_obj_set_style_bg_color(listWifiScan, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_border_color(listWifiScan, lv_color_hex(PMV_COL_BORDER), 0);
  lv_obj_set_style_border_width(listWifiScan, 1, 0);
  lv_obj_set_style_radius(listWifiScan, 8, 0);
  lv_obj_set_style_pad_row(listWifiScan, 2, 0);
  lv_obj_set_style_text_color(listWifiScan, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_text_font(listWifiScan, PMV_FONT_BODY, 0);

  panelWifiConnect = lv_obj_create(scrWifi);
  lv_obj_set_size(panelWifiConnect, 288, 92);
  lv_obj_align(panelWifiConnect, LV_ALIGN_TOP_MID, 0, 148);
  lv_obj_set_style_bg_color(panelWifiConnect, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_border_color(panelWifiConnect, lv_color_hex(PMV_COL_BORDER), 0);
  lv_obj_set_style_border_width(panelWifiConnect, 1, 0);
  lv_obj_set_style_radius(panelWifiConnect, 8, 0);
  lv_obj_set_style_pad_all(panelWifiConnect, 0, 0);
  lv_obj_add_flag(panelWifiConnect, LV_OBJ_FLAG_HIDDEN);
  lv_obj_clear_flag(panelWifiConnect, LV_OBJ_FLAG_SCROLLABLE);

  labelSelectedSsid = lv_label_create(panelWifiConnect);
  lv_label_set_text(labelSelectedSsid, "");
  lv_obj_set_style_text_color(labelSelectedSsid, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_text_font(labelSelectedSsid, PMV_FONT_BODY, 0);
  lv_obj_align(labelSelectedSsid, LV_ALIGN_TOP_LEFT, 8, 4);
  lv_obj_set_width(labelSelectedSsid, 272);
  lv_label_set_long_mode(labelSelectedSsid, LV_LABEL_LONG_DOT);

  taWifiPass = createWifiTextarea(panelWifiConnect, 22, "รหัสผ่าน WiFi", true);
  lv_obj_set_size(taWifiPass, 272, 28);

  lv_obj_t* connectBtn = lv_btn_create(panelWifiConnect);
  lv_obj_set_size(connectBtn, 128, 28);
  lv_obj_align(connectBtn, LV_ALIGN_BOTTOM_LEFT, 8, -6);
  styleActionButton(connectBtn);
  lv_obj_add_event_cb(connectBtn, onWifiConnectClicked, LV_EVENT_CLICKED, NULL);
  lv_obj_t* connectLbl = lv_label_create(connectBtn);
  lv_label_set_text(connectLbl, "เชื่อมต่อ");
  styleActionButtonLabel(connectLbl);

  lv_obj_t* cancelBtn = lv_btn_create(panelWifiConnect);
  lv_obj_set_size(cancelBtn, 128, 28);
  lv_obj_align(cancelBtn, LV_ALIGN_BOTTOM_RIGHT, -8, -6);
  lv_obj_set_style_bg_color(cancelBtn, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_border_color(cancelBtn, lv_color_hex(PMV_COL_BORDER), 0);
  lv_obj_set_style_border_width(cancelBtn, 1, 0);
  lv_obj_set_style_radius(cancelBtn, 8, 0);
  lv_obj_add_event_cb(cancelBtn, onWifiConnectCancel, LV_EVENT_CLICKED, NULL);
  lv_obj_t* cancelLbl = lv_label_create(cancelBtn);
  lv_label_set_text(cancelLbl, "ยกเลิก");
  lv_obj_set_style_text_color(cancelLbl, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_text_font(cancelLbl, PMV_FONT_BODY, 0);
  lv_obj_center(cancelLbl);

  kbWifi = lv_keyboard_create(scrWifi);
  lv_obj_set_size(kbWifi, 320, 118);
  lv_obj_align(kbWifi, LV_ALIGN_BOTTOM_MID, 0, 0);
  lv_obj_add_flag(kbWifi, LV_OBJ_FLAG_HIDDEN);
  lv_obj_set_style_text_font(kbWifi, PMV_FONT_BODY, 0);
  lv_obj_set_style_bg_color(kbWifi, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_text_color(kbWifi, lv_color_hex(PMV_COL_TEXT), LV_PART_ITEMS);
  lv_obj_set_style_bg_color(kbWifi, lv_color_hex(PMV_COL_BTN), LV_PART_ITEMS | LV_STATE_PRESSED);
  lv_keyboard_set_mode(kbWifi, LV_KEYBOARD_MODE_TEXT_LOWER);
  lv_obj_add_event_cb(kbWifi, keyboardEventCb, LV_EVENT_ALL, NULL);
}

static void setEnrollLabels(const char* status, const char* detail) {
  if (labelEnrollStatus) {
    lv_label_set_text(labelEnrollStatus, status);
    if (enrollPhase == ENROLL_DONE) {
      lv_obj_set_style_text_color(labelEnrollStatus, lv_color_hex(PMV_COL_OK), 0);
    } else if (enrollPhase == ENROLL_FAIL) {
      lv_obj_set_style_text_color(labelEnrollStatus, lv_color_hex(PMV_COL_ERR), 0);
    } else {
      lv_obj_set_style_text_color(labelEnrollStatus, lv_color_hex(PMV_COL_TEXT), 0);
    }
  }
  if (labelEnrollDetail) {
    const bool hasDetail = detail && detail[0] != '\0';
    lv_label_set_text(labelEnrollDetail, hasDetail ? detail : "");
    if (hasDetail) {
      lv_obj_clear_flag(labelEnrollDetail, LV_OBJ_FLAG_HIDDEN);
      if (enrollPhase == ENROLL_DONE) {
        lv_obj_set_style_text_color(labelEnrollDetail, lv_color_hex(PMV_COL_OK), 0);
      } else if (enrollPhase == ENROLL_FAIL) {
        lv_obj_set_style_text_color(labelEnrollDetail, lv_color_hex(PMV_COL_ERR), 0);
      } else {
        lv_obj_set_style_text_color(labelEnrollDetail, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
      }
    } else {
      lv_obj_add_flag(labelEnrollDetail, LV_OBJ_FLAG_HIDDEN);
    }
  }
  updateEnrollVisual(enrollPhase);
  pmvEmitEnroll(enrollPhase, status, detail ? detail : "", enrollSlot);
}

static void updateEnrollVisual(EnrollPhase phase) {
  const bool step1Done =
      phase == ENROLL_WAIT_RELEASE || phase == ENROLL_WAIT_FINGER2 || phase == ENROLL_DONE;
  const bool liftDone = phase == ENROLL_WAIT_FINGER2 || phase == ENROLL_DONE;
  const bool step2Done = phase == ENROLL_DONE;

  styleEnrollStepLabel(labelEnrollStep1, phase == ENROLL_WAIT_FINGER1, step1Done);
  styleEnrollStepLabel(labelEnrollStepLift, phase == ENROLL_WAIT_RELEASE, liftDone);
  styleEnrollStepLabel(labelEnrollStep2, phase == ENROLL_WAIT_FINGER2, step2Done);
}

static void resetEnrollFlow() {
  enrollPhase = ENROLL_IDLE;
  enrollSlot = 0;
  updateEnrollVisual(ENROLL_IDLE);
}

static void setUsersStatus(const char* status, uint32_t color = PMV_COL_TEXT_MUTED) {
  if (!labelUsersStatus) return;
  lv_label_set_text(labelUsersStatus, status ? status : "");
  lv_obj_set_style_text_color(labelUsersStatus, lv_color_hex(color), 0);
  lv_obj_clear_flag(labelUsersStatus, LV_OBJ_FLAG_HIDDEN);
}

static void rebuildUsersList(JsonArray users) {
  if (!listUsers) return;
  lv_obj_clean(listUsers);

  if (users.isNull() || users.size() == 0) {
    lv_list_add_text(listUsers, "ไม่มีรายชื่อในหมวดนี้");
    return;
  }

  for (JsonVariant item : users) {
    const uint16_t tid = item["templateId"] | 0;
    const char* name = item["name"] | "?";
    char line[52];
    snprintf(line, sizeof(line), "#%-3u %s", tid, name);
    lv_list_add_text(listUsers, line);
  }
}

static void emitUsersTelemetry(bool loading, const char* status, JsonArray users) {
  const char* category = nullptr;
  if (usersSelectedCategory >= 0 && usersSelectedCategory < 4) {
    category = USERS_CAT_IDS[usersSelectedCategory];
  }
  pmvEmitUsersList(loading, status, users, category);
}

static void filterAndShowUsers() {
  StaticJsonDocument<4096> filteredDoc;
  JsonArray filtered = filteredDoc.to<JsonArray>();

  if (usersCacheValid && usersSelectedCategory >= 0 && usersSelectedCategory < 4) {
    JsonArray all = usersCacheDoc["users"].as<JsonArray>();
    const char* catId = USERS_CAT_IDS[usersSelectedCategory];
    if (!all.isNull()) {
      for (JsonVariant item : all) {
        const char* itemCat = item["category"] | "";
        if (strcmp(itemCat, catId) == 0) {
          filtered.add(item);
        }
      }
    }
    char statusBuf[32];
    snprintf(statusBuf, sizeof(statusBuf), "%d คน", static_cast<int>(filtered.size()));
    setUsersStatus(statusBuf, PMV_COL_OK);
    rebuildUsersList(filtered);
    emitUsersTelemetry(false, statusBuf, filtered);
    return;
  }

  setUsersStatus("");
  rebuildUsersList(filtered);
  emitUsersTelemetry(false, "", filtered);
}

static void openUsersListScreen(int8_t idx) {
  if (idx < 0 || idx > 3) return;
  usersSelectedCategory = idx;
  if (labelUsersListTitle) {
    lv_label_set_text(labelUsersListTitle, USERS_CAT_TITLES[idx]);
  }
  currentScreen = UI_USERS_LIST;
  lv_scr_load(scrUsersList);
  pmvEmitScreen(UI_USERS_LIST);
  filterAndShowUsers();
}

static void onUsersCategoryClicked(lv_event_t* e) {
  const intptr_t idx = reinterpret_cast<intptr_t>(lv_event_get_user_data(e));
  if (idx < 0 || idx > 3) return;
  if (usersCacheValid) {
    openUsersListScreen(static_cast<int8_t>(idx));
    return;
  }
  usersPendingListCategory = static_cast<int8_t>(idx);
  usersFetchPending = true;
  setUsersStatus("กำลังโหลด...");
}

static bool fetchUserList(String& statusMsg) {
  if (!wifiReady) {
    statusMsg = "ต้องเชื่อม WiFi ก่อน";
    usersCacheValid = false;
    setUsersStatus(statusMsg.c_str(), PMV_COL_ERR);
    StaticJsonDocument<128> emptyDoc;
    JsonArray empty = emptyDoc.to<JsonArray>();
    emitUsersTelemetry(false, statusMsg.c_str(), empty);
    return false;
  }

  HTTPClient http;
  http.setTimeout(15000);
  http.begin(PMV_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + PMV_DEVICE_API_KEY);

  StaticJsonDocument<128> req;
  req["deviceId"] = PMV_DEVICE_ID;
  req["action"] = "listUsers";

  String body;
  serializeJson(req, body);

  setUsersStatus("กำลังโหลด...");
  StaticJsonDocument<64> loadingDoc;
  emitUsersTelemetry(true, "กำลังโหลด...", loadingDoc.to<JsonArray>());

  const int code = http.POST(body);
  String payload = http.getString();
  http.end();

  if (code <= 0) {
    statusMsg = "API ไม่ตอบสนอง";
    usersCacheValid = false;
    setUsersStatus(statusMsg.c_str(), PMV_COL_ERR);
    StaticJsonDocument<128> emptyDoc;
    emitUsersTelemetry(false, statusMsg.c_str(), emptyDoc.to<JsonArray>());
    return false;
  }

  StaticJsonDocument<4096> res;
  const DeserializationError err = deserializeJson(res, payload);
  if (err) {
    statusMsg = "JSON error";
    usersCacheValid = false;
    setUsersStatus(statusMsg.c_str(), PMV_COL_ERR);
    StaticJsonDocument<128> emptyDoc;
    emitUsersTelemetry(false, statusMsg.c_str(), emptyDoc.to<JsonArray>());
    return false;
  }

  const bool success = res["success"] | false;
  if (!success) {
    statusMsg = res["message"] | "โหลดไม่สำเร็จ";
    usersCacheValid = false;
    setUsersStatus(statusMsg.c_str(), PMV_COL_ERR);
    StaticJsonDocument<128> emptyDoc;
    emitUsersTelemetry(false, statusMsg.c_str(), emptyDoc.to<JsonArray>());
    return false;
  }

  usersCacheDoc.clear();
  usersCacheDoc["users"] = res["users"];
  usersCacheValid = true;

  JsonArray allUsers = usersCacheDoc["users"].as<JsonArray>();
  const int count = allUsers.isNull() ? 0 : static_cast<int>(allUsers.size());
  statusMsg = String("ทั้งหมด ") + count + " คน";
  if (usersPendingListCategory >= 0) {
    const int8_t pending = usersPendingListCategory;
    usersPendingListCategory = -1;
    openUsersListScreen(pending);
  } else if (currentScreen == UI_USERS_LIST) {
    filterAndShowUsers();
  }
  return true;
}

static void loadUsersPicker() {
  usersSelectedCategory = -1;
  usersPendingListCategory = -1;
  if (!usersSkipRefetch) {
    usersCacheValid = false;
    usersCacheDoc.clear();
    usersFetchPending = true;
  }
  usersSkipRefetch = false;
}

static void createUsersPickerScreen() {
  scrUsers = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(scrUsers, lv_color_hex(PMV_COL_BG), 0);

  createBackButton(scrUsers, onUsersBackClicked);
  createIconButton(scrUsers, LV_SYMBOL_REFRESH, 276, 8, onUsersRefreshClicked, false);

  lv_obj_t* title = lv_label_create(scrUsers);
  lv_label_set_text(title, "ผู้ใช้งาน");
  lv_obj_set_style_text_color(title, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(title, PMV_FONT_TITLE, 0);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 10);

  const int gridW = 240;
  const int gridTop = 56;
  const int gap = 16;
  const int cols = 2;
  const int tileW = (gridW - gap * (cols - 1)) / cols;
  const int tileH = (240 - gridTop - 12 - gap) / 2;
  const int gridLeft = (320 - gridW) / 2;

  for (int i = 0; i < 4; i++) {
    const int col = i % cols;
    const int row = i / cols;
    const int x = gridLeft + col * (tileW + gap);
    const int y = gridTop + row * (tileH + gap);

    btnUsersCat[i] = lv_btn_create(scrUsers);
    lv_obj_set_size(btnUsersCat[i], tileW, tileH);
    lv_obj_set_pos(btnUsersCat[i], x, y);
    lv_obj_set_style_radius(btnUsersCat[i], 10, 0);
    lv_obj_set_style_bg_color(btnUsersCat[i], lv_color_hex(PMV_COL_SURFACE), 0);
    lv_obj_set_style_border_color(btnUsersCat[i], lv_color_hex(PMV_COL_BORDER), 0);
    lv_obj_set_style_border_width(btnUsersCat[i], 1, 0);
    lv_obj_add_event_cb(btnUsersCat[i], onUsersCategoryClicked, LV_EVENT_CLICKED,
                        reinterpret_cast<void*>(static_cast<intptr_t>(i)));

    lv_obj_t* icon = lv_label_create(btnUsersCat[i]);
    lv_label_set_text(icon, USERS_CAT_ICONS[i]);
    lv_obj_set_style_text_color(icon, lv_color_hex(PMV_COL_TITLE), 0);
    lv_obj_set_style_text_font(icon, PMV_FONT_ICON_LG, 0);
    lv_obj_center(icon);
  }
}

static void createUsersListScreen() {
  scrUsersList = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(scrUsersList, lv_color_hex(PMV_COL_BG), 0);

  createBackButton(scrUsersList, onUsersListBackClicked);
  createIconButton(scrUsersList, LV_SYMBOL_REFRESH, 276, 8, onUsersRefreshClicked, false);

  labelUsersListTitle = lv_label_create(scrUsersList);
  lv_label_set_text(labelUsersListTitle, "");
  lv_obj_set_style_text_color(labelUsersListTitle, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(labelUsersListTitle, PMV_FONT_TITLE, 0);
  lv_obj_align(labelUsersListTitle, LV_ALIGN_TOP_MID, 0, 10);

  labelUsersStatus = lv_label_create(scrUsersList);
  lv_label_set_text(labelUsersStatus, "");
  lv_obj_set_style_text_color(labelUsersStatus, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
  lv_obj_set_style_text_font(labelUsersStatus, PMV_FONT_BODY, 0);
  lv_obj_align(labelUsersStatus, LV_ALIGN_TOP_MID, 0, 36);

  listUsers = lv_list_create(scrUsersList);
  lv_obj_set_size(listUsers, 288, 178);
  lv_obj_align(listUsers, LV_ALIGN_TOP_MID, 0, 52);
  lv_obj_set_style_bg_color(listUsers, lv_color_hex(PMV_COL_SURFACE), 0);
  lv_obj_set_style_border_color(listUsers, lv_color_hex(PMV_COL_BORDER), 0);
  lv_obj_set_style_border_width(listUsers, 1, 0);
  lv_obj_set_style_radius(listUsers, 8, 0);
  lv_obj_set_style_pad_row(listUsers, 2, 0);
  lv_obj_set_style_text_color(listUsers, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_text_font(listUsers, PMV_FONT_BODY, 0);
}

static void startEnrollFlow() {
  enrollSlot = 0;
  if (!fpReady) {
    enrollPhase = ENROLL_FAIL;
    setEnrollLabels("AS608 ไม่พร้อม", "ตรวจสาย TX/RX");
    return;
  }
  enrollPhase = ENROLL_WAIT_FINGER1;
  setEnrollLabels("วางนิ้วบนเซ็นเซอร์", "");
}

static void createEnrollScreen() {
  scrEnroll = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(scrEnroll, lv_color_hex(PMV_COL_BG), 0);

  createBackButton(scrEnroll, onEnrollBackClicked);

  lv_obj_t* title = lv_label_create(scrEnroll);
  lv_label_set_text(title, "ลงทะเบียน");
  lv_obj_set_style_text_color(title, lv_color_hex(PMV_COL_TITLE), 0);
  lv_obj_set_style_text_font(title, PMV_FONT_TITLE, 0);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 10);

  lv_obj_t* subtitle = lv_label_create(scrEnroll);
  lv_label_set_text(subtitle, "นักเรียน");
  lv_obj_set_style_text_color(subtitle, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
  lv_obj_set_style_text_font(subtitle, PMV_FONT_BODY, 0);
  lv_obj_align(subtitle, LV_ALIGN_TOP_MID, 0, 32);

  labelEnrollStep1 = lv_label_create(scrEnroll);
  lv_label_set_text(labelEnrollStep1, "1");
  lv_obj_set_style_text_font(labelEnrollStep1, PMV_FONT_ICON, 0);
  lv_obj_align(labelEnrollStep1, LV_ALIGN_TOP_MID, -36, 56);

  labelEnrollStepLift = lv_label_create(scrEnroll);
  lv_label_set_text(labelEnrollStepLift, LV_SYMBOL_UP);
  lv_obj_set_style_text_font(labelEnrollStepLift, PMV_FONT_ICON, 0);
  lv_obj_align(labelEnrollStepLift, LV_ALIGN_TOP_MID, 0, 56);

  labelEnrollStep2 = lv_label_create(scrEnroll);
  lv_label_set_text(labelEnrollStep2, "2");
  lv_obj_set_style_text_font(labelEnrollStep2, PMV_FONT_ICON, 0);
  lv_obj_align(labelEnrollStep2, LV_ALIGN_TOP_MID, 36, 56);

  labelEnrollStatus = lv_label_create(scrEnroll);
  lv_label_set_text(labelEnrollStatus, "");
  lv_obj_set_style_text_color(labelEnrollStatus, lv_color_hex(PMV_COL_TEXT), 0);
  lv_obj_set_style_text_font(labelEnrollStatus, PMV_FONT_BODY, 0);
  lv_obj_set_width(labelEnrollStatus, 288);
  lv_label_set_long_mode(labelEnrollStatus, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(labelEnrollStatus, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(labelEnrollStatus, LV_ALIGN_TOP_MID, 0, 88);

  labelEnrollDetail = lv_label_create(scrEnroll);
  lv_label_set_text(labelEnrollDetail, "");
  lv_obj_set_style_text_color(labelEnrollDetail, lv_color_hex(PMV_COL_TEXT_MUTED), 0);
  lv_obj_set_style_text_font(labelEnrollDetail, PMV_FONT_BODY, 0);
  lv_obj_set_width(labelEnrollDetail, 288);
  lv_label_set_long_mode(labelEnrollDetail, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(labelEnrollDetail, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(labelEnrollDetail, LV_ALIGN_TOP_MID, 0, 110);
  lv_obj_add_flag(labelEnrollDetail, LV_OBJ_FLAG_HIDDEN);

  lv_obj_t* retryBtn = lv_btn_create(scrEnroll);
  lv_obj_set_size(retryBtn, 120, 32);
  lv_obj_align(retryBtn, LV_ALIGN_BOTTOM_MID, 0, -10);
  styleActionButton(retryBtn);
  lv_obj_add_event_cb(retryBtn, onEnrollRetryClicked, LV_EVENT_CLICKED, NULL);
  lv_obj_t* retryLbl = lv_label_create(retryBtn);
  lv_label_set_text(retryLbl, "เริ่มใหม่");
  styleActionButtonLabel(retryLbl);

  updateEnrollVisual(ENROLL_IDLE);
}

static void handleEnrollTick() {
  if (currentScreen != UI_ENROLL || !fpReady) return;

  switch (enrollPhase) {
    case ENROLL_IDLE:
    case ENROLL_DONE:
    case ENROLL_FAIL:
      return;

    case ENROLL_WAIT_FINGER1: {
      const uint8_t result = finger.getImage();
      if (result == FINGERPRINT_NOFINGER) return;
      if (result != FINGERPRINT_OK) {
        setEnrollLabels("อ่านไม่ชัด ลองใหม่", "");
        return;
      }
      if (finger.image2Tz(1) != FINGERPRINT_OK) {
        setEnrollLabels("ประมวลผลไม่ได้", "");
        return;
      }
      enrollPhase = ENROLL_WAIT_RELEASE;
      setEnrollLabels("ยกนิ้วขึ้น", "");
      return;
    }

    case ENROLL_WAIT_RELEASE: {
      if (finger.getImage() == FINGERPRINT_OK) return;
      enrollPhase = ENROLL_WAIT_FINGER2;
      setEnrollLabels("วางนิ้วอีกครั้ง", "");
      return;
    }

    case ENROLL_WAIT_FINGER2: {
      const uint8_t result = finger.getImage();
      if (result == FINGERPRINT_NOFINGER) return;
      if (result != FINGERPRINT_OK) {
        setEnrollLabels("อ่านไม่ชัด ลองใหม่", "");
        return;
      }
      if (finger.image2Tz(2) != FINGERPRINT_OK) {
        setEnrollLabels("ประมวลผลไม่ได้", "");
        return;
      }
      if (finger.createModel() != FINGERPRINT_OK) {
        enrollPhase = ENROLL_FAIL;
        setEnrollLabels("ลายนิ้วไม่ตรงกัน", "");
        return;
      }
      if (!findEmptyEnrollSlot(&enrollSlot)) {
        enrollPhase = ENROLL_FAIL;
        setEnrollLabels("เซ็นเซอร์เต็ม (127)", "");
        return;
      }
      if (finger.storeModel(enrollSlot) != FINGERPRINT_OK) {
        enrollPhase = ENROLL_FAIL;
        setEnrollLabels("บันทึกไม่สำเร็จ", "");
        return;
      }
      enrollPhase = ENROLL_DONE;
      char detail[48];
      snprintf(detail, sizeof(detail), "ID #%u", enrollSlot);
      setEnrollLabels("สำเร็จ", detail);
      Serial.printf("[AS608] Enrolled template slot %u\n", enrollSlot);
      return;
    }
  }
}

static void initUi() {
  createHomeScreen();
  createSettingsScreen();
  createWifiScreen();
  createEnrollScreen();
  createUsersPickerScreen();
  createUsersListScreen();
  lv_scr_load(scrHome);
  currentScreen = UI_HOME;
}

static void showScreen(UiScreen screen) {
  if (screen != UI_ENROLL && currentScreen == UI_ENROLL) {
    resetEnrollFlow();
  }

  currentScreen = screen;
  switch (screen) {
    case UI_HOME:
      lv_scr_load(scrHome);
      break;
    case UI_SETTINGS:
      lv_scr_load(scrSettings);
      break;
    case UI_WIFI:
      hideWifiKeyboard();
      updateWifiDetailLabels();
      lv_scr_load(scrWifi);
      scanWifiNetworks();
      break;
    case UI_ENROLL:
      lv_scr_load(scrEnroll);
      startEnrollFlow();
      break;
    case UI_USERS:
      lv_scr_load(scrUsers);
      loadUsersPicker();
      break;
    case UI_USERS_LIST:
      lv_scr_load(scrUsersList);
      break;
  }
  pmvEmitScreen(screen);
}

static void setStatus(const char* status, const char* name, const char* time) {
  lv_label_set_text(labelStatus, status);
  lv_label_set_text(labelName, name);
  lv_label_set_text(labelTime, time);
  if (currentScreen == UI_HOME) layoutHomeLabels();
  lv_obj_invalidate(labelStatus);
  if (currentScreen == UI_HOME) {
    pmvEmitHome(status, name, time, wifiReady, fpReady);
  }
}

static void setWifiLabel(bool ok) {
  if (!labelWifi) return;
  lv_label_set_text(labelWifi, LV_SYMBOL_WIFI);
  lv_obj_set_style_text_color(labelWifi, ok ? lv_color_hex(PMV_COL_OK) : lv_color_hex(PMV_COL_ERR), 0);
  if (currentScreen == UI_HOME) {
    pmvEmitHome(lv_label_get_text(labelStatus), lv_label_get_text(labelName),
                lv_label_get_text(labelTime), ok, fpReady);
  }
}

static void updateWifiDetailLabels() {
  if (currentScreen == UI_WIFI && listWifiScan && scanResultCount > 0) {
    rebuildWifiList();
  }
}

static bool probeFingerprint(uint8_t rxPin, uint8_t txPin, uint32_t baud) {
  fpSerial.end();
  delay(20);
  while (fpSerial.available()) {
    fpSerial.read();
  }

  fpSerial.begin(baud, SERIAL_8N1, rxPin, txPin);
  finger.begin(baud);
  delay(250);

  if (finger.verifyPassword()) {
    Serial.printf("[AS608] Found sensor (RX=GPIO%d TX=GPIO%d @ %lu)\n", rxPin, txPin,
                  static_cast<unsigned long>(baud));
    return true;
  }

  return false;
}

static bool initFingerprint() {
  static const uint32_t baudRates[] = {FP_BAUD, 9600UL, 115200UL};
  static const uint8_t pinPairs[][2] = {
      {FP_RX_PIN, FP_TX_PIN},
      {FP_TX_PIN, FP_RX_PIN},
  };

  for (const auto& pins : pinPairs) {
    for (const uint32_t baud : baudRates) {
      if (probeFingerprint(pins[0], pins[1], baud)) {
        fpReady = true;
        if (currentScreen == UI_HOME) {
          pmvEmitHome(lv_label_get_text(labelStatus), lv_label_get_text(labelName),
                      lv_label_get_text(labelTime), wifiReady, true);
        }
        return true;
      }
    }
  }

  fpSerial.end();
  Serial.println("[AS608] Sensor not found — ตรวจ 3.3V/GND และสลับสาย IO22↔IO27");
  fpReady = false;
  if (currentScreen == UI_HOME) {
    pmvEmitHome(lv_label_get_text(labelStatus), lv_label_get_text(labelName),
                lv_label_get_text(labelTime), wifiReady, false);
  }
  return false;
}

static void connectWifi(bool updateHomeStatus) {
  if (WiFi.status() == WL_CONNECTED) {
    wifiReady = true;
    setWifiLabel(true);
    updateWifiDetailLabels();
    return;
  }

  wifiReady = false;
  setWifiLabel(false);
  if (updateHomeStatus && currentScreen == UI_HOME) {
    setStatus("กำลังเชื่อม WiFi...");
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid, wifiPass);

  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    lv_tick_inc(300);
    lv_timer_handler();
    delay(300);
  }

  wifiReady = WiFi.status() == WL_CONNECTED;
  setWifiLabel(wifiReady);
  updateWifiDetailLabels();

  if (updateHomeStatus && currentScreen == UI_HOME) {
    setStatus(wifiReady ? "วางนิ้วบนเซ็นเซอร์" : "WiFi ล้มเหลว");
  } else if (currentScreen == UI_WIFI && labelWifiStatus) {
    const char* wifiMsg = wifiReady ? "WiFi OK" : "WiFi ล้มเหลว";
    lv_label_set_text(labelWifiStatus, wifiMsg);
    lv_obj_set_style_text_color(labelWifiStatus,
                                wifiReady ? lv_color_hex(PMV_COL_OK) : lv_color_hex(PMV_COL_ERR), 0);
    lv_obj_clear_flag(labelWifiStatus, LV_OBJ_FLAG_HIDDEN);
    pmvEmitWifi(false, wifiReady, wifiReady ? wifiSsid : "", wifiMsg);
  } else {
    pmvEmitWifi(false, wifiReady, wifiReady ? wifiSsid : "", "");
  }
}

static bool postAttendance(uint16_t templateId, String& outMessage, String& outName, String& outAction) {
  if (!wifiReady) return false;

  HTTPClient http;
  http.setTimeout(12000);
  http.begin(PMV_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + PMV_DEVICE_API_KEY);

  StaticJsonDocument<256> req;
  req["deviceId"] = PMV_DEVICE_ID;
  req["fingerprintTemplateId"] = templateId;
  req["action"] = "toggle";

  String body;
  serializeJson(req, body);

  const int code = http.POST(body);
  String payload = http.getString();
  http.end();

  if (code <= 0) {
    outMessage = "API ไม่ตอบสนอง";
    return false;
  }

  StaticJsonDocument<768> res;
  const DeserializationError err = deserializeJson(res, payload);
  if (err) {
    outMessage = "JSON error";
    return false;
  }

  const bool success = res["success"] | false;
  outMessage = res["message"] | (success ? "OK" : "Error");
  outName = res["displayName"] | "";
  outAction = res["action"] | "";

  if (res["record"]["checkInTime"].is<const char*>()) {
    const char* t = res["record"]["checkInTime"];
    if (t && outAction == "checkIn") outMessage = String("เข้า ") + t;
  }
  if (res["record"]["checkOutTime"].is<const char*>()) {
    const char* t = res["record"]["checkOutTime"];
    if (t && outAction == "checkOut") outMessage = String("ออก ") + t;
  }

  return success;
}

static void handleFingerprint() {
  if (!fpReady || currentScreen != UI_HOME) return;

  const uint8_t result = finger.getImage();
  if (result == FINGERPRINT_NOFINGER) return;
  if (result != FINGERPRINT_OK) {
    setStatus("อ่านลายนิ้วไม่ได้");
    return;
  }

  if (millis() - lastScanMs < SCAN_COOLDOWN_MS) return;

  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    setStatus("ประมวลผลลายนิ้วไม่ได้");
    return;
  }

  if (finger.fingerFastSearch() != FINGERPRINT_OK) {
    setStatus("ไม่พบลายนิ้วในระบบ");
    lastScanMs = millis();
    return;
  }

  const uint16_t templateId = finger.fingerID;
  setStatus("กำลังส่งข้อมูล...", "", "");

  String message;
  String name;
  String action;
  const bool ok = postAttendance(templateId, message, name, action);

  if (ok) {
    if (action == "checkIn") {
      setStatus("เช็คอินสำเร็จ", name.c_str(), message.c_str());
    } else if (action == "checkOut") {
      setStatus("เช็คเอาต์สำเร็จ", name.c_str(), message.c_str());
    } else {
      setStatus(message.c_str(), name.c_str(), "");
    }
  } else {
    setStatus(message.c_str(), name.c_str(), "");
  }

  lastScanMs = millis();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[PMV] Boot fingerprint terminal");

  initDisplay();
  loadWifiConfig();
  initUi();
  setStatus("เริ่มต้นระบบ...");
  refreshUiNow();

  if (!initFingerprint()) {
    setStatus("AS608 ไม่พบ — ตรวจสาย TX/RX");
    refreshUiNow();
  }

  connectWifi(true);
  setStatus(fpReady ? "วางนิ้วบนเซ็นเซอร์" : "รอเซ็นเซอร์ลายนิ้ว...");
  updateWifiDetailLabels();
  refreshUiNow();
}

void loop() {
  const uint32_t tickMs = 5;
  lv_tick_inc(tickMs);
  lv_timer_handler();

  if (!fpReady && millis() - lastFpRetryMs > 5000) {
    lastFpRetryMs = millis();
    if (initFingerprint() && currentScreen == UI_HOME) {
      setStatus("วางนิ้วบนเซ็นเซอร์");
      refreshUiNow();
    }
  }

  if (currentScreen == UI_HOME && WiFi.status() != WL_CONNECTED) {
    static uint32_t lastRetry = 0;
    if (millis() - lastRetry > WIFI_RETRY_MS) {
      lastRetry = millis();
      connectWifi(true);
    }
  } else if (WiFi.status() == WL_CONNECTED) {
    wifiReady = true;
    setWifiLabel(true);
  }

  if (currentScreen == UI_HOME) {
    handleFingerprint();
  } else if (currentScreen == UI_ENROLL) {
    handleEnrollTick();
  }

  if ((currentScreen == UI_USERS || currentScreen == UI_USERS_LIST) && usersFetchPending) {
    usersFetchPending = false;
    String statusMsg;
    fetchUserList(statusMsg);
  }

  delay(tickMs);
}
