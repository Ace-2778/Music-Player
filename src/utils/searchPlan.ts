/**
 * 多策略搜索流程模块
 * 用于歌词/封面获取的智能搜索策略
 */

import { NormalizedTrackInfo, buildSearchQuery } from './normalizeTrackInfo'
import { ScoringConfig } from './scoringSystem'

/**
 * 搜索步骤类型
 */
export type SearchStepType = 'albumTracks' | 'trackSearch'

/**
 * 搜索查询参数
 */
export interface SearchQuery {
  artist?: string
  album?: string
  title?: string
  keywords?: string
}

/**
 * 搜索步骤定义
 */
export interface SearchStep {
  type: SearchStepType
  query: SearchQuery
  description: string
  priority: number
}

/**
 * 搜索计划
 */
export type SearchPlan = SearchStep[]

/**
 * 搜索结果
 */
export interface SearchResult<T = any> {
  success: boolean
  data?: T
  score?: number
  step?: SearchStep
  error?: string
}

/**
 * 搜索执行器配置
 */
export interface SearchExecutorConfig {
  timeout?: number        // 单步超时时间（毫秒），默认 8000
  debug?: boolean         // 是否开启调试输出，默认 false
  stopOnFirstMatch?: boolean  // 是否找到第一个结果就停止，默认 true
  scoringConfig?: Partial<ScoringConfig>  // 评分系统配置
}

/**
 * 模糊匹配标题（用于专辑曲目列表匹配）
 * @param trackTitle - 专辑曲目中的标题
 * @param targetTitle - 目标标题
 * @returns 匹配分数（0-1），0 表示不匹配，1 表示完全匹配
 */
export function fuzzyMatchTitle(trackTitle: string, targetTitle: string): number {
  if (!trackTitle || !targetTitle) return 0
  
  const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ')
  
  const track = normalize(trackTitle)
  const target = normalize(targetTitle)
  
  // 完全匹配
  if (track === target) return 1.0
  
  // 包含匹配
  if (track.includes(target) || target.includes(track)) return 0.9
  
  // 计算 Levenshtein 距离
  const distance = levenshteinDistance(track, target)
  const maxLen = Math.max(track.length, target.length)
  
  // 相似度 = 1 - (距离 / 最大长度)
  const similarity = 1 - distance / maxLen
  
  // 设置阈值：相似度 >= 0.7 才认为匹配
  return similarity >= 0.7 ? similarity : 0
}

/**
 * Levenshtein 距离算法（编辑距离）
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = []
  
  // 初始化
  for (let i = 0; i <= m; i++) {
    dp[i] = [i]
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }
  
  // 动态规划
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        )
      }
    }
  }
  
  return dp[m][n]
}

/**
 * 生成搜索计划
 * @param normalizedInfo - 标准化后的音轨信息
 * @returns 搜索步骤数组（按优先级排序）
 */
export function buildSearchPlan(normalizedInfo: NormalizedTrackInfo): SearchPlan {
  const plan: SearchPlan = []
  let priority = 1
  
  const { artist, album, title, keywords, filename, titleQualifiers } = normalizedInfo
  
  // ⭐ 生成包含 qualifiers 的完整标题（用于精确搜索）
  const titleWithQualifiers = title && titleQualifiers && titleQualifiers.length > 0
    ? buildSearchQuery(normalizedInfo, 'artist-title', true).replace(artist || '', '').trim()
    : title
  
  // ========== 优先级 A: artist + album + title（专辑曲目搜索）==========
  if (artist && album && title) {
    plan.push({
      type: 'albumTracks',
      query: {
        artist,
        album,
        title: titleWithQualifiers // ⭐ 使用包含 qualifiers 的标题
      },
      description: `搜索专辑曲目列表: ${artist} - ${album}，然后匹配 "${titleWithQualifiers}"`,
      priority: priority++
    })
  }
  
  // ========== 优先级 B: artist + title（直接搜索）==========
  if (artist && title) {
    // B1: 使用包含 qualifiers 的完整查询（优先）
    if (titleQualifiers && titleQualifiers.length > 0) {
      const fullQuery = buildSearchQuery(normalizedInfo, 'artist-title', true)
      plan.push({
        type: 'trackSearch',
        query: {
          artist,
          title: titleWithQualifiers
        },
        description: `精确搜索（含版本信息）: ${fullQuery}`,
        priority: priority++
      })
    }
    
    // B2: 使用核心标题（兜底）
    plan.push({
      type: 'trackSearch',
      query: {
        artist,
        title
      },
      description: `精确搜索: ${artist} - ${title}`,
      priority: priority++
    })
  }
  
  // ========== 优先级 C: album + title（直接搜索）==========
  if (album && title) {
    plan.push({
      type: 'trackSearch',
      query: {
        album,
        title
      },
      description: `专辑+标题搜索: ${album} - ${title}`,
      priority: priority++
    })
  }
  
  // ========== 优先级 D: metadata 不全，使用兜底策略 ==========
  
  // D1: 如果只有 title（可能从文件名解析）
  if (title && !artist && !album) {
    plan.push({
      type: 'trackSearch',
      query: {
        title
      },
      description: `标题搜索: ${title}`,
      priority: priority++
    })
  }
  
  // D2: 使用 filename（如果与 title 不同）
  if (filename && filename !== title) {
    plan.push({
      type: 'trackSearch',
      query: {
        keywords: filename
      },
      description: `文件名搜索: ${filename}`,
      priority: priority++
    })
  }
  
  // D3: 使用前 5 个关键词组合
  if (keywords && keywords.length > 0) {
    const topKeywords = keywords.slice(0, 5).join(' ')
    plan.push({
      type: 'trackSearch',
      query: {
        keywords: topKeywords
      },
      description: `关键词搜索: ${topKeywords}`,
      priority: priority++
    })
  }
  
  // D4: 使用前 3 个关键词（进一步兜底）
  if (keywords && keywords.length >= 3) {
    const top3Keywords = keywords.slice(0, 3).join(' ')
    // 避免重复（与 D3 相同）
    const top5 = keywords.slice(0, 5).join(' ')
    if (top3Keywords !== top5) {
      plan.push({
        type: 'trackSearch',
        query: {
          keywords: top3Keywords
        },
        description: `关键词搜索（前3个）: ${top3Keywords}`,
        priority: priority++
      })
    }
  }
  
  return plan
}

/**
 * 搜索计划执行器
 * @param plan - 搜索计划
 * @param searchFn - 搜索函数（由调用方提供具体实现）
 * @param config - 执行器配置
 * @returns 搜索结果
 */
export async function runSearchPlan<T>(
  plan: SearchPlan,
  searchFn: (step: SearchStep) => Promise<T | null>,
  config: SearchExecutorConfig = {}
): Promise<SearchResult<T>> {
  const {
    timeout = 8000,
    debug = false,
    stopOnFirstMatch = true
  } = config
  
  if (plan.length === 0) {
    if (debug) {
      console.log('⚠️ [SearchPlan] 搜索计划为空')
    }
    return {
      success: false,
      error: '搜索计划为空'
    }
  }
  
  if (debug) {
    console.log(`🔍 [SearchPlan] 开始执行搜索计划，共 ${plan.length} 步`)
    console.table(plan.map(step => ({
      优先级: step.priority,
      类型: step.type,
      描述: step.description
    })))
  }
  
  // 按优先级执行
  for (const step of plan) {
    if (debug) {
      console.log(`\n▶️ [SearchPlan] Step ${step.priority}: ${step.description}`)
      console.log('   查询参数:', step.query)
    }
    
    try {
      // 带超时的搜索
      const result = await Promise.race([
        searchFn(step),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), timeout)
        )
      ])
      
      if (result !== null && result !== undefined) {
        // 命中
        if (debug) {
          console.log(`✅ [SearchPlan] Step ${step.priority} 命中！`)
          console.log('   结果:', result)
        }
        
        return {
          success: true,
          data: result,
          score: 1.0,
          step
        }
      } else {
        // 未命中
        if (debug) {
          console.log(`❌ [SearchPlan] Step ${step.priority} 未命中`)
        }
      }
    } catch (error) {
      // 超时或错误
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (debug) {
        console.log(`⚠️ [SearchPlan] Step ${step.priority} 失败: ${errorMsg}`)
      }
      
      // 继续下一步（不阻塞）
      continue
    }
  }
  
  // 所有步骤都失败
  if (debug) {
    console.log('\n❌ [SearchPlan] 所有搜索步骤均未命中')
  }
  
  return {
    success: false,
    error: '所有搜索策略均未找到结果'
  }
}

/**
 * 专辑曲目搜索结果接口（由具体 API 实现）
 */
export interface AlbumTracksResult {
  tracks: Array<{
    title: string
    artist?: string
    trackNumber?: number
    duration?: number
    [key: string]: any
  }>
}

/**
 * 在专辑曲目列表中模糊匹配目标标题
 * 注意：此函数已弃用，请使用 scoringSystem.ts 中的 findBestMatchInAlbum
 * @deprecated 使用 findBestMatchWithScoring 代替
 */
export function findBestMatchInAlbum<T extends { title: string }>(
  albumTracks: T[],
  targetTitle: string
): { track: T; score: number } | null {
  console.warn('[Deprecated] findBestMatchInAlbum 已弃用，请使用 scoringSystem.findBestMatchInAlbum')
  
  if (!albumTracks || albumTracks.length === 0) return null
  
  let bestMatch: T | null = null
  let bestScore = 0
  
  for (const track of albumTracks) {
    const score = fuzzyMatchTitle(track.title, targetTitle)
    if (score > bestScore) {
      bestScore = score
      bestMatch = track
    }
  }
  
  // 只返回分数 >= 0.7 的匹配
  if (bestMatch && bestScore >= 0.7) {
    return { track: bestMatch, score: bestScore }
  }
  
  return null
}

/**
 * 便捷函数：为 LRCLIB/lyrics.ovh 等歌词 API 创建搜索函数
 * @param api - API 实例（需要实现 searchByArtistTitle, searchByAlbumTitle, searchAlbum 方法）
 * @returns 搜索函数
 */
export function createLyricsSearchFn(api: any) {
  return async (step: SearchStep): Promise<any> => {
    const { type, query } = step
    
    if (type === 'albumTracks') {
      // 专辑曲目搜索
      if (!query.artist || !query.album || !query.title) return null
      
      try {
        // 1. 搜索专辑曲目列表
        const albumData = await api.searchAlbum(query.artist, query.album)
        if (!albumData || !albumData.tracks || albumData.tracks.length === 0) {
          return null
        }
        
        // 2. 在曲目列表中模糊匹配 title
        const match = findBestMatchInAlbum(albumData.tracks, query.title)
        if (!match) return null
        
        // 3. 返回匹配到的曲目数据
        return match.track
      } catch (error) {
        return null
      }
    } else if (type === 'trackSearch') {
      // 直接搜索
      try {
        if (query.artist && query.title) {
          return await api.searchByArtistTitle(query.artist, query.title)
        } else if (query.album && query.title) {
          return await api.searchByAlbumTitle(query.album, query.title)
        } else if (query.title) {
          return await api.searchByTitle(query.title)
        } else if (query.keywords) {
          return await api.searchByKeywords(query.keywords)
        }
        return null
      } catch (error) {
        return null
      }
    }
    
    return null
  }
}

/**
 * 示例：如何使用搜索计划
 */
export const SEARCH_PLAN_EXAMPLE = `
// 1. 标准化音轨信息
import { normalizeTrackInfo } from './normalizeTrackInfo'
import { buildSearchPlan, runSearchPlan, createLyricsSearchFn } from './searchPlan'

const track = { ... }
const normalized = normalizeTrackInfo(track)

// 2. 生成搜索计划
const plan = buildSearchPlan(normalized)

// 3. 执行搜索
const searchFn = createLyricsSearchFn(lrclibAPI)
const result = await runSearchPlan(plan, searchFn, {
  timeout: 8000,
  debug: true,  // 开发模式开启调试
  stopOnFirstMatch: true
})

if (result.success) {
  console.log('找到歌词:', result.data)
  console.log('使用策略:', result.step.description)
} else {
  console.log('未找到歌词:', result.error)
}
`
