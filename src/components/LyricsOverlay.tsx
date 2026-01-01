import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '../store/playerStore'
import { fetchCoverForTrack } from '../utils/coverSearch'
import { fetchLyricsForTrack } from '../utils/lyricsService'
import { normalizeCoverSrc } from '../utils/normalizeCoverSrc'
import { LyricsResult, LyricsLine } from '../types/lyrics'
import './LyricsOverlay.css'

// ⭐ 配置：歌词聚焦位置微调（上下 spacer 占容器高度的比例）
// 范围：0.05~0.10，值越大歌词越往上偏移
const SPACER_RATIO = 0.10 // 默认 8%

// ⭐ 字号调整配置
const FONT_SIZE_MIN = 12
const FONT_SIZE_MAX = 28
const FONT_SIZE_STEP = 2
const FONT_SIZE_DEFAULT = 20

interface ContextMenuPosition {
  x: number
  y: number
}

export function LyricsOverlay() {
  const { 
    showLyricsOverlay, 
    setShowLyricsOverlay, 
    currentTrack,
    lyricsOptions,  // ⭐ 读取歌词显示选项
    setLyricsOptions, // ⭐ 更新歌词选项
    audioElement    // ⭐ 获取 audio 元素用于时间追踪
  } = usePlayerStore()
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(0) // ⭐ 当前播放时间（毫秒）
  const [spacerHeight, setSpacerHeight] = useState(0) // ⭐ 动态 spacer 高度
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null) // ⭐ 右键菜单位置
  const lyricsBodyRef = useRef<HTMLDivElement>(null) // ⭐ 歌词滚动容器引用
  const contextMenuRef = useRef<HTMLDivElement>(null) // ⭐ 右键菜单引用

  // 加载封面（使用智能搜索）
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

    // 使用缓存的 coverUrl
    if (currentTrack.coverUrl) {
      const url = normalizeCoverSrc(currentTrack.coverUrl)
      setCoverUrl(url)
      return
    }

    // 从持久化存储加载
    const loadCover = async () => {
      try {
        const cachedUrl = await window.electronAPI.getCoverUrl(currentTrack.id)
        if (cachedUrl) {
          const url = normalizeCoverSrc(cachedUrl)
          setCoverUrl(url)
          return
        }

        // 🔥 使用新的智能封面搜索（集成标准化和搜索计划）
        const onlineCover = await fetchCoverForTrack(currentTrack)
        
        if (onlineCover) {
          const url = normalizeCoverSrc(onlineCover)
          setCoverUrl(url)
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

  // ⭐ 加载歌词（当 Overlay 打开且歌曲变化时）- 使用智能搜索
  useEffect(() => {
    if (!showLyricsOverlay || !currentTrack) {
      setLyrics(null)
      return
    }

    const loadLyrics = async () => {
      setLyricsLoading(true)
      setLyrics(null)

      try {
        // 🔥 使用新的智能搜索（集成标准化和搜索计划）
        const result = await fetchLyricsForTrack(currentTrack)
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

  // ⭐ 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // 计算菜单位置，考虑边界
    const menuWidth = 180
    const menuHeight = 120
    let x = e.clientX
    let y = e.clientY
    
    // 边界检测：右边界
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10
    }
    
    // 边界检测：下边界
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }
    
    setContextMenu({ x, y })
  }

  // ⭐ 字号调整函数
  const increaseFontSize = () => {
    const newSize = Math.min(lyricsOptions.fontSize + FONT_SIZE_STEP, FONT_SIZE_MAX)
    setLyricsOptions({ fontSize: newSize })
  }

  const decreaseFontSize = () => {
    const newSize = Math.max(lyricsOptions.fontSize - FONT_SIZE_STEP, FONT_SIZE_MIN)
    setLyricsOptions({ fontSize: newSize })
  }

  const resetFontSize = () => {
    setLyricsOptions({ fontSize: FONT_SIZE_DEFAULT })
  }

  // ⭐ 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  // ⭐ 监听容器尺寸变化，动态更新 spacer 高度
  useEffect(() => {
    if (!lyricsBodyRef.current) return

    const updateSpacerHeight = () => {
      if (lyricsBodyRef.current) {
        const containerHeight = lyricsBodyRef.current.clientHeight
        setSpacerHeight(containerHeight * SPACER_RATIO)
      }
    }

    // 初始计算
    updateSpacerHeight()

    // 监听尺寸变化
    const resizeObserver = new ResizeObserver(updateSpacerHeight)
    resizeObserver.observe(lyricsBodyRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [lyricsBodyRef.current, showLyricsOverlay])

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLyricsOverlay) {
        setShowLyricsOverlay(false)
      }
      
      // ⭐ 快捷键：字号调整（仅在歌词页打开时生效）
      if (showLyricsOverlay && e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          increaseFontSize()
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          decreaseFontSize()
        } else if (e.key === '0') {
          e.preventDefault()
          resetFontSize()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showLyricsOverlay, setShowLyricsOverlay, lyricsOptions.fontSize, setLyricsOptions])

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
                  <img 
                    src={coverUrl} 
                    alt="" 
                    className="lyrics-cover-image"
                  />
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
                onContextMenu={handleContextMenu}
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
                    {/* ⭐ 顶部 spacer：用于微调聚焦位置 */}
                    {spacerHeight > 0 && (
                      <div 
                        className="lyrics-spacer" 
                        style={{ height: `${spacerHeight}px` }}
                        aria-hidden="true"
                      />
                    )}
                    
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
                    
                    {/* ⭐ 底部 spacer：用于微调聚焦位置 */}
                    {spacerHeight > 0 && (
                      <div 
                        className="lyrics-spacer" 
                        style={{ height: `${spacerHeight}px` }}
                        aria-hidden="true"
                      />
                    )}
                    
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

        {/* ⭐ 右键菜单 */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="lyrics-context-menu"
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`
            }}
          >
            <div className="lyrics-context-menu-header">
              字号：{lyricsOptions.fontSize}px
            </div>
            <button
              className="lyrics-context-menu-item"
              onClick={() => {
                increaseFontSize()
                setContextMenu(null)
              }}
              disabled={lyricsOptions.fontSize >= FONT_SIZE_MAX}
            >
              <span>字体变大</span>
              <span className="lyrics-context-menu-shortcut">Ctrl+Plus</span>
            </button>
            <button
              className="lyrics-context-menu-item"
              onClick={() => {
                decreaseFontSize()
                setContextMenu(null)
              }}
              disabled={lyricsOptions.fontSize <= FONT_SIZE_MIN}
            >
              <span>字体变小</span>
              <span className="lyrics-context-menu-shortcut">Ctrl+Minus</span>
            </button>
            <div className="lyrics-context-menu-divider" />
            <button
              className="lyrics-context-menu-item"
              onClick={() => {
                resetFontSize()
                setContextMenu(null)
              }}
            >
              <span>重置字号</span>
              <span className="lyrics-context-menu-shortcut">Ctrl+0</span>
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}
