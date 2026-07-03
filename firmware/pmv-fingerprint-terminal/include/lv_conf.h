#pragma once

#include <stdint.h>

#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 0
#define LV_USE_LOG 0

#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_16 1

#define LV_FONT_CUSTOM_DECLARE \
  LV_FONT_DECLARE(lv_font_sukhumvit_14) LV_FONT_DECLARE(lv_font_sukhumvit_20)
#define LV_FONT_DEFAULT &lv_font_sukhumvit_14

#define LV_USE_LABEL 1
#define LV_USE_BTN 1
#define LV_USE_ARC 1
#define LV_USE_LIST 1
#define LV_USE_TEXTAREA 1
#define LV_USE_KEYBOARD 1
#define LV_USE_BTNMATRIX 1
#define LV_TEXTAREA_DEF_PWD_SHOW_TIME 1500
#define LV_TICK_CUSTOM 0
