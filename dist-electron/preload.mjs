"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  selectMusicFolder: () => electron.ipcRenderer.invoke("select-music-folder"),
  scanMusicFolder: (folderPath) => electron.ipcRenderer.invoke("scan-music-folder", folderPath),
  getFileUrl: (filePath) => electron.ipcRenderer.invoke("get-file-url", filePath),
  // ⭐ 音量 API
  getVolume: () => electron.ipcRenderer.invoke("get-volume"),
  setVolume: (volume) => electron.ipcRenderer.invoke("set-volume", volume),
  // ⭐ 新增：封面缓存 API
  saveCoverUrl: (trackId, coverUrl) => electron.ipcRenderer.invoke("save-cover-url", trackId, coverUrl),
  getCoverUrl: (trackId) => electron.ipcRenderer.invoke("get-cover-url", trackId)
});
