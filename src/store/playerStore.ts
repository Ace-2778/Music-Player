import { create } from 'zustand'

export interface Track {
  id: string
  path: string
  title: string
  displayTitle?: string  // ⭐ 原始标题（未清洗，用于 UI 显示）
  artist: string
  album: string
  duration: number
  pictureBase64?: string
  coverUrl?: string // ⭐ 在线搜索到的封面 URL（缓存）
  provider: string // 标识来源
}

// ⭐ 歌词显示选项（用户自定义配置）
export interface LyricsDisplayOptions {
  align: 'left' | 'center' | 'right'  // 对齐方式
  fontFamily: string                   // 字体
  fontSize: number                     // 字号（px）
  lineHeight: number                   // 行高（倍数）
}

interface PlayerState {
  // 播放列表
  playlist: Track[]
  currentTrack: Track | null
  currentIndex: number
  
  // 播放状态
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  
  // 错误信息 ⭐ 新增：用于显示播放错误
  errorMessage: string | null
  
  // ⭐ 歌词 Overlay 状态
  showLyricsOverlay: boolean
  
  // ⭐ 歌词显示选项（用户自定义配置）
  lyricsOptions: LyricsDisplayOptions
  
  // Audio element
  audioElement: HTMLAudioElement | null
  
  // Actions
  setPlaylist: (tracks: Track[]) => void
  playTrack: (track: Track, index: number) => Promise<void>
  play: () => void
  pause: () => void
  togglePlayPause: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setAudioElement: (audio: HTMLAudioElement) => void
  clearError: () => void // ⭐ 新增：清除错误
  setShowLyricsOverlay: (show: boolean) => void // ⭐ 新增：控制歌词 Overlay
  setLyricsOptions: (options: Partial<LyricsDisplayOptions>) => void // ⭐ 新增：更新歌词选项
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  playlist: [],
  currentTrack: null,
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 80, // ⭐ 修改：默认 80（0-100 范围）
  audioElement: null,
  errorMessage: null, // ⭐ 新增
  showLyricsOverlay: false, // ⭐ 新增：歌词 Overlay 默认关闭
  
  // ⭐ 歌词显示选项（默认值）
  lyricsOptions: {
    align: 'left',                          // 默认左对齐
    fontFamily: 'system-ui, sans-serif',    // 系统默认字体
    fontSize: 20,                           // ⭐ 默认 20px（调大以提升可读性）
    lineHeight: 1.8                         // 默认 1.8 倍行高
  },

  setPlaylist: (tracks) => set({ playlist: tracks }),

  // ⭐ 修复：完善的播放逻辑 - 确保 currentTrack 和实际播放一致
  playTrack: async (track, index) => {
    console.log('🎵 [playTrack] 开始播放:', { 
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        provider: track.provider,
        path: track.path
      }, 
      index 
    })
    
    const { audioElement } = get()
    
    if (!audioElement) {
      console.error('❌ [playTrack] audioElement 未初始化')
      set({ errorMessage: '播放器未初始化' })
      return
    }

    console.log('✅ [playTrack] audioElement 已初始化')

    // ⭐ 关键修复：只允许本地音乐播放，其他直接拒绝
    if (track.provider !== 'local') {
      console.error('❌ [playTrack] 拒绝播放非本地音乐:', track.provider)
      // ⭐ 不设置 currentTrack，不修改任何状态
      throw new Error(`不支持播放 ${track.provider} 音乐`)
    }

    // ⭐ 关键修复：立即设置 currentTrack，确保 UI 和播放一致
    console.log('📝 [playTrack] 设置 currentTrack 和 currentIndex')
    set({
      currentTrack: track, // ⭐ 必须是传入的 track，不能从队列拿
      currentIndex: index,
      isPlaying: false,
      errorMessage: null
    })
    console.log('✅ [playTrack] currentTrack 已设置')

    try {
      console.log('📂 [playTrack] 请求文件 URL:', track.path)
      
      // ⭐ 必须通过 IPC 获取 file:// URL
      const fileUrl = await window.electronAPI.getFileUrl(track.path)
      
      console.log('✅ [playTrack] 获取到 URL:', fileUrl)
      
      // ⭐ 验证 URL
      if (!fileUrl || fileUrl.trim() === '') {
        throw new Error('getFileUrl 返回空 URL')
      }
      
      if (!fileUrl.startsWith('file://')) {
        console.warn('⚠️ [playTrack] URL 不是 file:// 协议:', fileUrl)
      }
      
      // ⭐ 先暂停当前播放
      audioElement.pause()
      
      // ⭐ 设置新音频源（必须是当前 track 的 URL）
      console.log('🔄 [playTrack] 设置音频源:', fileUrl)
      audioElement.src = fileUrl
      
      // ⭐ 加载并播放
      console.log('▶️ [playTrack] 开始播放...')
      const playPromise = audioElement.play()
      
      // ⭐ 关键修复：正确处理 play() Promise
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error: Error) => {
          if (error.name === 'NotAllowedError' || error.message.includes('interrupted')) {
            console.warn('⚠️ [playTrack] play() 被中断（正常的竞态条件）:', error.message)
          } else {
            console.error('❌ [playTrack] play() 失败:', error)
            set({ 
              isPlaying: false,
              errorMessage: `无法播放 ${track.title}：${error.message}`
            })
          }
        })
      }
      
      console.log('✅ [playTrack] 播放命令已发送')
      set({ isPlaying: true })
      
    } catch (error) {
      // ⭐ 仅处理同步异常（如加载文件失败）
      // play() Promise 的异常在上面的 .catch() 中处理
      console.error('❌ [playTrack] 播放失败:', error)
      console.error('❌ [playTrack] 错误详情:', {
        name: (error as Error).name,
        message: (error as Error).message,
        track: track.title
      })
      
      const errorMsg = `无法播放 ${track.title}：${(error as Error).message || '未知错误'}`
      set({ 
        isPlaying: false,
        errorMessage: errorMsg
      })
      
      console.error('❌ [playTrack] 错误消息:', errorMsg)
    }
  },

  // ⭐ 修复：play 方法增强错误处理
  play: async () => {
    const { audioElement, currentTrack } = get()
    
    if (!audioElement) {
      console.error('❌ [play] audioElement 未初始化')
      return
    }
    
    if (!currentTrack) {
      console.warn('⚠️ [play] 没有当前歌曲')
      return
    }
    
    try {
      console.log('▶️ [play] 恢复播放')
      const playPromise = audioElement.play()
      
      // ⭐ 关键修复：正确处理 play() Promise
      // 防止 "The play() request was interrupted by a call to pause()" 错误
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error: Error) => {
          // 忽略 "NotAllowedError" 和 "被 pause 中断" 的错误
          // 这些是正常的竞态条件，不需要显示给用户
          if (error.name === 'NotAllowedError' || error.message.includes('interrupted')) {
            console.warn('⚠️ [play] play() 被中断（正常的竞态条件）:', error.message)
          } else {
            console.error('❌ [play] play() 失败:', error)
            set({ 
              isPlaying: false,
              errorMessage: `播放失败：${error.message}`
            })
          }
        })
      }
      
      set({ isPlaying: true, errorMessage: null })
      console.log('✅ [play] 播放命令已发送')
    } catch (error) {
      console.error('❌ [play] 同步异常:', error)
      set({ 
        isPlaying: false,
        errorMessage: `播放失败：${(error as Error).message}`
      })
    }
  },

  pause: () => {
    const { audioElement } = get()
    if (audioElement) {
      // ⭐ 关键修复：调用 pause() 时，会自动中止任何正在进行的 play() Promise
      // 这是正常的浏览器行为，不需要额外处理
      audioElement.pause()
      set({ isPlaying: false })
      console.log('⏸️ [pause] 暂停')
    }
  },

  togglePlayPause: () => {
    const { isPlaying, play, pause } = get()
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  },

  next: () => {
    console.log('⏭️ [next] 下一首')
    const { playlist, currentIndex, playTrack } = get()
    
    if (playlist.length === 0) {
      console.warn('⚠️ [next] 播放列表为空')
      return
    }
    
    const nextIndex = (currentIndex + 1) % playlist.length
    const nextTrack = playlist[nextIndex]
    
    console.log('⏭️ [next] 播放下一首:', {
      nextIndex,
      track: nextTrack.title,
      provider: nextTrack.provider
    })
    
    // ⭐ 关键：从队列获取 track，确保是本地音乐
    if (nextTrack.provider === 'local') {
      playTrack(nextTrack, nextIndex)
    } else {
      console.error('❌ [next] 队列中存在非本地音乐，跳过')
    }
  },

  prev: () => {
    console.log('⏮️ [prev] 上一首')
    const { playlist, currentIndex, playTrack } = get()
    
    if (playlist.length === 0) {
      console.warn('⚠️ [prev] 播放列表为空')
      return
    }
    
    const prevIndex = currentIndex - 1 < 0 ? playlist.length - 1 : currentIndex - 1
    const prevTrack = playlist[prevIndex]
    
    console.log('⏮️ [prev] 播放上一首:', {
      prevIndex,
      track: prevTrack.title,
      provider: prevTrack.provider
    })
    
    // ⭐ 关键：从队列获取 track，确保是本地音乐
    if (prevTrack.provider === 'local') {
      playTrack(prevTrack, prevIndex)
    } else {
      console.error('❌ [prev] 队列中存在非本地音乐，跳过')
    }
  },

  seek: (time) => {
    const { audioElement } = get()
    if (audioElement) {
      audioElement.currentTime = time
      set({ currentTime: time })
    }
  },

  setVolume: (volume) => {
    const { audioElement } = get()
    // ⭐ 限制范围 0-100
    const clampedVolume = Math.max(0, Math.min(100, volume))
    
    if (audioElement) {
      audioElement.volume = clampedVolume / 100 // audio.volume 是 0-1
      set({ volume: clampedVolume })
      
      // ⭐ 新增：持久化音量
      window.electronAPI.setVolume(clampedVolume).catch(err => {
        console.error('❌ [setVolume] 保存音量失败:', err)
      })
    }
  },

  setCurrentTime: (time) => set({ currentTime: time }),
  
  setDuration: (duration) => set({ duration }),
  
  setAudioElement: (audio) => set({ audioElement: audio }),
  
  clearError: () => set({ errorMessage: null }), // ⭐ 新增
  
  setShowLyricsOverlay: (show) => set({ showLyricsOverlay: show }), // ⭐ 新增：控制歌词 Overlay
  
  // ⭐ 更新：歌词显示选项（支持部分更新 + 持久化）
  setLyricsOptions: (options) => {
    const currentOptions = get().lyricsOptions
    const newOptions = { ...currentOptions, ...options }
    set({ lyricsOptions: newOptions })
    
    // ⭐ 持久化到 electron-store
    window.electronAPI.saveLyricsOptions(options).catch(err => {
      console.error('❌ [setLyricsOptions] 保存歌词选项失败:', err)
    })
  }
}))
