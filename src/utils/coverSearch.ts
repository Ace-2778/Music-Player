import { normalizeTrackInfo, NormalizedTrackInfo } from './normalizeTrackInfo'
import { buildSearchPlan, runSearchPlan, SearchStep } from './searchPlan'
import { selectBestCandidate } from './scoringSystem'
import type { Track } from '../store/playerStore'

/**
 * 封面候选结果接口
 */
interface CoverCandidate {
  title: string
  artist?: string
  album?: string
  duration?: number
  artworkUrl: string
  source: string
}

/**
 * 专辑候选结果接口
 */
interface AlbumCandidate {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl: string
  trackCount?: number
  releaseDate?: string
}

/**
 * 封面结果接口
 */
export interface CoverResult {
  url: string | null
  source: string
}

/**
 * 缓存策略：使用 trackId 作为主 key
 */
const coverCache = new Map<string, CoverResult>()

// 失败缓存带 TTL（10分钟）
const failedCache = new Map<string, number>()
const FAILED_CACHE_TTL = 10 * 60 * 1000  // 10 分钟

// 开发模式禁用失败缓存
const isDev = process.env.NODE_ENV === 'development'

/**
 * 生成缓存 key
 */
function getCacheKey(track: Track): string {
  // 优先使用 trackId
  if (track.id) return `cover:${track.id}`
  
  // 降级使用 normalized 组合
  const normalized = normalizeTrackInfo(track)
  const parts = [
    normalized.artist || '',
    normalized.title || normalized.filename || '',
    normalized.album || ''
  ].filter(p => p).map(p => p.toLowerCase().trim())
  
  return `cover:${parts.join(':')}`
}

/**
 * 检查失败缓存（带 TTL）
 */
function isInFailedCache(key: string): boolean {
  if (isDev) return false  // 开发模式禁用
  
  const timestamp = failedCache.get(key)
  if (!timestamp) return false
  
  const now = Date.now()
  if (now - timestamp > FAILED_CACHE_TTL) {
    failedCache.delete(key)  // 过期删除
    return false
  }
  
  return true
}

/**
 * 清理关键词（针对 iTunes 优化）
 */
function cleanKeywordsForItunes(str: string): string {
  return str
    .replace(/[\(\（\[【].*?[\)\）\]】]/g, '')  // 去括号
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*/gi, '')  // 去 feat
    .replace(/\b(remastered?|official|audio|lyrics|video|hd|hq|explicit|deluxe)\b/gi, '')  // 去噪音
    .replace(/[_\-]+/g, ' ')  // 统一符号
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 提升封面 URL 质量（正则替换尺寸）
 */
function upgradeCoverUrl(url: string): string {
  if (!url) return url
  
  // 使用正则替换尺寸：100x100 → 600x600
  const upgraded = url.replace(/\d+x\d+/g, '600x600')
  
  console.log(`🖼️ [Cover] 提升质量: ${url.match(/\d+x\d+/)?.[0]} → 600x600`)
  
  return upgraded
}

/**
 * 从 iTunes 搜索专辑（entity=album）
 */
async function searchAlbumsFromItunes(
  artist: string,
  album: string,
  limit = 10
): Promise<AlbumCandidate[]> {
  try {
    const cleanArtist = cleanKeywordsForItunes(artist)
    const cleanAlbum = cleanKeywordsForItunes(album)
    const keywords = `${cleanArtist} ${cleanAlbum}`.trim()
    
    if (!keywords) return []
    
    console.log(`🔍 [iTunes Album] 搜索: "${keywords}"`)
    
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(keywords)}&media=music&entity=album&limit=${limit}`
    
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`❌ [iTunes Album] HTTP ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      console.log('⚠️ [iTunes Album] 无结果')
      return []
    }
    
    const albums: AlbumCandidate[] = data.results.map((result: any) => ({
      collectionId: result.collectionId,
      collectionName: result.collectionName || '',
      artistName: result.artistName || '',
      artworkUrl: result.artworkUrl100 || result.artworkUrl60 || '',
      trackCount: result.trackCount,
      releaseDate: result.releaseDate
    }))
    
    console.log(`✅ [iTunes Album] 找到 ${albums.length} 个专辑`)
    return albums
  } catch (error) {
    console.error('❌ [iTunes Album] 失败:', error)
    return []
  }
}

/**
 * 从 iTunes 搜索单曲（entity=song）
 */
async function searchSongsFromItunes(
  keywords: string,
  limit = 10
): Promise<CoverCandidate[]> {
  try {
    const cleanKeywords = cleanKeywordsForItunes(keywords)
    
    if (!cleanKeywords) return []
    
    console.log(`🔍 [iTunes Song] 搜索: "${cleanKeywords}"`)
    
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanKeywords)}&media=music&entity=song&limit=${limit}`
    
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`❌ [iTunes Song] HTTP ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      console.log('⚠️ [iTunes Song] 无结果')
      return []
    }
    
    const songs: CoverCandidate[] = data.results.map((result: any) => ({
      title: result.trackName || '',
      artist: result.artistName || '',
      album: result.collectionName || '',
      duration: result.trackTimeMillis ? Math.round(result.trackTimeMillis / 1000) : undefined,
      artworkUrl: result.artworkUrl100 || result.artworkUrl60 || '',
      source: 'itunes-song'
    }))
    
    console.log(`✅ [iTunes Song] 找到 ${songs.length} 个单曲`)
    return songs
  } catch (error) {
    console.error('❌ [iTunes Song] 失败:', error)
    return []
  }
}

/**
 * 获取专辑的曲目列表
 */
async function getAlbumTracks(collectionId: number): Promise<CoverCandidate[]> {
  try {
    console.log(`🔍 [iTunes Tracks] 获取专辑曲目: ${collectionId}`)
    
    const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`
    
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`❌ [iTunes Tracks] HTTP ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return []
    }
    
    // 第一个结果是专辑信息，跳过
    const tracks: CoverCandidate[] = data.results.slice(1).map((result: any) => ({
      title: result.trackName || '',
      artist: result.artistName || '',
      album: result.collectionName || '',
      duration: result.trackTimeMillis ? Math.round(result.trackTimeMillis / 1000) : undefined,
      artworkUrl: result.artworkUrl100 || result.artworkUrl60 || '',
      source: 'itunes-album-track'
    }))
    
    console.log(`✅ [iTunes Tracks] 找到 ${tracks.length} 首曲目`)
    return tracks
  } catch (error) {
    console.error('❌ [iTunes Tracks] 失败:', error)
    return []
  }
}

/**
 * 专辑优先 + 单曲兜底搜索策略
 */
async function searchWithAlbumPriority(
  artist?: string,
  title?: string,
  album?: string
): Promise<CoverCandidate[]> {
  let allCandidates: CoverCandidate[] = []
  
  // 1. 优先搜索专辑（如果有 album 信息）
  if (artist && album) {
    const albums = await searchAlbumsFromItunes(artist, album, 10)
    
    if (albums.length > 0) {
      console.log('🎯 [Cover] 专辑优先策略命中')
      
      // 将专辑转换为候选结果
      const albumCandidates: CoverCandidate[] = albums.map(a => ({
        title: title || '',
        artist: a.artistName,
        album: a.collectionName,
        artworkUrl: a.artworkUrl,
        source: 'itunes-album'
      }))
      
      allCandidates.push(...albumCandidates)
    }
  }
  
  // 2. 兜底：搜索单曲
  if (artist && title) {
    const keywords = `${artist} ${title}`
    const songs = await searchSongsFromItunes(keywords, 10)
    allCandidates.push(...songs)
  }
  
  return allCandidates
}

/**
 * 创建封面搜索函数（SearchPlan 适配器）
 */
function createCoverSearchFn(normalized: NormalizedTrackInfo) {
  return async (step: SearchStep): Promise<CoverResult | null> => {
    const { type, query } = step
    
    console.log(`\n▶️ [Cover Search] ${step.description}`)
    console.log(`   类型: ${type}, 查询:`, query)
    
    // ===== albumTracks 策略 =====
    if (type === 'albumTracks') {
      const { artist, album, title } = query
      
      if (!artist || !album || !title) {
        console.log('⚠️ [albumTracks] 缺少必要参数')
        return null
      }
      
      console.log(`🎵 [albumTracks] 专辑曲目匹配策略`)
      
      // 1. 搜索最匹配的专辑
      const albums = await searchAlbumsFromItunes(artist, album, 10)
      
      if (albums.length === 0) {
        console.log('❌ [albumTracks] 未找到专辑')
        return null
      }
      
      // 2. 选择最佳专辑（使用评分系统）
      const albumCandidatesForScoring = albums.map(a => ({
        title: a.collectionName,
        artist: a.artistName,
        album: a.collectionName,
        artworkUrl: a.artworkUrl,
        source: 'itunes-album'
      }))
      
      const bestAlbum = selectBestCandidate(
        { ...normalized, title: album },  // 用 album 作为 title 来匹配
        albumCandidatesForScoring,
        {
          titleWeight: 40,   // album 名称匹配
          artistWeight: 50,  // artist 最重要
          threshold: 50      // 阈值降低
        }
      )
      
      if (!bestAlbum) {
        console.log('❌ [albumTracks] 未找到匹配的专辑')
        return null
      }
      
      console.log(`✅ [albumTracks] 选中专辑: "${bestAlbum.candidate.album}" - ${bestAlbum.candidate.artist}`)
      
      // 3. 获取专辑曲目列表
      const albumIndex = albums.findIndex(a => a.collectionName === bestAlbum.candidate.album)
      const selectedAlbum = albums[albumIndex]
      
      const tracks = await getAlbumTracks(selectedAlbum.collectionId)
      
      if (tracks.length === 0) {
        console.log('⚠️ [albumTracks] 专辑曲目为空，使用专辑封面')
        const coverUrl = upgradeCoverUrl(selectedAlbum.artworkUrl)
        return { url: coverUrl, source: 'itunes-album-direct' }
      }
      
      // 4. 在曲目列表中匹配 title
      console.log(`🔍 [albumTracks] 在 ${tracks.length} 首曲目中匹配: "${title}"`)
      
      const matchedTrack = selectBestCandidate(
        normalized,
        tracks,
        {
          titleWeight: 70,   // title 最重要
          artistWeight: 10,  // 专辑内 artist 相同
          durationWeight: 15,
          threshold: 55      // 曲目匹配阈值
        }
      )
      
      if (matchedTrack) {
        console.log(`✅ [albumTracks] 匹配曲目: "${matchedTrack.candidate.title}" (${matchedTrack.score.score}分)`)
        const coverUrl = upgradeCoverUrl(matchedTrack.candidate.artworkUrl)
        return { url: coverUrl, source: 'itunes-album-track' }
      }
      
      // 5. 未匹配到具体曲目，使用专辑封面
      console.log('⚠️ [albumTracks] 未匹配到曲目，使用专辑封面')
      const coverUrl = upgradeCoverUrl(selectedAlbum.artworkUrl)
      return { url: coverUrl, source: 'itunes-album-fallback' }
    }
    
    // ===== trackSearch 策略（多级降级）=====
    if (type === 'trackSearch') {
      let allCandidates: CoverCandidate[] = []
      
      // 构建多级查询
      const queries: string[] = []
      
      if (query.artist && query.title) {
        queries.push(`${query.artist} ${query.title}`)       // artist + title
        queries.push(`${query.title} ${query.artist}`)       // title + artist (反转)
      }
      
      if (query.album && query.title) {
        queries.push(`${query.album} ${query.title}`)        // album + title
      }
      
      if (query.title) {
        queries.push(query.title)                            // title 单独
      }
      
      if (query.keywords) {
        const topKeywords = query.keywords.split(' ').slice(0, 3).join(' ')
        queries.push(topKeywords)                            // 前3个关键词
      }
      
      console.log(`🔍 [trackSearch] 多级降级查询: ${queries.length} 级`)
      
      // 依次尝试每级查询（使用专辑优先策略）
      for (let i = 0; i < queries.length && allCandidates.length < 5; i++) {
        console.log(`   级别${i + 1}: "${queries[i]}"`)
        
        const candidates = await searchWithAlbumPriority(
          query.artist,
          query.title,
          query.album
        )
        
        if (candidates.length > 0) {
          allCandidates.push(...candidates)
          console.log(`   ✅ 找到 ${candidates.length} 个候选`)
          break  // 找到就停止
        }
      }
      
      if (allCandidates.length === 0) {
        console.log('❌ [trackSearch] 所有级别均未找到结果')
        return null
      }
      
      // 去重
      const uniqueCandidates = Array.from(
        new Map(allCandidates.map(c => [c.artworkUrl, c])).values()
      )
      
      console.log(`🎯 [trackSearch] 收集到 ${uniqueCandidates.length} 个唯一候选`)
      
      // 单个候选：直接使用
      if (uniqueCandidates.length === 1) {
        console.log('✅ [trackSearch] 单个候选，直接使用')
        const coverUrl = upgradeCoverUrl(uniqueCandidates[0].artworkUrl)
        return { url: coverUrl, source: uniqueCandidates[0].source }
      }
      
      // 多个候选：评分选择（阈值降低）
      const bestMatch = selectBestCandidate(normalized, uniqueCandidates, {
        titleWeight: 50,
        artistWeight: 35,
        albumWeight: 10,
        durationWeight: 5,
        threshold: 50,  // 降低阈值
        durationTolerance: 5
      })
      
      if (bestMatch) {
        console.log(`✅ [trackSearch] 评分选择: "${bestMatch.candidate.title}" (${bestMatch.score.score}分)`)
        const coverUrl = upgradeCoverUrl(bestMatch.candidate.artworkUrl)
        return { url: coverUrl, source: bestMatch.candidate.source }
      }
      
      // 未达阈值：选择最高分候选（低置信度）
      console.log('⚠️ [trackSearch] 未达阈值，选择最高分候选（低置信度）')
      
      let maxScore = 0
      let maxCandidate: CoverCandidate | null = null
      
      for (const candidate of uniqueCandidates) {
        const score = selectBestCandidate(normalized, [candidate], { threshold: 0 })
        if (score && score.score.score > maxScore) {
          maxScore = score.score.score
          maxCandidate = candidate
        }
      }
      
      if (maxCandidate) {
        console.log(`✅ [trackSearch] 低置信度匹配: "${maxCandidate.title}" (${maxScore}分)`)
        const coverUrl = upgradeCoverUrl(maxCandidate.artworkUrl)
        return { url: coverUrl, source: 'itunes-lowconf' }
      }
    }
    
    return null
  }
}

/**
 * 统一封面获取入口（SearchPlan 管线）
 * @param track - 完整音轨对象
 * @returns 封面结果，失败返回 null url
 */
export async function resolveCover(track: Track): Promise<CoverResult> {
  const cacheKey = getCacheKey(track)
  
  // 1. 检查缓存
  if (coverCache.has(cacheKey)) {
    console.log('💾 [resolveCover] 命中缓存')
    return coverCache.get(cacheKey)!
  }
  
  // 2. 检查失败缓存（带 TTL）
  if (isInFailedCache(cacheKey)) {
    console.log('⚠️ [resolveCover] 命中失败缓存（TTL 未过期）')
    return { url: null, source: 'failed-cache' }
  }
  
  console.log('\n🖼️ [resolveCover] 开始智能搜索')
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
    const searchFn = createCoverSearchFn(normalized)
    const result = await runSearchPlan(plan, searchFn, {
      timeout: 10000,  // 封面搜索超时 10 秒
      debug: isDev,
      stopOnFirstMatch: true
    })
    
    if (result.success && result.data && result.data.url) {
      console.log(`✅ [resolveCover] 成功！策略: ${result.step?.description}`)
      console.log(`   封面来源: ${result.data.source}`)
      coverCache.set(cacheKey, result.data)
      return result.data
    }
    
    // 6. 所有策略失败：返回 null
    console.log('❌ [resolveCover] 所有策略失败')
    const noneResult: CoverResult = { url: null, source: 'none' }
    
    if (!isDev) {
      failedCache.set(cacheKey, Date.now())  // 记录失败时间戳
    }
    
    coverCache.set(cacheKey, noneResult)
    return noneResult
    
  } catch (error) {
    console.error('❌ [resolveCover] 异常:', error)
    
    const noneResult: CoverResult = { url: null, source: 'error' }
    coverCache.set(cacheKey, noneResult)
    return noneResult
  }
}

/**
 * 清除封面缓存
 */
export function clearCoverCache(trackId?: string) {
  if (trackId) {
    const key = `cover:${trackId}`
    coverCache.delete(key)
    failedCache.delete(key)
    console.log(`🗑️ [Cover] 清除缓存: ${trackId}`)
  } else {
    coverCache.clear()
    failedCache.clear()
    console.log('🗑️ [Cover] 清除所有缓存')
  }
}

/**
 * 兼容旧接口：fetchCoverForTrack
 * @deprecated 使用 resolveCover 代替
 */
export async function fetchCoverForTrack(track: Track): Promise<string | null> {
  const result = await resolveCover(track)
  return result.url
}

/**
 * 兼容旧接口：fetchCoverFromInternet
 * @deprecated 使用 resolveCover 代替
 */
export async function fetchCoverFromInternet(
  title: string, 
  artist: string
): Promise<string | null> {
  const track: Track = {
    id: `temp-${Date.now()}`,
    path: '',
    title,
    artist,
    album: '',
    duration: 0,
    provider: 'temp'
  }
  const result = await resolveCover(track)
  return result.url
}
