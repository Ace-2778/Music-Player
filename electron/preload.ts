import { ipcRenderer, contextBridge } from 'electron'

// Track 类型定义
export interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: number
  pictureBase64?: string
  coverUrl?: string // ⭐ 在线封面 URL
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  selectMusicFolder: () => ipcRenderer.invoke('select-music-folder'),
  scanMusicFolder: (folderPath: string) => ipcRenderer.invoke('scan-music-folder', folderPath) as Promise<Track[]>,
  getFileUrl: (filePath: string) => ipcRenderer.invoke('get-file-url', filePath) as Promise<string>,
  // ⭐ 音量 API
  getVolume: () => ipcRenderer.invoke('get-volume') as Promise<number>,
  setVolume: (volume: number) => ipcRenderer.invoke('set-volume', volume) as Promise<number>,
  // ⭐ 新增：封面缓存 API
  saveCoverUrl: (trackId: string, coverUrl: string) => ipcRenderer.invoke('save-cover-url', trackId, coverUrl) as Promise<boolean>,
  getCoverUrl: (trackId: string) => ipcRenderer.invoke('get-cover-url', trackId) as Promise<string | null>,
  // ⭐ 新增：歌词选项 API
  getLyricsOptions: () => ipcRenderer.invoke('get-lyrics-options') as Promise<any>,
  saveLyricsOptions: (options: any) => ipcRenderer.invoke('save-lyrics-options', options) as Promise<any>,
  // ⭐ 新增：曲库文件夹 API
  getLibraryFolders: () => ipcRenderer.invoke('get-library-folders') as Promise<string[]>,
  addLibraryFolder: (folderPath: string) => ipcRenderer.invoke('add-library-folder', folderPath) as Promise<string[]>,
  removeLibraryFolder: (folderPath: string) => ipcRenderer.invoke('remove-library-folder', folderPath) as Promise<string[]>
})
