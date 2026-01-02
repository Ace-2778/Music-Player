/**
 * 歌词统一返回结构
 */
export interface LyricsResult {
  type: 'lrc' | 'plain' | 'none'
  source: 'lrclib' | 'lyrics.ovh' | 'netease' | 'kugou' | 'local-file' | 'cache' | 'none' | 'error'
  raw?: string // 原始歌词文本
  lines?: LyricsLine[]
  hasTimestamps: boolean // lrc=true, plain/none=false
  error?: string
}

/**
 * 歌词行结构
 */
export interface LyricsLine {
  timeMs?: number // 毫秒时间戳（仅 LRC 有）
  text: string     // 歌词文本
}
