import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { fetchCoverForTrack } from '../utils/coverSearch'
import { normalizeCoverSrc } from '../utils/normalizeCoverSrc'
import './PlayerBar.css'

// 格式化时长为 mm:ss
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '00:00'
  
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverLoading, setCoverLoading] = useState(false)
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    errorMessage,
    showLyricsOverlay,  // ⭐ 读取 overlay 状态
    togglePlayPause,
    next,
    prev,
    seek,
    setVolume,
    setCurrentTime,
    setDuration,
    setAudioElement,
    clearError,
    setShowLyricsOverlay
  } = usePlayerStore()

  // ⭐ 初始化 audio element + 加载保存的音量（只执行一次）
  useEffect(() => {
    if (audioRef.current) {
      console.log('🎵 [PlayerBar] 初始化 Audio Element')
      setAudioElement(audioRef.current)
      
      // ⭐ 从 electron-store 加载保存的音量
      window.electronAPI.getVolume().then((savedVolume) => {
        console.log('🔊 [PlayerBar] 加载保存的音量:', savedVolume)
        setVolume(savedVolume)
        if (audioRef.current) {
          audioRef.current.volume = savedVolume / 100
        }
      }).catch((err) => {
        console.error('❌ [PlayerBar] 加载音量失败:', err)
        // 失败时使用默认音量
        if (audioRef.current) {
          audioRef.current.volume = volume / 100
        }
      })
    }
  }, [setAudioElement, setVolume])

  // 监听音频事件
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    console.log('🎧 [PlayerBar] 绑定音频事件监听器')

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => {
      console.log('⏱️ [PlayerBar] duration 改变:', audio.duration)
      setDuration(audio.duration)
    }
    const handleEnded = () => {
      console.log('🏁 [PlayerBar] 播放结束，自动下一首')
      next()
    }
    const handleLoadStart = () => console.log('📥 [PlayerBar] 开始加载音频')
    const handleLoadedMetadata = () => {
      console.log('📊 [PlayerBar] 元数据已加载', { duration: audio.duration })
    }
    const handleCanPlay = () => console.log('✅ [PlayerBar] 可以开始播放')
    const handlePlay = () => console.log('▶️ [PlayerBar] 播放事件触发')
    const handlePause = () => console.log('⏸️ [PlayerBar] 暂停事件触发')
    const handleError = () => {
      console.error('❌ [PlayerBar] 音频错误:', audio.error)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('error', handleError)
    }
  }, [setCurrentTime, setDuration, next])

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    seek(time)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value) * 100 // slider 是 0-1，转为 0-100
    setVolume(vol)
  }

  // ⭐ 键盘控制音量（左右方向键 ±5）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.isContentEditable) {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setVolume(Math.max(0, volume - 5))
        console.log('⬅️ [PlayerBar] 音量 -5:', volume - 5)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setVolume(Math.min(100, volume + 5))
        console.log('➡️ [PlayerBar] 音量 +5:', volume + 5)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [volume, setVolume])

  // ⭐ 加载封面逻辑
  useEffect(() => {
    if (!currentTrack) {
      setCoverUrl(null)
      return
    }

    // 优先使用本地 metadata 封面
    if (currentTrack.pictureBase64) {
      const url = normalizeCoverSrc(currentTrack.pictureBase64)
      setCoverUrl(url)
      return
    }

    // 如果已有缓存的 coverUrl
    if (currentTrack.coverUrl) {
      const url = normalizeCoverSrc(currentTrack.coverUrl)
      setCoverUrl(url)
      return
    }

    // 尝试从持久化存储加载
    const loadCachedCover = async () => {
      try {
        const cachedUrl = await window.electronAPI.getCoverUrl(currentTrack.id)
        if (cachedUrl) {
          const url = normalizeCoverSrc(cachedUrl)
          setCoverUrl(url)
          return
        }

        // 如果都没有，从网上搜索
        setCoverLoading(true)
        
        // 🔥 使用新的智能封面搜索（集成标准化和搜索计划）
        const onlineCover = await fetchCoverForTrack(currentTrack)
        
        if (onlineCover) {
          const url = normalizeCoverSrc(onlineCover)
          setCoverUrl(url)
          
          // ⭐ 保存到持久化存储
          await window.electronAPI.saveCoverUrl(currentTrack.id, onlineCover)
        } else {
          setCoverUrl(null)
        }
      } catch (error) {
        console.error('❌ [PlayerBar] 加载封面失败:', error)
        setCoverUrl(null)
      } finally {
        setCoverLoading(false)
      }
    }

    loadCachedCover()
  }, [currentTrack])

  // 如果没有当前曲目，不显示播放器
  if (!currentTrack) {
    return <audio ref={audioRef} />
  }

  return (
    <>
      <audio ref={audioRef} />
      
      <div className="playerbar">
        {/* 错误提示 */}
        {errorMessage && (
          <div className="error-toast">
            {errorMessage}
            <button className="error-close" onClick={clearError}>✕</button>
          </div>
        )}
        
        {/* 左侧：当前曲目信息 */}
        <div className="playerbar-left">
          {/* ⭐ 封面（点击 toggle 歌词 Overlay）*/}
          <div 
            className="track-cover" 
            onClick={() => setShowLyricsOverlay(!showLyricsOverlay)}
            title={showLyricsOverlay ? "关闭歌词" : "查看歌词"}
          >
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt="" 
                className="cover-image"
              />
            ) : coverLoading ? (
              <div className="cover-placeholder">
                <svg className="cover-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                </svg>
              </div>
            ) : (
              <div className="cover-placeholder">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
            )}
          </div>
          
          {/* ⭐ 歌曲信息 */}
          <div className="track-info">
            <div className="track-title" title={currentTrack.title}>
              {currentTrack.title}
            </div>
            <div className="track-artist" title={currentTrack.artist}>
              {currentTrack.artist}
            </div>
          </div>
        </div>

        {/* 中间：播放控制 */}
        <div className="playerbar-center">
          <div className="controls">
            <button className="control-btn" onClick={prev} title="上一首">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 20L9 12l10-8v16z"/>
                <path d="M5 19V5"/>
              </svg>
            </button>
            
            <button className="control-btn-main" onClick={togglePlayPause} title={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button className="control-btn" onClick={next} title="下一首">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 4l10 8-10 8V4z"/>
                <path d="M19 5v14"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 右侧：进度和音量 */}
        <div className="playerbar-right">
          <div className="progress-section">
            <span className="time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="progress-slider"
            />
            <span className="time">{formatTime(duration)}</span>
          </div>
          
          <div className="volume-section">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume / 100}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
            {/* ⭐ 显示音量数值 0-100 */}
            <span className="volume-value">{Math.round(volume)}</span>
          </div>
        </div>
      </div>
    </>
  )
}
