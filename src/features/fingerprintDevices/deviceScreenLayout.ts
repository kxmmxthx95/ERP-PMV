/** พิกัดและขนาด UI — ตรงกับ firmware LVGL (แนวนอน 320×240) */
export const FW = {
  W: 320,
  H: 240,
  headerBtn: 36,
  back: { x: 8, y: 8 },
  home: {
    headerY: 8,
    titleY: 16,
    wifiRight: 12,
    statusMidY: 110,
  },
  menu: {
    titleY: 12,
    cols: 3,
    rows: 3,
    gap: 8,
    gridW: 288,
    gridTop: 56,
    gridBottomPad: 10,
  },
  wifi: {
    titleY: 10,
    listTop: 52,
    listW: 288,
    listH: 178,
    panelTop: 148,
    panelH: 92,
    refresh: { x: 276, y: 8 },
    kbH: 118,
  },
  enroll: {
    titleY: 10,
    subtitleY: 32,
    stepsY: 56,
    statusY: 88,
    detailY: 110,
    retryBottom: 10,
    retryW: 120,
    retryH: 32,
  },
  users: {
    titleY: 10,
    pickerGridW: 240,
    pickerGridTop: 56,
    pickerCols: 2,
    pickerRows: 2,
    pickerGap: 16,
    refresh: { x: 276, y: 8 },
  },
  usersList: {
    titleY: 10,
    statusY: 36,
    listTop: 52,
    listW: 288,
    listH: 178,
    refresh: { x: 276, y: 8 },
  },
} as const;

export function fwMenuGridLeft() {
  return (FW.W - FW.menu.gridW) / 2;
}

export function fwMenuTileW() {
  return (FW.menu.gridW - FW.menu.gap * (FW.menu.cols - 1)) / FW.menu.cols;
}

export function fwMenuTileH() {
  return (
    (FW.H - FW.menu.gridTop - FW.menu.gridBottomPad - FW.menu.gap * (FW.menu.rows - 1)) /
    FW.menu.rows
  );
}

export function fwRect(left: number, top: number, width: number, height: number) {
  return {
    left: `${(left / FW.W) * 100}%`,
    top: `${(top / FW.H) * 100}%`,
    width: `${(width / FW.W) * 100}%`,
    height: `${(height / FW.H) * 100}%`,
  };
}

export function fwMenuTileRect(index: number) {
  const col = index % FW.menu.cols;
  const row = Math.floor(index / FW.menu.cols);
  const tileW = fwMenuTileW();
  const tileH = fwMenuTileH();
  return fwRect(
    fwMenuGridLeft() + col * (tileW + FW.menu.gap),
    FW.menu.gridTop + row * (tileH + FW.menu.gap),
    tileW,
    tileH,
  );
}

export function fwCenterX(width: number) {
  return (FW.W - width) / 2;
}

export function fwUsersPickerTileRect(index: number) {
  const col = index % FW.users.pickerCols;
  const row = Math.floor(index / FW.users.pickerCols);
  const tileW =
    (FW.users.pickerGridW - FW.users.pickerGap * (FW.users.pickerCols - 1)) / FW.users.pickerCols;
  const tileH =
    (FW.H - FW.users.pickerGridTop - 12 - FW.users.pickerGap * (FW.users.pickerRows - 1)) /
    FW.users.pickerRows;
  const left = fwCenterX(FW.users.pickerGridW) + col * (tileW + FW.users.pickerGap);
  return fwRect(left, FW.users.pickerGridTop + row * (tileH + FW.users.pickerGap), tileW, tileH);
}

export function fwUsersCategoryRect(index: number) {
  return fwUsersPickerTileRect(index);
}
