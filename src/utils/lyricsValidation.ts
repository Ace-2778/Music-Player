/**
 * 评分系统在歌词搜索中的集成方案
 * 
 * 注意：LRCLIB API 只返回单个最佳匹配，不支持返回候选列表
 * 因此评分系统主要用于：
 * 1. 验证 LRCLIB 返回的结果是否足够匹配（避免误匹配）
 * 2. 在未来集成其他支持搜索列表的 API 时使用（如 MusicBrainz）
 */

import { 
  scoreCandidate, 
  ScoreResult
} from './scoringSystem'
import { NormalizedTrackInfo } from './normalizeTrackInfo'

/**
 * 验证歌词搜索结果是否足够匹配
 * 
 * @param normalized - 标准化的音轨信息
 * @param lyricsData - LRCLIB 返回的原始数据
 * @param minScore - 最低接受分数（默认 55）
 * @returns 是否接受此结果
 */
export function validateLyricsResult(
  normalized: NormalizedTrackInfo,
  lyricsData: any,
  minScore: number = 55
): { valid: boolean; score: ScoreResult } {
  // 构建候选结果
  const candidate = {
    title: lyricsData.trackName || lyricsData.name || '',
    artist: lyricsData.artistName || lyricsData.artist || '',
    album: lyricsData.albumName || lyricsData.album || '',
    duration: lyricsData.duration
  }
  
  // 评分
  const score = scoreCandidate(normalized, candidate, {
    threshold: minScore,
    titleWeight: 50,
    artistWeight: 30,
    albumWeight: 10,
    durationWeight: 10,
    durationTolerance: 5  // 歌词搜索时长容差更宽松
  })
  
  console.log(`🎯 [Lyrics Validation] 验证搜索结果`)
  console.log(`   目标: "${normalized.title}" - ${normalized.artist}`)
  console.log(`   返回: "${candidate.title}" - ${candidate.artist}`)
  console.log(`   得分: ${score.score}`)
  console.log(`   阈值: ${minScore}`)
  console.log(`   结果: ${score.matched ? '✅ 接受' : '❌ 拒绝'}`)
  
  return {
    valid: score.matched,
    score
  }
}

/**
 * 使用示例
 */
export const LYRICS_VALIDATION_EXAMPLE = `
// 在 fetchFromLRCLIB 中使用：

async function fetchFromLRCLIB(
  artist?: string,
  title?: string,
  album?: string,
  normalized?: NormalizedTrackInfo  // 传入标准化信息
): Promise<LyricsResult | null> {
  const response = await fetch(url)
  const data = await response.json()
  
  // ⭐ 使用评分系统验证结果
  if (normalized) {
    const validation = validateLyricsResult(normalized, data, 55)
    
    if (!validation.valid) {
      console.log('⚠️ 搜索结果质量不足，拒绝此结果')
      return null
    }
    
    console.log('✅ 搜索结果验证通过')
  }
  
  // 解析歌词...
  return parseLyrics(data)
}
`
