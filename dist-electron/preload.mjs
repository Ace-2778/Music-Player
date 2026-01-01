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
  getCoverUrl: (trackId) => electron.ipcRenderer.invoke("get-cover-url", trackId),
  clearCoverCache: (trackId) => electron.ipcRenderer.invoke("clear-cover-cache", trackId),
  // ⭐ 新增：歌词选项 API
  getLyricsOptions: () => electron.ipcRenderer.invoke("get-lyrics-options"),
  saveLyricsOptions: (options) => electron.ipcRenderer.invoke("save-lyrics-options", options),
  // ⭐ 新增：曲库文件夹 API
  getLibraryFolders: () => electron.ipcRenderer.invoke("get-library-folders"),
  addLibraryFolder: (folderPath) => electron.ipcRenderer.invoke("add-library-folder", folderPath),
  removeLibraryFolder: (folderPath) => electron.ipcRenderer.invoke("remove-library-folder", folderPath)
});
