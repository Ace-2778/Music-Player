import { useState } from 'react'
import './App.css'
import { TopBar } from './components/TopBar'
import { TrackList } from './components/TrackList'
import { PlayerBar } from './components/PlayerBar'
import { LyricsOverlay } from './components/LyricsOverlay'
import { usePlayerStore, Track } from './store/playerStore'
import { providerManager, LocalProvider } from './providers'

// 声明 electronAPI 类型
declare global {
  interface Window {
    electronAPI: {
      selectMusicFolder: () => Promise<string | null>
      scanMusicFolder: (folderPath: string) => Promise<Track[]>
      getFileUrl: (filePath: string) => Promise<string>
      getVolume: () => Promise<number>
      setVolume: (volume: number) => Promise<number>
      saveCoverUrl: (trackId: string, coverUrl: string) => Promise<boolean>
      getCoverUrl: (trackId: string) => Promise<string | null>
    }
  }
}

// 格式化时长为 mm:ss
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function App() {
  const [tracks, setTracks] = useState<Track[]>([]) // 原始完整列表
  const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]) // 显示的列表
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'none' | 'title' | 'artist'>('none')
  
  const { setPlaylist, playTrack, currentTrack, playlist } = usePlayerStore()

  const handleSelectFolder = async () => {
    setLoading(true)
    try {
      const folderPath = await window.electronAPI.selectMusicFolder()
      
      if (folderPath) {
        setSelectedFolder(folderPath)
        
        // 扫描音乐文件并解析 metadata
        const scannedTracks = await window.electronAPI.scanMusicFolder(folderPath)
        
        // 标记为本地音乐
        const localTracks = scannedTracks.map(track => ({
          ...track,
          provider: 'local'
        }))
        
        setTracks(localTracks)
        setDisplayedTracks(localTracks)
        
        // 更新 LocalProvider 的曲库
        const localProvider = providerManager.getProvider('local') as LocalProvider
        if (localProvider) {
          localProvider.setTracks(localTracks)
        }
        
        setPlaylist(localTracks) // 设置播放列表（保持原始顺序）
      }
    } catch (error) {
      console.error('选择文件夹失败:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 搜索和排序逻辑
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFiltersAndSort(query, sortBy)
  }
  
  const handleSort = (sort: 'none' | 'title' | 'artist') => {
    setSortBy(sort)
    applyFiltersAndSort(searchQuery, sort)
  }
  
  const applyFiltersAndSort = (query: string, sort: 'none' | 'title' | 'artist') => {
    let filtered = tracks
    
    // 搜索过滤
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      filtered = tracks.filter(track => 
        track.title.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery) ||
        track.album.toLowerCase().includes(lowerQuery)
      )
    }
    
    // 排序
    let sorted = [...filtered]
    if (sort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === 'artist') {
      sorted.sort((a, b) => a.artist.localeCompare(b.artist))
    }
    
    setDisplayedTracks(sorted)
  }
  
  const handleTrackClick = (track: Track) => {
    console.log('🖱️ [App] 点击歌曲:', {
      title: track.title,
      provider: track.provider
    })
    
    // ⭐ 根据 provider 严格区分行为
    if (track.provider === 'local') {
      // ⭐ 本地音乐：调用播放
      console.log('🎵 [App] 本地音乐，准备播放')
      
      // ⭐ 修复：在原始 tracks 中找到索引（而不是 playlist）
      const originalIndex = tracks.findIndex(t => t.id === track.id)
      console.log('🔍 [App] 查找歌曲索引:', originalIndex)
      
      if (originalIndex !== -1) {
        console.log('▶️ [App] 调用 playTrack:', track.title)
        playTrack(track, originalIndex)
      } else {
        console.error('❌ [App] 在曲库中找不到歌曲:', track.title)
        alert('播放失败：在播放列表中找不到该歌曲')
      }
    } else {
      // ⭐ 在线音乐：只弹提示
      console.log('🌐 [App] 在线音乐，拒绝播放')
      alert('暂不支持在线音乐播放，该功能即将上线！')
      return
    }
  }

  return (
    <div className="app">
      <TopBar 
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        onImportClick={handleSelectFolder}
        loading={loading}
      />
      
      <div className="app-main">
        <TrackList 
          tracks={displayedTracks}
          currentTrack={currentTrack}
          onTrackClick={handleTrackClick}
        />
      </div>
      
      <PlayerBar />
      
      {/* ⭐ 歌词 Overlay */}
      <LyricsOverlay />
    </div>
  )
}

export default App
