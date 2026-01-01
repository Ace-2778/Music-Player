/**
 * 歌词/封面检索结果的模糊匹配与打分系统
 * 用于从候选结果中选择最佳匹配项
 */

import { NormalizedTrackInfo } from './normalizeTrackInfo'

/**
 * 候选结果接口
 */
export interface Candidate {
  title: string
  artist?: string
  album?: string
  duration?: number  // 秒
  [key: string]: any // 其他字段
}

/**
 * 评分结果
 */
export interface ScoreResult {
  score: number           // 总分 0-100
  breakdown: {            // 分项得分
    title: number         // title 得分 0-50
    artist: number        // artist 得分 0-30
    album: number         // album 得分 0-10
    duration: number      // duration 得分 0-10
  }
  matched: boolean        // 是否达到阈值
}

/**
 * 评分配置
 */
export interface ScoringConfig {
  titleWeight: number      // title 权重（默认 50）
  artistWeight: number     // artist 权重（默认 30）
  albumWeight: number      // album 权重（默认 10）
  durationWeight: number   // duration 权重（默认 10）
  threshold: number        // 匹配阈值（默认 60）
  durationTolerance: number // 时长容差秒数（默认 3）
}

/**
 * 默认评分配置
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  titleWeight: 50,
  artistWeight: 30,
  albumWeight: 10,
  durationWeight: 10,
  threshold: 60,
  durationTolerance: 3
}

/**
 * 标准化字符串（用于比较）
 * - 去除所有空格、标点、特殊字符
 * - 转小写
 * - 去除常见噪音词
 */
function normalizeForComparison(str: string): string {
  if (!str) return ''
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s\-_.,;:!?'"()[\]{}]/g, '') // 去除所有标点和空格
    .replace(/\b(official|video|audio|lyrics|hd|hq|remastered?|live|version|edit|mix|feat\.?|ft\.?)\b/gi, '')
}

/**
 * Token overlap 相似度
 * 计算两个字符串中相同 token 的比例
 */
function tokenOverlapSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  
  const normalize = (s: string) => s.toLowerCase().trim()
  
  const tokens1 = new Set(normalize(str1).split(/\s+/).filter(t => t.length >= 2))
  const tokens2 = new Set(normalize(str2).split(/\s+/).filter(t => t.length >= 2))
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0
  
  // 计算交集
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)))
  
  // Jaccard 相似度：交集 / 并集
  const union = new Set([...tokens1, ...tokens2])
  return intersection.size / union.size
}

/**
 * Levenshtein 距离（编辑距离）
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = []
  
  for (let i = 0; i <= m; i++) {
    dp[i] = [i]
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        )
      }
    }
  }
  
  return dp[m][n]
}

/**
 * 字符串相似度（综合算法）
 * @returns 0-1 之间的相似度
 */
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  
  // 完全相同
  if (str1 === str2) return 1.0
  
  // 标准化后比较
  const norm1 = normalizeForComparison(str1)
  const norm2 = normalizeForComparison(str2)
  
  if (norm1 === norm2) return 0.98
  
  // 包含关系
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9
  
  // Token overlap（权重 40%）
  const tokenScore = tokenOverlapSimilarity(str1, str2)
  
  // Levenshtein 相似度（权重 60%）
  const distance = levenshteinDistance(norm1, norm2)
  const maxLen = Math.max(norm1.length, norm2.length)
  const levenScore = maxLen > 0 ? 1 - distance / maxLen : 0
  
  // 综合得分
  return tokenScore * 0.4 + levenScore * 0.6
}

/**
 * 时长相似度
 * @param duration1 - 时长1（秒）
 * @param duration2 - 时长2（秒）
 * @param tolerance - 容差（秒）
 * @returns 0-1 之间的相似度
 */
function durationSimilarity(
  duration1: number | undefined,
  duration2: number | undefined,
  tolerance: number
): number {
  if (!duration1 || !duration2) return 0
  
  const diff = Math.abs(duration1 - duration2)
  
  // 完全相同
  if (diff === 0) return 1.0
  
  // 在容差范围内
  if (diff <= tolerance) {
    // 线性衰减：0秒差异=1.0, tolerance秒差异=0.5
    return 1.0 - (diff / tolerance) * 0.5
  }
  
  // 超出容差但在2倍容差内
  if (diff <= tolerance * 2) {
    // 继续衰减：tolerance=0.5, 2*tolerance=0.2
    return 0.5 - ((diff - tolerance) / tolerance) * 0.3
  }
  
  // 差异太大
  return 0
}

/**
 * 评分候选结果
 * @param normalizedInfo - 标准化后的音轨信息
 * @param candidate - 候选结果
 * @param config - 评分配置（可选）
 * @returns 评分结果
 */
export function scoreCandidate(
  normalizedInfo: NormalizedTrackInfo,
  candidate: Candidate,
  config: Partial<ScoringConfig> = {}
): ScoreResult {
  const cfg = { ...DEFAULT_SCORING_CONFIG, ...config }
  
  // 计算各项相似度
  const titleSim = stringSimilarity(
    normalizedInfo.title || normalizedInfo.filename || '',
    candidate.title || ''
  )
  
  const artistSim = normalizedInfo.artist && candidate.artist
    ? stringSimilarity(normalizedInfo.artist, candidate.artist)
    : 0
  
  const albumSim = normalizedInfo.album && candidate.album
    ? stringSimilarity(normalizedInfo.album, candidate.album)
    : 0
  
  const durationSim = durationSimilarity(
    normalizedInfo.duration,
    candidate.duration,
    cfg.durationTolerance
  )
  
  // 计算加权得分
  const titleScore = titleSim * cfg.titleWeight
  const artistScore = artistSim * cfg.artistWeight
  const albumScore = albumSim * cfg.albumWeight
  const durationScore = durationSim * cfg.durationWeight
  
  const totalScore = titleScore + artistScore + albumScore + durationScore
  
  return {
    score: Math.round(totalScore * 100) / 100,
    breakdown: {
      title: Math.round(titleScore * 100) / 100,
      artist: Math.round(artistScore * 100) / 100,
      album: Math.round(albumScore * 100) / 100,
      duration: Math.round(durationScore * 100) / 100
    },
    matched: totalScore >= cfg.threshold
  }
}

/**
 * 从候选列表中选择最佳匹配
 * @param normalizedInfo - 标准化后的音轨信息
 * @param candidates - 候选结果列表
 * @param config - 评分配置（可选）
 * @returns 最佳匹配的候选结果，如果没有达到阈值则返回 null
 */
export function selectBestCandidate<T extends Candidate>(
  normalizedInfo: NormalizedTrackInfo,
  candidates: T[],
  config: Partial<ScoringConfig> = {}
): { candidate: T; score: ScoreResult } | null {
  if (!candidates || candidates.length === 0) return null
  
  let bestCandidate: T | null = null
  let bestScore: ScoreResult | null = null
  
  console.log(`\n🎯 [Scoring] 开始评分 ${candidates.length} 个候选结果`)
  
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const score = scoreCandidate(normalizedInfo, candidate, config)
    
    console.log(`   候选 ${i + 1}:`, {
      title: candidate.title,
      artist: candidate.artist,
      score: score.score,
      breakdown: score.breakdown
    })
    
    if (!bestScore || score.score > bestScore.score) {
      bestCandidate = candidate
      bestScore = score
    }
  }
  
  if (!bestScore || !bestCandidate) return null
  
  console.log(`\n   最佳匹配: "${bestCandidate.title}" (得分: ${bestScore.score})`)
  
  if (bestScore.matched) {
    console.log(`   ✅ 达到阈值 (${config.threshold || DEFAULT_SCORING_CONFIG.threshold})，匹配成功`)
    return { candidate: bestCandidate, score: bestScore }
  } else {
    console.log(`   ❌ 未达到阈值 (${config.threshold || DEFAULT_SCORING_CONFIG.threshold})，判定为未匹配`)
    return null
  }
}

/**
 * 在专辑曲目列表中查找最佳匹配（使用评分系统）
 * @param normalizedInfo - 标准化后的音轨信息
 * @param albumTracks - 专辑曲目列表
 * @param config - 评分配置（可选）
 * @returns 最佳匹配的曲目
 */
export function findBestMatchInAlbum<T extends Candidate>(
  normalizedInfo: NormalizedTrackInfo,
  albumTracks: T[],
  config: Partial<ScoringConfig> = {}
): { track: T; score: ScoreResult } | null {
  console.log(`\n🎵 [Album Matching] 在专辑曲目中查找匹配`)
  console.log(`   目标: "${normalizedInfo.title}"`)
  console.log(`   曲目数: ${albumTracks.length}`)
  
  // 使用评分系统选择最佳匹配
  // 专辑匹配时，title 权重更高，artist/album 权重降低（因为专辑内都是同一艺术家）
  const albumConfig: Partial<ScoringConfig> = {
    titleWeight: 70,      // 提高 title 权重
    artistWeight: 10,     // 降低 artist 权重
    albumWeight: 5,       // 降低 album 权重
    durationWeight: 15,   // 提高 duration 权重（专辑内更准确）
    threshold: 60,        // 保持阈值
    ...config
  }
  
  const result = selectBestCandidate(normalizedInfo, albumTracks, albumConfig)
  
  if (result) {
    return { track: result.candidate, score: result.score }
  }
  
  return null
}

/**
 * 示例和测试用例
 */
export const SCORING_EXAMPLES = [
  {
    description: '完全匹配',
    normalized: {
      title: 'Love Story',
      artist: 'Taylor Swift',
      album: 'Fearless',
      duration: 235
    },
    candidate: {
      title: 'Love Story',
      artist: 'Taylor Swift',
      album: 'Fearless',
      duration: 235
    },
    expectedScore: '~100 分（完美匹配）'
  },
  {
    description: '不同版本（Taylor\'s Version）',
    normalized: {
      title: 'Love Story',
      artist: 'Taylor Swift',
      album: 'Fearless'
    },
    candidate: {
      title: 'Love Story (Taylor\'s Version)',
      artist: 'Taylor Swift',
      album: 'Fearless (Taylor\'s Version)'
    },
    expectedScore: '~95 分（标准化后匹配，扣除版本差异）'
  },
  {
    description: 'feat 版本',
    normalized: {
      title: 'See You Again',
      artist: 'Wiz Khalifa',
      album: 'Furious 7'
    },
    candidate: {
      title: 'See You Again (feat. Charlie Puth)',
      artist: 'Wiz Khalifa',
      album: 'Furious 7 Soundtrack'
    },
    expectedScore: '~90 分（feat 被标准化处理）'
  },
  {
    description: 'Remastered 版本',
    normalized: {
      title: 'Hey Jude',
      artist: 'The Beatles',
      album: '1'
    },
    candidate: {
      title: 'Hey Jude - Remastered 2015',
      artist: 'The Beatles',
      album: '1 (Remastered)'
    },
    expectedScore: '~92 分（Remastered 被标准化处理）'
  },
  {
    description: '时长接近',
    normalized: {
      title: 'Yesterday',
      artist: 'The Beatles',
      duration: 123
    },
    candidate: {
      title: 'Yesterday',
      artist: 'The Beatles',
      duration: 125
    },
    expectedScore: '~98 分（2秒差异在容差内）'
  },
  {
    description: '时长差异大',
    normalized: {
      title: 'Yesterday',
      artist: 'The Beatles',
      duration: 123
    },
    candidate: {
      title: 'Yesterday',
      artist: 'The Beatles',
      duration: 240
    },
    expectedScore: '~85 分（时长差异大扣分）'
  },
  {
    description: '同名不同艺术家（应该不匹配）',
    normalized: {
      title: 'Yesterday',
      artist: 'The Beatles'
    },
    candidate: {
      title: 'Yesterday',
      artist: 'Boyz II Men'
    },
    expectedScore: '~55 分（未达到阈值60，判定不匹配）'
  },
  {
    description: '拼写错误',
    normalized: {
      title: 'Bohemian Rhapsody',
      artist: 'Queen'
    },
    candidate: {
      title: 'Bohemian Rapsody', // 少一个 h
      artist: 'Queen'
    },
    expectedScore: '~88 分（编辑距离允许小错误）'
  }
]
