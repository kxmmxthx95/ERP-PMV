/**
 * PMV serial telemetry — JSON lines prefixed with @PMV for Web Serial mirror.
 * Debug logs ([AS608], [WiFi]) stay unstructured; only @PMV lines are parsed by the portal.
 */
#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

inline const char* pmvScreenName(uint8_t screen) {
  switch (screen) {
    case 0:
      return "home";
    case 1:
      return "settings";
    case 2:
      return "wifi";
    case 3:
      return "enroll";
    case 4:
      return "users";
    case 5:
      return "users_list";
    default:
      return "home";
  }
}

inline const char* pmvEnrollPhaseName(uint8_t phase) {
  switch (phase) {
    case 0:
      return "idle";
    case 1:
      return "wait_finger1";
    case 2:
      return "wait_release";
    case 3:
      return "wait_finger2";
    case 4:
      return "done";
    case 5:
      return "fail";
    default:
      return "idle";
  }
}

inline void pmvEmitJson(const JsonDocument& doc) {
  Serial.print(F("@PMV"));
  serializeJson(doc, Serial);
  Serial.println();
}

inline void pmvEmitScreen(uint8_t screen) {
  StaticJsonDocument<96> doc;
  doc["v"] = 1;
  doc["ev"] = "screen";
  doc["screen"] = pmvScreenName(screen);
  pmvEmitJson(doc);
}

inline void pmvEmitHome(const char* status, const char* name, const char* time, bool wifi, bool fp) {
  StaticJsonDocument<384> doc;
  doc["v"] = 1;
  doc["ev"] = "home";
  doc["status"] = status ? status : "";
  doc["name"] = name ? name : "";
  doc["time"] = time ? time : "";
  doc["wifi"] = wifi;
  doc["fp"] = fp;
  pmvEmitJson(doc);
}

inline void pmvEmitEnroll(uint8_t phase, const char* status, const char* detail, uint8_t slot) {
  StaticJsonDocument<384> doc;
  doc["v"] = 1;
  doc["ev"] = "enroll";
  doc["phase"] = pmvEnrollPhaseName(phase);
  doc["status"] = status ? status : "";
  doc["detail"] = detail ? detail : "";
  if (slot > 0) {
    doc["slot"] = slot;
  }
  pmvEmitJson(doc);
}

inline void pmvEmitWifi(bool scanning, bool connected, const char* ssid, const char* statusLabel) {
  StaticJsonDocument<256> doc;
  doc["v"] = 1;
  doc["ev"] = "wifi";
  doc["scanning"] = scanning;
  doc["connected"] = connected;
  if (ssid && ssid[0] != '\0') {
    doc["ssid"] = ssid;
  }
  if (statusLabel && statusLabel[0] != '\0') {
    doc["status"] = statusLabel;
  }
  pmvEmitJson(doc);
}

inline void pmvEmitWifiScan(JsonArray networks) {
  StaticJsonDocument<1024> doc;
  doc["v"] = 1;
  doc["ev"] = "wifi_scan";
  doc["networks"] = networks;
  pmvEmitJson(doc);
}

inline void pmvEmitUsersList(bool loading, const char* status, JsonArray users, const char* category = nullptr) {
  StaticJsonDocument<2048> doc;
  doc["v"] = 1;
  doc["ev"] = "users_list";
  doc["loading"] = loading;
  if (status && status[0] != '\0') {
    doc["status"] = status;
  }
  if (category && category[0] != '\0') {
    doc["category"] = category;
  }
  doc["users"] = users;
  pmvEmitJson(doc);
}
