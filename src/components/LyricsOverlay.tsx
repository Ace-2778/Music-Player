import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '../store/playerStore'
import { fetchCoverFromInternet } from '../utils/coverSearch'
import { fetchLyrics } from '../utils/lyricsService'
import { LyricsResult, LyricsLine } from '../types/lyrics'
import './LyricsOverlay.css'

export function LyricsOverlay() {
  const { 
    showLyricsOverlay, 
    setShowLyricsOverlay, 
    currentTrack,
    lyricsOptions,  // ⭐ 读取歌词显示选项
    audioElement    // ⭐ 获取 audio 元素用于时间追踪
  } = usePlayerStore()
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(0) // ⭐ 当前播放时间（毫秒）
  const lyricsBodyRef = useRef<HTMLDivElement>(null) // ⭐ 歌词滚动容器引用

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

  // ⭐ 加载歌词（当 Overlay 打开且歌曲变化时）
  useEffect(() => {
    if (!showLyricsOverlay || !currentTrack) {
      setLyrics(null)
      return
    }

    const loadLyrics = async () => {
      setLyricsLoading(true)
      setLyrics(null)

      try {
        console.log('🎵 [LyricsOverlay] 开始加载歌词:', {
          title: currentTrack.title,
          artist: currentTrack.artist
        })

        const result = await fetchLyrics(currentTrack.artist, currentTrack.title)
        
        console.log('✅ [LyricsOverlay] 歌词加载完成:', {
          type: result.type,
          source: result.source,
          hasTimestamps: result.hasTimestamps,
          linesCount: result.lines?.length || 0
        })

        setLyrics(result)
      } catch (error) {
        console.error('❌ [LyricsOverlay] 加载歌词失败:', error)
        setLyrics({
          type: 'none',
          source: 'lrclib',
          hasTimestamps: false,
          error: 'Failed to load lyrics'
        })
      } finally {
        setLyricsLoading(false)
      }
    }

    loadLyrics()
  }, [showLyricsOverlay, currentTrack])

  // ⭐ 二分查找：返回当前应高亮的歌词行 index
  const getActiveLyricIndex = (lines: LyricsLine[], currentTimeMs: number): number => {
    if (!lines || lines.length === 0) return -1
    
    // 检查第一行是否有 timeMs（是否为 LRC 格式）
    if (lines[0].timeMs === undefined) return -1
    
    // 二分查找最后一个 timeMs <= currentTimeMs 的行
    let left = 0
    let right = lines.length - 1
    let result = -1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const lineTime = lines[mid].timeMs!
      
      if (lineTime <= currentTimeMs) {
        result = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }
    
    return result
  }

  // ⭐ 实时更新播放时间（用于歌词同步）
  useEffect(() => {
    if (!showLyricsOverlay || !audioElement) {
      return
    }

    let animationFrameId: number

    const updateTime = () => {
      setCurrentTimeMs(audioElement.currentTime * 1000)
      animationFrameId = requestAnimationFrame(updateTime)
    }

    animationFrameId = requestAnimationFrame(updateTime)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [showLyricsOverlay, audioElement])

  // ⭐ 计算当前高亮的歌词行
  const activeIndex = lyrics?.lines ? getActiveLyricIndex(lyrics.lines, currentTimeMs) : -1

  // ⭐ 自动滚动：当 activeIndex 变化时，滚动到该行
  useEffect(() => {
    if (activeIndex === -1 || !lyricsBodyRef.current) return

    const activeLine = lyricsBodyRef.current.querySelector(
      `[data-line-index="${activeIndex}"]`
    ) as HTMLElement

    if (activeLine) {
      activeLine.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [activeIndex])

  // ⭐ 点击歌词行跳转播放时间
  const handleLineClick = (line: LyricsLine) => {
    if (line.timeMs !== undefined && audioElement) {
      audioElement.currentTime = line.timeMs / 1000
    }
  }

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
    <AnimatePresence>
      {showLyricsOverlay && (
        <motion.div 
          className="lyrics-overlay"
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div 
            className="lyrics-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
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
              {/* 歌曲信息（固定顶部） */}
              <div className="lyrics-header">
                <h1 className="lyrics-title">{currentTrack.title}</h1>
                <p className="lyrics-artist">{currentTrack.artist}</p>
              </div>
              {/* 歌词内容（仅此区域滚动） */}
              <div
                ref={lyricsBodyRef}
                className="lyrics-body-scroll"
                style={{
                  textAlign: lyricsOptions.align,
                  fontFamily: lyricsOptions.fontFamily,
                  fontSize: `${lyricsOptions.fontSize}px`,
                  lineHeight: lyricsOptions.lineHeight
                }}
              >
                {/* Loading 状态 */}
                {lyricsLoading && (
                  <div className="lyrics-state">
                    <svg className="lyrics-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                    </svg>
                    <p>Loading lyrics...</p>
                  </div>
                )}

                {/* Error/None 状态 */}
                {!lyricsLoading && lyrics && lyrics.type === 'none' && (
                  <div className="lyrics-state">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>No lyrics found</p>
                  </div>
                )}

                {/* Success 状态：显示歌词 */}
                {!lyricsLoading && lyrics && lyrics.type !== 'none' && lyrics.lines && (
                  <div className="lyrics-lines">
                    {lyrics.lines.map((line, index) => {
                      const isActive = index === activeIndex
                      const hasTimeMs = line.timeMs !== undefined
                      
                      return (
                        <div
                          key={index}
                          className={`lyrics-line ${
                            isActive ? 'lyrics-line-active' : ''
                          } ${
                            hasTimeMs ? 'lyrics-line-clickable' : ''
                          }`}
                          data-time={line.timeMs}
                          data-line-index={index}
                          onClick={() => handleLineClick(line)}
                        >
                          {line.text || '♪'}
                        </div>
                      )
                    })}
                    <div className="lyrics-meta">
                      <span className="lyrics-source">
                        {lyrics.source === 'cache' ? '💾 Cached' : `🌐 ${lyrics.source}`}
                      </span>
                      {lyrics.hasTimestamps && (
                        <span className="lyrics-type">• LRC</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}
