import { Track } from './playerStore'

// �?曲目元数据（精简版，用于持久化）
export interface TrackMeta {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  path: string
  provider: string
}

// �?播放列表
export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

// �?本地库数据结�?
export interface LibraryData {
  importedFolders: string[]
  tracksById: Record<string, TrackMeta>
  favorites: string[] // �?使用数组存储（Set 无法直接序列化）
  playCounts: Record<string, number>
  lastPlayedAt: Record<string, number>
  playDurations: Record<string, number> // ��ʵ����ʱ�����룩
  recents: string[] // 最近播放，最�?200 �?
  playlists: Playlist[]
}

// �?默认空数�?
const DEFAULT_LIBRARY_DATA: LibraryData = {
  importedFolders: [],
  tracksById: {},
  favorites: [],
  playCounts: {},
  lastPlayedAt: {},
  playDurations: {},
  recents: [],
  playlists: []
}

// �?写入防抖队列
let writeTimeout: NodeJS.Timeout | null = null
const WRITE_DEBOUNCE_MS = 1000 // 1 秒防�?

/**
 * LibraryDataLayer - 统一的本地持久化数据�?
 * 使用 localStorage 模拟 electron-store（浏览器环境�?
 * 生产环境应使�?electron-store �?IndexedDB
 */
class LibraryDataLayer {
  private data: LibraryData
  private storageKey = 'music-library-data'

  constructor() {
    this.data = this.load()
    console.log('📚 [LibraryStore] 初始化完�?', {
      folders: this.data.importedFolders.length,
      tracks: Object.keys(this.data.tracksById).length,
      favorites: this.data.favorites.length,
      playlists: this.data.playlists.length
    })
  }

  // ==================== 数据加载 ====================
  
  private load(): LibraryData {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        // �?数据迁移/校验
        return {
          ...DEFAULT_LIBRARY_DATA,
          ...parsed,
          favorites: parsed.favorites || [],
          recents: (parsed.recents || []).slice(0, 200)
        }
      }
    } catch (error) {
      console.error('�?[LibraryStore] 加载数据失败:', error)
    }
    return { ...DEFAULT_LIBRARY_DATA }
  }

  // ==================== 数据保存（防抖） ====================
  
  private scheduleSave() {
    if (writeTimeout) {
      clearTimeout(writeTimeout)
    }
    writeTimeout = setTimeout(() => {
      this.saveNow()
    }, WRITE_DEBOUNCE_MS)
  }

  private saveNow() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data))
      console.log('💾 [LibraryStore] 数据已保存')
    } catch (error) {
      console.error('�?[LibraryStore] 保存数据失败:', error)
    }
  }

  // ==================== 导入的文件夹管理 ====================
  
  addImportedFolder(path: string) {
    if (!this.data.importedFolders.includes(path)) {
      this.data.importedFolders.push(path)
      this.scheduleSave()
      console.log('📁 [LibraryStore] 添加文件�?', path)
    }
  }

  removeImportedFolder(path: string) {
    const index = this.data.importedFolders.indexOf(path)
    if (index > -1) {
      this.data.importedFolders.splice(index, 1)
      this.scheduleSave()
      console.log('🗑�?[LibraryStore] 移除文件�?', path)
    }
  }

  getImportedFolders(): string[] {
    return [...this.data.importedFolders]
  }

  // ==================== 曲目元数据管�?====================
  
  upsertTracks(tracks: Track[]) {
    let count = 0
    tracks.forEach(track => {
      this.data.tracksById[track.id] = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        path: track.path,
        provider: track.provider
      }
      count++
    })
    this.scheduleSave()
    console.log(`📝 [LibraryStore] 更新曲目: ${count} 首`)
  }

  getTrackMeta(trackId: string): TrackMeta | undefined {
    return this.data.tracksById[trackId]
  }

  getAllTrackMetas(): TrackMeta[] {
    return Object.values(this.data.tracksById)
  }

  // ==================== 收藏管理 ====================
  
  toggleFavorite(trackId: string): boolean {
    const index = this.data.favorites.indexOf(trackId)
    if (index > -1) {
      // 取消收藏
      this.data.favorites.splice(index, 1)
      this.scheduleSave()
      console.log('💔 [LibraryStore] 取消收藏:', trackId)
      return false
    } else {
      // 添加收藏
      this.data.favorites.push(trackId)
      this.scheduleSave()
      console.log('❤️ [LibraryStore] 添加收藏:', trackId)
      return true
    }
  }

  isFavorite(trackId: string): boolean {
    return this.data.favorites.includes(trackId)
  }

  getFavorites(): string[] {
    return [...this.data.favorites]
  }

  // ==================== 播放记录管理 ====================
  
  recordPlay(trackId: string) {
    const now = Date.now()
    
    // 更新播放次数
    this.data.playCounts[trackId] = (this.data.playCounts[trackId] || 0) + 1
    
    // 更新最后播放时�?
    this.data.lastPlayedAt[trackId] = now
    
    // 更新最近播放列表（去重 + 移到最前）
    const filtered = this.data.recents.filter(id => id !== trackId)
    this.data.recents = [trackId, ...filtered].slice(0, 200) // 最�?200 �?
    
    this.scheduleSave()
    console.log('🎵 [LibraryStore] 记录播放:', trackId, `(�?${this.data.playCounts[trackId]} �?`)
  }

  getPlayCount(trackId: string): number {
    return this.data.playCounts[trackId] || 0
  }

  getPlayCounts(): Record<string, number> {
    return { ...this.data.playCounts }
  }

  // ⭐ 记录真实播放时长（当切换歌曲或停止播放时调用）
  recordPlayDuration(trackId: string, durationSeconds: number) {
    if (durationSeconds > 0) {
      this.data.playDurations[trackId] = (this.data.playDurations[trackId] || 0) + durationSeconds
      this.scheduleSave()
      console.log('⏱️ [LibraryStore] 记录播放时长:', trackId, `${durationSeconds}s`)
    }
  }

  getPlayDurations(): Record<string, number> {
    return { ...this.data.playDurations }
  }

  getLastPlayedAt(trackId: string): number | undefined {
    return this.data.lastPlayedAt[trackId]
  }

  getRecents(): string[] {
    return [...this.data.recents]
  }

  // ==================== 播放列表管理 ====================
  
  createPlaylist(name: string): Playlist {
    const playlist: Playlist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    this.data.playlists.push(playlist)
    this.scheduleSave()
    console.log('📋 [LibraryStore] 创建播放列表:', name)
    return playlist
  }

  renamePlaylist(playlistId: string, newName: string): boolean {
    const playlist = this.data.playlists.find(p => p.id === playlistId)
    if (playlist) {
      playlist.name = newName
      playlist.updatedAt = Date.now()
      this.scheduleSave()
      console.log('✏️ [LibraryStore] 重命名播放列�?', newName)
      return true
    }
    return false
  }

  deletePlaylist(playlistId: string): boolean {
    const index = this.data.playlists.findIndex(p => p.id === playlistId)
    if (index > -1) {
      const playlist = this.data.playlists[index]
      this.data.playlists.splice(index, 1)
      this.scheduleSave()
      console.log('🗑�?[LibraryStore] 删除播放列表:', playlist.name)
      return true
    }
    return false
  }

  addToPlaylist(playlistId: string, trackId: string): boolean {
    const playlist = this.data.playlists.find(p => p.id === playlistId)
    if (playlist && !playlist.trackIds.includes(trackId)) {
      playlist.trackIds.push(trackId)
      playlist.updatedAt = Date.now()
      this.scheduleSave()
      console.log('�?[LibraryStore] 添加到播放列�?', playlistId, trackId)
      return true
    }
    return false
  }

  removeFromPlaylist(playlistId: string, trackId: string): boolean {
    const playlist = this.data.playlists.find(p => p.id === playlistId)
    if (playlist) {
      const index = playlist.trackIds.indexOf(trackId)
      if (index > -1) {
        playlist.trackIds.splice(index, 1)
        playlist.updatedAt = Date.now()
        this.scheduleSave()
        console.log('�?[LibraryStore] 从播放列表移�?', playlistId, trackId)
        return true
      }
    }
    return false
  }

  getPlaylists(): Playlist[] {
    return [...this.data.playlists]
  }

  getPlaylist(playlistId: string): Playlist | undefined {
    return this.data.playlists.find(p => p.id === playlistId)
  }

  // ==================== 统计数据 ====================
  
  getStats() {
    const totalPlays = Object.values(this.data.playCounts).reduce((sum, count) => sum + count, 0)
    const mostPlayedTrackId = Object.entries(this.data.playCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0]

    return {
      totalTracks: Object.keys(this.data.tracksById).length,
      totalFavorites: this.data.favorites.length,
      totalPlaylists: this.data.playlists.length,
      totalPlays,
      mostPlayedTrackId,
      recentCount: this.data.recents.length
    }
  }

  // ==================== 开发工�?====================
  
  clearAllLibraryData() {
    if (process.env.NODE_ENV !== 'production') {
      this.data = { ...DEFAULT_LIBRARY_DATA }
      localStorage.removeItem(this.storageKey)
      console.warn('🧹 [LibraryStore] 已清空所有库数据（仅开发环境）')
    }
  }
}

// �?单例导出
export const libraryStore = new LibraryDataLayer()
export type { LibraryDataLayer }

