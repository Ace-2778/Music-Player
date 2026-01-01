import { useEffect, useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { fetchCoverFromInternet } from '../utils/coverSearch'
import './LyricsOverlay.css'

export function LyricsOverlay() {
  const { 
    showLyricsOverlay, 
    setShowLyricsOverlay, 
    currentTrack,
    lyricsOptions  // ⭐ 读取歌词显示选项
  } = usePlayerStore()
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  // 加载封面
  useEffect(() => {
    if (!currentTrack) {
      setCoverUrl(null)
      return
    }

    // 优先使用本地 metadata 封面
    if (currentTrack.pictureBase64) {
      setCoverUrl(`data:image/jpeg;base64,${currentTrack.pictureBase64}`)
      return
    }

    // 使用缓存的 coverUrl
    if (currentTrack.coverUrl) {
      setCoverUrl(currentTrack.coverUrl)
      return
    }

    // 从持久化存储加载
    const loadCover = async () => {
      try {
        const cachedUrl = await window.electronAPI.getCoverUrl(currentTrack.id)
        if (cachedUrl) {
          setCoverUrl(cachedUrl)
          return
        }

        // 从网上搜索
        const onlineCover = await fetchCoverFromInternet(
          currentTrack.title,
          currentTrack.artist
        )
        
        if (onlineCover) {
          setCoverUrl(onlineCover)
          await window.electronAPI.saveCoverUrl(currentTrack.id, onlineCover)
        } else {
          setCoverUrl(null)
        }
      } catch (error) {
        console.error('❌ [LyricsOverlay] 加载封面失败:', error)
        setCoverUrl(null)
      }
    }

    loadCover()
  }, [currentTrack])

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLyricsOverlay) {
        setShowLyricsOverlay(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showLyricsOverlay, setShowLyricsOverlay])

  if (!showLyricsOverlay) {
    return null
  }

  const handleClose = () => {
    setShowLyricsOverlay(false)
  }

  // 点击遮罩关闭（点击内容区域不关闭）
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div 
      className={`lyrics-overlay ${showLyricsOverlay ? 'lyrics-overlay-open' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className="lyrics-content">
        {/* 右上角关闭按钮 */}
        <button className="lyrics-close-btn" onClick={handleClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {currentTrack && (
          <div className="lyrics-layout">
            {/* 左侧：封面 */}
            <div className="lyrics-cover-section">
              <div className="lyrics-cover">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="lyrics-cover-image" />
                ) : (
                  <div className="lyrics-cover-placeholder">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：歌词 */}
            <div className="lyrics-text-section">
              {/* 歌曲信息 */}
              <div className="lyrics-header">
                <h1 className="lyrics-title">{currentTrack.title}</h1>
                <p className="lyrics-artist">{currentTrack.artist}</p>
              </div>

              {/* 歌词内容（可滚动）*/}
              <div 
                className="lyrics-scroll-area"
                style={{
                  // ⭐ 使用 lyricsOptions 控制歌词样式
                  textAlign: lyricsOptions.align,
                  fontFamily: lyricsOptions.fontFamily,
                  fontSize: `${lyricsOptions.fontSize}px`,
                  lineHeight: lyricsOptions.lineHeight
                }}
              >
                <div className="lyrics-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                  <p>歌词功能即将上线</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
