import { MusicProvider, Track, SearchResult } from './types'

// Mock 在线音乐 Provider（示例）
export class MockOnlineProvider implements MusicProvider {
  readonly name = 'mock-online'
  readonly displayName = '在线音乐 (Demo)'
  
  private mockTracks: Track[] = [
    {
      id: 'online-1',
      path: '',
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      duration: 269,
      provider: 'mock-online'
    },
    {
      id: 'online-2',
      path: '',
      title: '七里香',
      artist: '周杰伦',
      album: '七里香',
      duration: 300,
      provider: 'mock-online'
    },
    {
      id: 'online-3',
      path: '',
      title: '稻香',
      artist: '周杰伦',
      album: '魔杰座',
      duration: 223,
      provider: 'mock-online'
    },
    {
      id: 'online-4',
      path: '',
      title: '告白气球',
      artist: '周杰伦',
      album: '周杰伦的床边故事',
      duration: 206,
      provider: 'mock-online'
    },
    {
      id: 'online-5',
      path: '',
      title: '算什么男人',
      artist: '周杰伦',
      album: '十二新作',
      duration: 239,
      provider: 'mock-online'
    },
    {
      id: 'online-6',
      path: '',
      title: '红尘客栈',
      artist: '周杰伦',
      album: '十二新作',
      duration: 236,
      provider: 'mock-online'
    },
    {
      id: 'online-7',
      path: '',
      title: '说好不哭',
      artist: '周杰伦',
      album: '说好不哭',
      duration: 234,
      provider: 'mock-online'
    },
    {
      id: 'online-8',
      path: '',
      title: '夜曲',
      artist: '周杰伦',
      album: '十一月的萧邦',
      duration: 213,
      provider: 'mock-online'
    }
  ]
  
  isEnabled(): boolean {
    return true // Mock provider 始终启用
  }
  
  async search(keyword: string, limit: number = 50): Promise<SearchResult> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const lowerKeyword = keyword.toLowerCase()
    
    const filtered = this.mockTracks.filter(track =>
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
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const track = this.mockTracks.find(t => t.id === trackId)
    return track || null
  }
  
  async getStreamUrl(_trackId: string): Promise<string | null> {
    // Mock provider 不提供真实播放 URL
    return null
  }
  
  // Mock 认证
  async auth(): Promise<boolean> {
    return true
  }
  
  isAuthenticated(): boolean {
    return true
  }
}
