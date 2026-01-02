// 统一的 Track 类型
export interface Track {
  id: string
  path: string
  title: string
  displayTitle?: string  // ⭐ 原始标题（未清洗，用于 UI 显示）
  artist: string
  album: string
  duration: number
  pictureBase64?: string
  provider: string // 标识来源：'local' | 'netease' | 'qq' 等
}

// 搜索结果
export interface SearchResult {
  tracks: Track[]
  total: number
}

// 音乐源 Provider 接口
export interface MusicProvider {
  // Provider 标识
  readonly name: string
  readonly displayName: string
  
  // 是否启用
  isEnabled(): boolean
  
  // 搜索
  search(keyword: string, limit?: number): Promise<SearchResult>
  
  // 获取歌曲详情
  getTrackDetail(trackId: string): Promise<Track | null>
  
  // 获取播放 URL（返回可播放的音频流地址）
  getStreamUrl(trackId: string): Promise<string | null>
  
  // 认证相关（可选）
  auth?(): Promise<boolean>
  isAuthenticated?(): boolean
}
