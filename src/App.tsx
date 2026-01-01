import { useState, useEffect } from 'react'
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
      getLyricsOptions: () => Promise<any>
      saveLyricsOptions: (options: any) => Promise<any>
      getLibraryFolders: () => Promise<string[]>
      addLibraryFolder: (folderPath: string) => Promise<string[]>
      removeLibraryFolder: (folderPath: string) => Promise<string[]>
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
  
  const { setPlaylist, playTrack, currentTrack, playlist, setLyricsOptions } = usePlayerStore()

  // ⭐ 初始化：从 electron-store 读取持久化设置
  useEffect(() => {
    const initSettings = async () => {
      try {
        const savedLyricsOptions = await window.electronAPI.getLyricsOptions()
        setLyricsOptions(savedLyricsOptions)
        console.log('✅ [初始化] 加载歌词选项:', savedLyricsOptions)
      } catch (error) {
        console.error('❌ [初始化] 加载歌词选项失败:', error)
      }
    }
    initSettings()
  }, [setLyricsOptions])

  // ⭐ 启动时自动加载已保存的音乐文件夹
  useEffect(() => {
    const loadLibraryFolders = async () => {
      setLoading(true)
      try {
        const folders = await window.electronAPI.getLibraryFolders()
        console.log('📁 [启动加载] 已保存的文件夹:', folders)
        
        if (folders.length === 0) {
          console.log('📁 [启动加载] 无已保存的文件夹')
          setLoading(false)
          return
        }
        
        // 合并所有文件夹的音乐
        const allTracks: Track[] = []
        
        for (const folderPath of folders) {
          try {
            console.log('📁 [启动加载] 扫描文件夹:', folderPath)
            const scannedTracks = await window.electronAPI.scanMusicFolder(folderPath)
            
            // 标记为本地音乐
            const localTracks = scannedTracks.map(track => ({
              ...track,
              provider: 'local'
            }))
            
            allTracks.push(...localTracks)
            console.log(`✅ [启动加载] 已加载 ${localTracks.length} 首歌曲 来自: ${folderPath}`)
          } catch (error) {
            console.error(`❌ [启动加载] 扫描文件夹失败 ${folderPath}:`, error)
            // 容错：跳过出错的文件夹，继续扫描其他文件夹
          }
        }
        
        if (allTracks.length > 0) {
          setTracks(allTracks)
          setDisplayedTracks(allTracks)
          
          // 更新 LocalProvider 的曲库
          const localProvider = providerManager.getProvider('local') as LocalProvider
          if (localProvider) {
            localProvider.setTracks(allTracks)
          }
          
          setPlaylist(allTracks)
          console.log(`✅ [启动加载] 总共加载 ${allTracks.length} 首歌曲`)
        } else {
          console.log('📁 [启动加载] 未找到任何音乐文件')
        }
      } catch (error) {
        console.error('❌ [启动加载] 加载曲库失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadLibraryFolders()
  }, [setPlaylist])

  const handleSelectFolder = async () => {
    setLoading(true)
    try {
      const folderPath = await window.electronAPI.selectMusicFolder()
      
      if (folderPath) {
        setSelectedFolder(folderPath)
        
        // ⭐ 保存文件夹到持久化配置
        await window.electronAPI.addLibraryFolder(folderPath)
        console.log('✅ [持久化] 文件夹已保存:', folderPath)
        
        // 扫描音乐文件并解析 metadata
        const scannedTracks = await window.electronAPI.scanMusicFolder(folderPath)
        
        // 标记为本地音乐
        const newTracks = scannedTracks.map(track => ({
          ...track,
          provider: 'local'
        }))
        
        // ⭐ 去重合并：基于文件路径去重
        const existingPaths = new Set(tracks.map(t => t.path))
        const uniqueNewTracks = newTracks.filter(track => !existingPaths.has(track.path))
        
        if (uniqueNewTracks.length === 0) {
          console.log('📁 [导入文件夹] 该文件夹的歌曲已全部存在，无新增')
          setLoading(false)
          return
        }
        
        // ⭐ 平滑追加：增量更新曲库
        const mergedTracks = [...tracks, ...uniqueNewTracks]
        setTracks(mergedTracks)
        setDisplayedTracks(mergedTracks)
        
        // 更新 LocalProvider 的曲库
        const localProvider = providerManager.getProvider('local') as LocalProvider
        if (localProvider) {
          localProvider.setTracks(mergedTracks)
        }
        
        setPlaylist(mergedTracks) // 设置播放列表（保持原始顺序）
        console.log(`✅ [导入文件夹] 新增 ${uniqueNewTracks.length} 首歌曲（过滤 ${newTracks.length - uniqueNewTracks.length} 首重复），总计 ${mergedTracks.length} 首`)
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

  // 移除文件夹回调
  const handleRemoveFolder = async (folderPath: string) => {
    try {
      // 更新 electron-store 配置
      await window.electronAPI.removeLibraryFolder(folderPath)
      console.log('✅ [曲库管理] 移除文件夹:', folderPath)
      
      // 从曲库中移除该文件夹的所有歌曲
      const updatedTracks = tracks.filter(track => !track.path.startsWith(folderPath))
      setTracks(updatedTracks)
      setDisplayedTracks(updatedTracks)
      
      // 更新 LocalProvider 的曲库
      const localProvider = providerManager.getProvider('local') as LocalProvider
      if (localProvider) {
        localProvider.setTracks(updatedTracks)
      }
      
      setPlaylist(updatedTracks)
      console.log(`✅ [曲库管理] 移除完成，剩余 ${updatedTracks.length} 首歌曲`)
    } catch (error) {
      console.error('❌ [曲库管理] 移除文件夹失败:', error)
    }
  }

  // 重新扫描文件夹回调
  const handleRescanFolder = async (folderPath: string) => {
    setLoading(true)
    try {
      console.log('🔄 [曲库管理] 重新扫描文件夹:', folderPath)
      
      // 扫描文件夹
      const scannedTracks = await window.electronAPI.scanMusicFolder(folderPath)
      const newTracks = scannedTracks.map(track => ({
        ...track,
        provider: 'local'
      }))
      
      // 移除该文件夹的旧歌曲
      const otherTracks = tracks.filter(track => !track.path.startsWith(folderPath))
      
      // 合并新扫描的歌曲
      const mergedTracks = [...otherTracks, ...newTracks]
      setTracks(mergedTracks)
      setDisplayedTracks(mergedTracks)
      
      // 更新 LocalProvider 的曲库
      const localProvider = providerManager.getProvider('local') as LocalProvider
      if (localProvider) {
        localProvider.setTracks(mergedTracks)
      }
      
      setPlaylist(mergedTracks)
      console.log(`✅ [曲库管理] 重新扫描完成，该文件夹新增 ${newTracks.length} 首歌曲`)
    } catch (error) {
      console.error('❌ [曲库管理] 重新扫描失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <TopBar 
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        onImportClick={handleSelectFolder}
        loading={loading}
        onRescan={handleRescanFolder}
        onRemoveFolder={handleRemoveFolder}
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
