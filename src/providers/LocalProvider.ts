import { MusicProvider, Track, SearchResult } from './types'

// 本地音乐 Provider
export class LocalProvider implements MusicProvider {
  readonly name = 'local'
  readonly displayName = '本地音乐'
  
  private tracks: Track[] = []
  
  constructor(tracks: Track[] = []) {
    this.tracks = tracks
  }
  
  // 更新本地曲库
  setTracks(tracks: Track[]) {
    this.tracks = tracks.map(track => ({
      ...track,
      provider: this.name
    }))
  }
  
  isEnabled(): boolean {
    return true
  }
  
  async search(keyword: string, limit: number = 50): Promise<SearchResult> {
    const lowerKeyword = keyword.toLowerCase()
    
    const filtered = this.tracks.filter(track =>
      track.title.toLowerCase().includes(lowerKeyword) ||
      track.artist.toLowerCase().includes(lowerKeyword) ||
      track.album.toLowerCase().includes(lowerKeyword)
    )
    
    const limited = filtered.slice(0, limit)
    
    return {
      tracks: limited,
      total: filtered.length
    }
  }
  
  async getTrackDetail(trackId: string): Promise<Track | null> {
    const track = this.tracks.find(t => t.id === trackId)
    return track || null
  }
  
  async getStreamUrl(trackId: string): Promise<string | null> {
    const track = this.tracks.find(t => t.id === trackId)
    if (!track) return null
    
    // 本地音乐需要通过 IPC 获取文件 URL
    try {
      return await window.electronAPI.getFileUrl(track.path)
    } catch (error) {
      console.error('获取本地文件 URL 失败:', error)
      return null
    }
  }
  
  getAllTracks(): Track[] {
    return this.tracks
  }
}
