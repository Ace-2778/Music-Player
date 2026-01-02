import { LyricsResult } from '../types/lyrics'
import { parseLRC, toPlainLines, isLRCFormat } from './lrcParser'
import { normalizeTrackInfo, NormalizedTrackInfo } from './normalizeTrackInfo'
import { buildSearchPlan, runSearchPlan, SearchStep } from './searchPlan'
import { selectBestCandidate } from './scoringSystem'
import type { Track } from '../store/playerStore'
import { searchFromNetEase } from './neteaseProvider'
import { searchFromKugou } from './kugouProvider'

/**
 * ⭐ 尝试从本地文件系统加载 LRC 文件
 * @param track - 音轨对象（必须包含 path）
 * @returns LyricsResult 或 null（未找到/解析失败）
 */
async function tryLoadLocalLrc(track: Track): Promise<LyricsResult | null> {
  // 只处理本地文件（包含完整路径）
  if (!track.path || !track.path.includes('/') && !track.path.includes('\\')) {
    return null
  }
  
  try {
    console.log('📂 [Local LRC] 尝试查找本地 LRC 文件:', track.path)
    
    const result = await window.electronAPI.readLocalLrc(track.path)
    
    if (!result.success || !result.content) {
      console.log('⚠️ [Local LRC] 未找到文件')
      return null
    }
    
    console.log('✅ [Local LRC] 找到文件:', result.path)
    
    // 尝试解析 LRC 格式
    const lrcLines = parseLRC(result.content)
    
    // 检查是否有时间戳
    const hasTimestamps = lrcLines.some(line => line.timeMs !== undefined)
    
    if (lrcLines.length > 0 && hasTimestamps) {
      console.log(`✨ [Local LRC] 成功解析！${lrcLines.length} 行，带时间戳`)
      return {
        type: 'lrc',
        source: 'local-file',
        raw: result.content,
        lines: lrcLines,
        hasTimestamps: true
      }
    } else {
      console.log('⚠️ [Local LRC] 解析失败或无时间戳')
      return null
    }
    
  } catch (error) {
    console.error('❌ [Local LRC] 加载失败:', error)
    return null
  }
}

/**
 * 歌词候选结果接口
 */
export interface LyricsCandidate {
  title: string
  artist?: string
  album?: string
  duration?: number
  syncedLyrics?: string
  plainLyrics?: string
  source: string
}

/**
 * 缓存策略：使用 trackId 作为主 key
 */
const lyricsCache = new Map<string, LyricsResult>()
const failedCache = new Set<string>()  // 失败缓存，避免重复请求

/**
 * 生成缓存 key
 */
function getCacheKey(track: Track): string {
  // 优先使用 trackId
  if (track.id) return `lyrics:${track.id}`
  
  // 降级使用 normalized 组合
  const normalized = normalizeTrackInfo(track)
  const parts = [
    normalized.artist || '',
    normalized.title || normalized.filename || '',
    normalized.album || ''
  ].filter(p => p).map(p => p.toLowerCase().trim())
  
  return `lyrics:${parts.join(':')}`
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
 * 从 LRCLIB 搜索歌词（返回候选列表）
 */
async function searchFromLRCLIB(
  artist?: string,
  title?: string,
  album?: string
): Promise<LyricsCandidate[]> {
  try {
    const params = new URLSearchParams()
    if (artist) params.append('artist_name', artist)
    if (title) params.append('track_name', title)
    if (album) params.append('album_name', album)
    
    if (params.toString().length === 0) {
      return []
    }
    
    const url = `https://lrclib.net/api/get?${params.toString()}`
    console.log('🔍 [LRCLIB] 请求:', { artist, title, album })

    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️ [LRCLIB] 404')
        return []
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    
    // 返回候选列表（当前只有1个）
    return [{
      title: data.trackName || data.name || title || '',
      artist: data.artistName || data.artist || artist || '',
      album: data.albumName || data.album || album || '',
      duration: data.duration,
      syncedLyrics: data.syncedLyrics,
      plainLyrics: data.plainLyrics,
      source: 'lrclib'
    }]
  } catch (error) {
    console.error('❌ [LRCLIB] 失败:', error)
    return []
  }
}

/**
 * 从 lyrics.ovh 搜索歌词（返回候选列表）
 */
async function searchFromLyricsOvh(
  artist?: string,
  title?: string
): Promise<LyricsCandidate[]> {
  try {
    if (!artist || !title) {
      return []
    }
    
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    console.log('🔍 [lyrics.ovh] 请求:', { artist, title })

    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️ [lyrics.ovh] 404')
        return []
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    
    if (data.lyrics && typeof data.lyrics === 'string' && data.lyrics.trim()) {
      const raw = data.lyrics.trim()
      
      return [{
        title: title || '',
        artist: artist || '',
        syncedLyrics: isLRCFormat(raw) ? raw : undefined,
        plainLyrics: isLRCFormat(raw) ? undefined : raw,
        source: 'lyrics.ovh'
      }]
    }
    
    return []
  } catch (error) {
    console.error('❌ [lyrics.ovh] 失败:', error)
    return []
  }
}

/**
 * 将候选结果转换为 LyricsResult
 */
function candidateToLyricsResult(candidate: LyricsCandidate): LyricsResult | null {
  // 优先 syncedLyrics
  if (candidate.syncedLyrics && candidate.syncedLyrics.trim()) {
    const lines = parseLRC(candidate.syncedLyrics)
    return {
      type: 'lrc',
      source: candidate.source as any, // ⭐ 支持任意 source
      raw: candidate.syncedLyrics,
      lines,
      hasTimestamps: true
    }
  }
  
  // fallback plainLyrics
  if (candidate.plainLyrics && candidate.plainLyrics.trim()) {
    const lines = toPlainLines(candidate.plainLyrics)
    return {
      type: 'plain',
      source: candidate.source as any, // ⭐ 支持任意 source
      raw: candidate.plainLyrics,
      lines,
      hasTimestamps: false
    }
  }
  
  return null
}

/**
 * ⭐ 统一的带时间戳歌词搜索接口
 * 并行调用所有 LRC Provider，合并去重后返回
 * @param query - 搜索参数
 * @returns 所有候选结果
 */
async function searchSyncedLyrics(query: {
  artist?: string
  title?: string
  album?: string
  keywords?: string
}): Promise<LyricsCandidate[]> {
  const artist = query.artist
  const title = query.title || query.keywords
  const album = query.album
  
  console.log('🔍 [Synced Lyrics] 并行搜索多个 Provider')
  
  // ⭐ 并行调用所有 Provider
  const results = await Promise.allSettled([
    searchFromLRCLIB(artist, title, album),
    searchFromNetEase(artist, title),
    searchFromKugou(artist, title),
    searchFromLyricsOvh(artist, title) // ⭐ 添加 lyrics.ovh 作为兜底
  ])
  
  // 合并所有成功的结果
  let allCandidates: LyricsCandidate[] = []
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled' && result.value.length > 0) {
      const providerName = ['LRCLIB', 'NetEase', 'Kugou', 'lyrics.ovh'][i]
      console.log(`  ✅ ${providerName}: ${result.value.length} 个候选`)
      allCandidates.push(...result.value)
    } else if (result.status === 'rejected') {
      const providerName = ['LRCLIB', 'NetEase', 'Kugou', 'lyrics.ovh'][i]
      console.log(`  ❌ ${providerName}: 失败`)
    }
  }
  
  // ⭐ 优先级：只要有带时间戳的候选，就过滤掉纯文本
  const syncedCandidates = allCandidates.filter(c => c.syncedLyrics && c.syncedLyrics.trim())
  if (syncedCandidates.length > 0) {
    console.log(`✨ [Synced Lyrics] 找到 ${syncedCandidates.length} 个带时间戳的候选，过滤纯文本`)
    return syncedCandidates
  }
  
  // 去重（根据 title + artist + source）
  const uniqueCandidates = Array.from(
    new Map(
      allCandidates.map(c => [
        `${c.title}:${c.artist}:${c.source}`,
        c
      ])
    ).values()
  )
  
  console.log(`🎯 [Synced Lyrics] 总计 ${uniqueCandidates.length} 个唯一候选`)
  return uniqueCandidates
}

/**
 * 创建歌词搜索函数（SearchPlan 适配器）
 */
function createLyricsSearchFn(normalized: NormalizedTrackInfo) {
  return async (step: SearchStep): Promise<LyricsResult | null> => {
    const { query } = step
    
    // ⭐ 使用统一的并行搜索接口
    const allCandidates = await searchSyncedLyrics(query)
    
    if (allCandidates.length === 0) {
      return null
    }
    
    // 如果只有一个候选，直接返回
    if (allCandidates.length === 1) {
      console.log('✅ [Lyrics] 找到1个候选，直接使用')
      return candidateToLyricsResult(allCandidates[0])
    }
    
    // 多个候选：使用评分系统选择最佳匹配
    console.log(`🎯 [Lyrics] 找到 ${allCandidates.length} 个候选，开始评分`)
    
    const bestMatch = selectBestCandidate(normalized, allCandidates, {
      titleWeight: 50,
      artistWeight: 30,
      albumWeight: 10,
      durationWeight: 10,
      threshold: 55,  // 歌词匹配阈值较宽松
      durationTolerance: 5
    })
    
    if (bestMatch) {
      console.log(`✅ [Lyrics] 评分选择: "${bestMatch.candidate.title}" (${bestMatch.score.score}分)`)
      return candidateToLyricsResult(bestMatch.candidate)
    }
    
    console.log('⚠️ [Lyrics] 所有候选均未达到阈值')
    return null
  }
}

/**
 * 统一歌词获取入口（SearchPlan 管线）
 * @param track - 完整音轨对象
 * @returns 歌词结果，失败返回 none 类型
 */
export async function resolveLyrics(track: Track): Promise<LyricsResult> {
  const cacheKey = getCacheKey(track)
  
  // 1. 检查缓存
  if (lyricsCache.has(cacheKey)) {
    console.log('💾 [resolveLyrics] 命中缓存')
    return lyricsCache.get(cacheKey)!
  }
  
  // 2. 检查失败缓存（避免重复请求）
  if (failedCache.has(cacheKey)) {
    console.log('⚠️ [resolveLyrics] 已知失败，跳过请求')
    return {
      type: 'none',
      source: 'cache',
      raw: '',
      lines: [],
      hasTimestamps: false
    }
  }
  
  // ⭐ 3. 优先级 0：尝试加载本地 LRC 文件（最高优先级）
  const localLrc = await tryLoadLocalLrc(track)
  if (localLrc) {
    console.log('✨ [resolveLyrics] 本地 LRC 命中！直接返回')
    lyricsCache.set(cacheKey, localLrc)
    return localLrc
  }
  
  console.log('\n🎵 [resolveLyrics] 开始智能搜索')
  console.log('   原始:', { artist: track.artist, title: track.title, album: track.album })
  
  try {
    // 3. 标准化信息
    const normalized = normalizeTrackInfo(track)
    console.log('   标准化:', { 
      artist: normalized.artist, 
      title: normalized.title,
      album: normalized.album,
      keywords: normalized.keywords.slice(0, 5)
    })
    
    // 4. 生成搜索计划
    const plan = buildSearchPlan(normalized)
    console.log(`   搜索步骤: ${plan.length}`)
    
    // 5. 执行搜索计划
    const searchFn = createLyricsSearchFn(normalized)
    const result = await runSearchPlan(plan, searchFn, {
      timeout: 8000,
      debug: true,
      stopOnFirstMatch: true
    })
    
    if (result.success && result.data) {
      console.log(`✅ [resolveLyrics] 成功！策略: ${result.step?.description}`)
      lyricsCache.set(cacheKey, result.data)
      return result.data
    }
    
    // 6. 所有策略失败：返回 none
    console.log('❌ [resolveLyrics] 所有策略失败')
    const noneResult: LyricsResult = {
      type: 'none',
      source: 'none',
      raw: '',
      lines: [],
      hasTimestamps: false
    }
    
    failedCache.add(cacheKey)
    lyricsCache.set(cacheKey, noneResult)
    return noneResult
    
  } catch (error) {
    console.error('❌ [resolveLyrics] 异常:', error)
    
    const noneResult: LyricsResult = {
      type: 'none',
      source: 'error',
      raw: '',
      lines: [],
      hasTimestamps: false
    }
    
    lyricsCache.set(cacheKey, noneResult)
    return noneResult
  }
}

/**
 * 清除歌词缓存
 */
export function clearLyricsCache(trackId?: string) {
  if (trackId) {
    const key = `lyrics:${trackId}`
    lyricsCache.delete(key)
    failedCache.delete(key)
    console.log(`🗑️ [Lyrics] 清除缓存: ${trackId}`)
  } else {
    lyricsCache.clear()
    failedCache.clear()
    console.log('🗑️ [Lyrics] 清除所有缓存')
  }
}

/**
 * 兼容旧接口：fetchLyricsForTrack
 * @deprecated 使用 resolveLyrics 代替
 */
export async function fetchLyricsForTrack(track: Track): Promise<LyricsResult> {
  return resolveLyrics(track)
}

/**
 * 兼容旧接口：fetchLyrics
 * @deprecated 使用 resolveLyrics 代替
 */
export async function fetchLyrics(artist: string, title: string): Promise<LyricsResult> {
  const track: Track = {
    id: `temp-${Date.now()}`,
    path: '',
    title,
    artist,
    album: '',
    duration: 0,
    provider: 'temp'
  }
  return resolveLyrics(track)
}
