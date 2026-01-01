import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { parseFile } from 'music-metadata'
import Store from 'electron-store'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ⭐ 新增：初始化配置存储
const store = new Store({
  defaults: {
    volume: 80, // 默认音量 80
    trackCovers: {} // ⭐ 存储 trackId -> coverUrl 映射
  }
})

// Track 类型定义
interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: number
  pictureBase64?: string
  coverUrl?: string // ⭐ 在线封面 URL
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1000,
    height: 600,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // ⭐ 允许加载本地文件（开发环境）
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handler: 选择音乐文件夹
ipcMain.handle('select-music-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (result.canceled) {
    return null
  }
  
  return result.filePaths[0]
})

// IPC Handler: 扫描音乐文件夹
ipcMain.handle('scan-music-folder', async (event, folderPath: string) => {
  const supportedFormats = ['.mp3', '.flac', '.wav', '.m4a', '.ogg']
  const musicFilePaths: string[] = []
  
  // 递归扫描目录，收集音频文件路径
  function scanDirectory(dirPath: string) {
    try {
      const items = fs.readdirSync(dirPath)
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath)
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase()
          if (supportedFormats.includes(ext)) {
            musicFilePaths.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error)
    }
  }
  
  scanDirectory(folderPath)
  
  // 解析每个音频文件的 metadata
  const tracks: Track[] = []
  
  for (const filePath of musicFilePaths) {
    try {
      const metadata = await parseFile(filePath)
      
      // 生成 ID（使用路径的 hash）
      const id = crypto.createHash('md5').update(filePath).digest('hex')
      
      // 提取专辑封面
      let pictureBase64: string | undefined
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0]
        pictureBase64 = `data:${picture.format};base64,${picture.data.toString('base64')}`
      }
      
      // 构建 Track，使用 fallback 值
      const track: Track = {
        id,
        path: filePath,
        title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        duration: metadata.format.duration || 0,
        pictureBase64
      }
      
      tracks.push(track)
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error)
      
      // 即使解析失败，也添加基本信息
      const id = crypto.createHash('md5').update(filePath).digest('hex')
      tracks.push({
        id,
        path: filePath,
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0
      })
    }
  }
  
  return tracks
})

// IPC Handler: 获取文件 URL
ipcMain.handle('get-file-url', async (event, filePath: string) => {
  console.log('📂 [IPC] get-file-url 请求:', filePath)
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('❌ [IPC] 文件不存在:', filePath)
      throw new Error(`文件不存在: ${filePath}`)
    }
    
    // 转换为 file:// URL
    const fileUrl = pathToFileURL(filePath).href
    console.log('✅ [IPC] 转换后的 URL:', fileUrl)
    
    return fileUrl
  } catch (error) {
    console.error('❌ [IPC] get-file-url 失败:', error)
    throw error
  }
})

// ⭐ 新增：IPC Handler - 获取音量
ipcMain.handle('get-volume', () => {
  const volume = store.get('volume', 80) as number
  console.log('🔊 [IPC] get-volume:', volume)
  return volume
})

// ⭐ 新增：IPC Handler - 设置音量
ipcMain.handle('set-volume', (event, volume: number) => {
  // 限制范围在 0-100
  const clampedVolume = Math.max(0, Math.min(100, volume))
  store.set('volume', clampedVolume)
  console.log('🔊 [IPC] set-volume:', clampedVolume)
  return clampedVolume
})

// ⭐ 新增：IPC Handler - 保存封面 URL 缓存
ipcMain.handle('save-cover-url', (event, trackId: string, coverUrl: string) => {
  const trackCovers = store.get('trackCovers', {}) as Record<string, string>
  trackCovers[trackId] = coverUrl
  store.set('trackCovers', trackCovers)
  console.log('🖼️ [IPC] save-cover-url:', { trackId, coverUrl })
  return true
})

// ⭐ 新增：IPC Handler - 获取封面 URL 缓存
ipcMain.handle('get-cover-url', (event, trackId: string) => {
  const trackCovers = store.get('trackCovers', {}) as Record<string, string>
  const coverUrl = trackCovers[trackId] || null
  console.log('🖼️ [IPC] get-cover-url:', { trackId, coverUrl })
  return coverUrl
})

app.whenReady().then(createWindow)
