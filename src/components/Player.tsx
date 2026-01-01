import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'
import './Player.css'

// 格式化时长为 mm:ss
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '00:00'
  
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function Player() {
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    errorMessage, // ⭐ 新增：获取错误信息
    togglePlayPause,
    next,
    prev,
    seek,
    setVolume,
    setCurrentTime,
    setDuration,
    setAudioElement,
    clearError // ⭐ 新增
  } = usePlayerStore()

  // ⭐ 修复：初始化 audio element（只执行一次）
  useEffect(() => {
    if (audioRef.current) {
      console.log('🎵 [Player] 初始化 Audio Element')
      setAudioElement(audioRef.current)
      
      // ⭐ 修复：设置初始音量
      audioRef.current.volume = volume
    }
  }, [setAudioElement]) // 移除 volume 依赖，避免重复初始化

  // ⭐ 修复：监听音频事件，添加详细日志
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    console.log('🎧 [Player] 绑定音频事件监听器')

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleDurationChange = () => {
      console.log('⏱️ [Player] duration 改变:', audio.duration)
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      console.log('🏁 [Player] 播放结束，自动下一首')
      next()
    }

    // ⭐ 新增：详细的调试事件
    const handleLoadStart = () => {
      console.log('📥 [Player] loadstart - 开始加载音频')
    }

    const handleLoadedMetadata = () => {
      console.log('📊 [Player] loadedmetadata - 元数据已加载', {
        duration: audio.duration,
        src: audio.src
      })
    }

    const handleCanPlay = () => {
      console.log('✅ [Player] canplay - 可以开始播放')
    }

    const handlePlay = () => {
      console.log('▶️ [Player] play - 播放事件触发')
    }

    const handlePause = () => {
      console.log('⏸️ [Player] pause - 暂停事件触发')
    }

    const handleError = (e: Event) => {
      console.error('❌ [Player] error - 音频错误:', {
        error: audio.error,
        code: audio.error?.code,
        message: audio.error?.message,
        src: audio.src,
        event: e
      })
      
      // 错误代码说明
      const errorMessages: Record<number, string> = {
        1: 'MEDIA_ERR_ABORTED - 用户中止',
        2: 'MEDIA_ERR_NETWORK - 网络错误',
        3: 'MEDIA_ERR_DECODE - 解码错误',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 不支持的音频格式或路径错误'
      }
      
      const errorCode = audio.error?.code || 0
      const errorMsg = errorMessages[errorCode] || '未知错误'
      console.error(`❌ [Player] 错误详情: ${errorMsg}`)
    }

    const handleStalled = () => {
      console.warn('⚠️ [Player] stalled - 音频加载停滞')
    }

    const handleWaiting = () => {
      console.log('⏳ [Player] waiting - 等待数据')
    }

    // 添加所有事件监听器
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('error', handleError)
    audio.addEventListener('stalled', handleStalled)
    audio.addEventListener('waiting', handleWaiting)

    return () => {
      console.log('🧹 [Player] 清理事件监听器')
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('stalled', handleStalled)
      audio.removeEventListener('waiting', handleWaiting)
    }
  }, [setCurrentTime, setDuration, next])

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    seek(time)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
  }

  if (!currentTrack) {
    return (
      <div className="player player-empty">
        <audio ref={audioRef} />
        <p>请选择一首歌曲开始播放</p>
      </div>
    )
  }

  return (
    <div className="player">
      {/* ⭐ 修复：Audio 元素（单例，通过 ref 管理） */}
      <audio ref={audioRef} />
      
      {/* ⭐ 新增：错误提示 */}
      {errorMessage && (
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ff4444',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          fontSize: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          zIndex: 1001
        }}>
          ⚠️ {errorMessage}
          <button
            onClick={clearError}
            style={{
              marginLeft: '10px',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      )}
      
      {/* 歌曲信息 */}
      <div className="player-info">
        {currentTrack.pictureBase64 && (
          <img 
            src={currentTrack.pictureBase64} 
            alt="封面" 
            className="player-cover"
          />
        )}
        <div className="player-text">
          <div className="player-title">{currentTrack.title}</div>
          <div className="player-artist">{currentTrack.artist}</div>
        </div>
      </div>

      {/* 播放控制 */}
      <div className="player-controls">
        <button onClick={prev} className="control-btn" title="上一首">
          ⏮️
        </button>
        <button onClick={togglePlayPause} className="control-btn control-btn-main" title={isPlaying ? '暂停' : '播放'}>
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button onClick={next} className="control-btn" title="下一首">
          ⏭️
        </button>
      </div>

      {/* 进度条 */}
      <div className="player-progress">
        <span className="time">{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="progress-bar"
        />
        <span className="time">{formatTime(duration)}</span>
      </div>

      {/* 音量控制 */}
      <div className="player-volume">
        <span>🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="volume-bar"
        />
      </div>
    </div>
  )
}
