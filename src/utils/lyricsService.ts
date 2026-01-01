import { LyricsResult } from '../types/lyrics'
import { parseLRC, toPlainLines, isLRCFormat } from './lrcParser'

// ⭐ 内存缓存
const lyricsCache = new Map<string, LyricsResult>()

// ⭐ 竞态控制：当前正在请求的 requestId
let currentRequestId = 0

/**
 * 生成缓存 key
 */
function getCacheKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()} - ${title.toLowerCase().trim()}`
}

/**
 * 带 timeout 的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeout)
    return response
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

/**
 * 从 LRCLIB 获取歌词（优先，支持 LRC）
 * API: https://lrclib.net/api/get?artist_name=xxx&track_name=xxx
 */
async function fetchFromLRCLIB(
  artist: string,
  title: string
): Promise<LyricsResult | null> {
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    
    console.log('🔍 [LRCLIB] 请求歌词:', { artist, title, url })

    const response = await fetchWithTimeout(url)

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️ [LRCLIB] 未找到歌词 (404)')
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // LRCLIB 返回结构：{ syncedLyrics, plainLyrics, ... }
    const syncedLyrics = data.syncedLyrics // 带时间戳 LRC
    const plainLyrics = data.plainLyrics   // 纯文本

    // 优先使用 syncedLyrics
    if (syncedLyrics && typeof syncedLyrics === 'string' && syncedLyrics.trim()) {
      console.log('✅ [LRCLIB] 找到 LRC 歌词')
      const lines = parseLRC(syncedLyrics)
      return {
        type: 'lrc',
        source: 'lrclib',
        raw: syncedLyrics,
        lines,
        hasTimestamps: true
      }
    }

    // fallback 到 plainLyrics
    if (plainLyrics && typeof plainLyrics === 'string' && plainLyrics.trim()) {
      console.log('✅ [LRCLIB] 找到纯文本歌词')
      const lines = toPlainLines(plainLyrics)
      return {
        type: 'plain',
        source: 'lrclib',
        raw: plainLyrics,
        lines,
        hasTimestamps: false
      }
    }

    console.log('⚠️ [LRCLIB] 返回数据为空')
    return null
  } catch (error) {
    console.error('❌ [LRCLIB] 请求失败:', error)
    return null
  }
}

/**
 * 从 lyrics.ovh 获取歌词（fallback，纯文本）
 * API: https://api.lyrics.ovh/v1/{artist}/{title}
 */
async function fetchFromLyricsOvh(
  artist: string,
  title: string
): Promise<LyricsResult | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    
    console.log('🔍 [lyrics.ovh] 请求歌词:', { artist, title, url })

    const response = await fetchWithTimeout(url)

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️ [lyrics.ovh] 未找到歌词 (404)')
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.lyrics && typeof data.lyrics === 'string' && data.lyrics.trim()) {
      console.log('✅ [lyrics.ovh] 找到纯文本歌词')
      
      // 检测是否意外包含 LRC 格式
      const raw = data.lyrics.trim()
      if (isLRCFormat(raw)) {
        console.log('🎵 [lyrics.ovh] 检测到 LRC 格式')
        const lines = parseLRC(raw)
        return {
          type: 'lrc',
          source: 'lyrics.ovh',
          raw,
          lines,
          hasTimestamps: true
        }
      }

      // 纯文本
      const lines = toPlainLines(raw)
      return {
        type: 'plain',
        source: 'lyrics.ovh',
        raw,
        lines,
        hasTimestamps: false
      }
    }

    console.log('⚠️ [lyrics.ovh] 返回数据为空')
    return null
  } catch (error) {
    console.error('❌ [lyrics.ovh] 请求失败:', error)
    return null
  }
}

/**
 * 统一歌词获取入口
 * 
 * 策略：
 * 1. 检查缓存
 * 2. 尝试 LRCLIB（优先 LRC，fallback plain）
 * 3. 尝试 lyrics.ovh（纯文本）
 * 4. 返回 none
 * 
 * 包含竞态防护：只有最后一次请求能写入结果
 */
export async function fetchLyrics(
  artist: string,
  title: string
): Promise<LyricsResult> {
  // 生成请求 ID（竞态控制）
  const requestId = ++currentRequestId
  console.log(`🎵 [fetchLyrics] 开始请求 (ID: ${requestId}):`, { artist, title })

  // 1. 检查缓存
  const cacheKey = getCacheKey(artist, title)
  const cached = lyricsCache.get(cacheKey)
  if (cached) {
    console.log('💾 [fetchLyrics] 命中缓存:', cacheKey)
    return { ...cached, source: 'cache' }
  }

  // 2. 尝试 LRCLIB
  try {
    const lrclibResult = await fetchFromLRCLIB(artist, title)
    
    // ⭐ 竞态检查：如果不是最新请求，忽略结果
    if (requestId !== currentRequestId) {
      console.log(`⚠️ [fetchLyrics] 请求已过期 (ID: ${requestId}), 忽略`)
      // 返回 none，防止旧结果写入
      return {
        type: 'none',
        source: 'lrclib',
        hasTimestamps: false,
        error: 'Request cancelled'
      }
    }

    if (lrclibResult) {
      // 写入缓存
      lyricsCache.set(cacheKey, lrclibResult)
      return lrclibResult
    }
  } catch (error) {
    console.error('❌ [fetchLyrics] LRCLIB 失败:', error)
  }

  // 3. fallback 到 lyrics.ovh
  try {
    const ovhResult = await fetchFromLyricsOvh(artist, title)
    
    // ⭐ 竞态检查
    if (requestId !== currentRequestId) {
      console.log(`⚠️ [fetchLyrics] 请求已过期 (ID: ${requestId}), 忽略`)
      return {
        type: 'none',
        source: 'lyrics.ovh',
        hasTimestamps: false,
        error: 'Request cancelled'
      }
    }

    if (ovhResult) {
      // 写入缓存
      lyricsCache.set(cacheKey, ovhResult)
      return ovhResult
    }
  } catch (error) {
    console.error('❌ [fetchLyrics] lyrics.ovh 失败:', error)
  }

  // 4. 都失败，返回 none
  console.log('❌ [fetchLyrics] 所有来源都失败')
  const noneResult: LyricsResult = {
    type: 'none',
    source: 'lrclib',
    hasTimestamps: false,
    error: 'No lyrics found from any source'
  }
  
  // 缓存 none 结果（避免重复请求）
  lyricsCache.set(cacheKey, noneResult)
  return noneResult
}

/**
 * 清除缓存（可选，供外部调用）
 */
export function clearLyricsCache(): void {
  lyricsCache.clear()
  console.log('🗑️ [fetchLyrics] 缓存已清空')
}
