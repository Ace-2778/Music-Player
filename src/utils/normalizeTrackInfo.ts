/**
 * 音乐信息标准化模块
 * 用于清理和规范化音频文件的 metadata，提高歌词/封面检索的准确性
 */

import { Track } from '../store/playerStore'

/**
 * 标准化后的音轨信息
 */
export interface NormalizedTrackInfo {
  artist?: string       // 标准化的艺术家名
  title?: string        // 标准化的歌曲名
  album?: string        // 标准化的专辑名
  filename?: string     // 原始文件名（不含扩展名）
  duration?: number     // 时长（秒）
  keywords: string[]    // 用于兜底搜索的关键词列表
}

/**
 * 无意义词列表（过滤用）
 */
const NOISE_WORDS = new Set([
  'official', 'music', 'video', 'lyrics', 'audio', 'hd', 'hq',
  'remastered', 'remaster', 'live', 'version', 'edit', 'mix',
  'extended', 'instrumental', 'karaoke', 'cover', 'remix',
  'single', 'album', 'ep', 'deluxe', 'edition', 'explicit'
])

/**
 * 去除括号及其内容的正则
 * 匹配: (xxx), [xxx], 【xxx】, （xxx）
 */
const BRACKET_REGEX = /[\(\（\[【].*?[\)\）\]】]/g

/**
 * feat/ft 匹配正则
 * 匹配: feat., feat, ft., ft, featuring
 */
const FEAT_REGEX = /\s+(?:feat\.?|ft\.?|featuring)\s+.*/gi

/**
 * 文件扩展名正则
 */
const EXTENSION_REGEX = /\.(mp3|flac|wav|m4a|aac|ogg|wma)$/i

/**
 * 清理字符串：去括号、去feat、去多余符号
 */
function cleanString(str: string, removeFeat = true): string {
  if (!str) return ''
  
  let cleaned = str
  
  // 1. 去除括号内容
  cleaned = cleaned.replace(BRACKET_REGEX, '')
  
  // 2. 去除 feat/ft（可选）
  if (removeFeat) {
    cleaned = cleaned.replace(FEAT_REGEX, '')
  }
  
  // 3. 去除文件扩展名
  cleaned = cleaned.replace(EXTENSION_REGEX, '')
  
  // 4. 去除常见后缀（- Remastered, - Single 等）
  // 注意：要先匹配带连字符的，避免直接删除单词
  cleaned = cleaned.replace(/\s*[-–]\s*(Remastered?|Single|EP|Deluxe\s*Edition|Edition|Explicit)(\s+\d+)?/gi, '')
  
  // 5. 替换下划线和多个连字符为空格
  cleaned = cleaned.replace(/_+/g, ' ').replace(/-{2,}/g, ' ')
  
  // 6. 去除多余空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

/**
 * 提取 feat 艺术家（用于 keywords）
 */
function extractFeatArtists(str: string): string[] {
  if (!str) return []
  
  const match = str.match(FEAT_REGEX)
  if (!match) return []
  
  // 提取 feat 后面的艺术家名
  const featPart = match[0].replace(/\s+(?:feat\.?|ft\.?|featuring)\s+/gi, '')
  
  // 按逗号或 & 分割多个艺术家
  return featPart
    .split(/[,&]/)
    .map(name => name.trim())
    .filter(name => name.length > 0)
}

/**
 * 从文件名猜测 artist 和 title
 * 支持格式：
 * - "Artist - Title"
 * - "Title - Artist"  
 * - "Artist-Title"
 * - 纯 Title
 */
function parseFilename(filename: string): { artist?: string; title?: string } {
  const cleaned = cleanString(filename, false)
  
  // 尝试按 " - " 分割（最常见的格式，空格+连字符+空格）
  const spaceDashParts = cleaned.split(/\s+-\s+/)
  
  if (spaceDashParts.length === 2) {
    const [part1, part2] = spaceDashParts
    
    // 中文字符判断：如果两部分都是中文，优先认为是 Artist - Title（中文习惯）
    const isChinese1 = /[\u4e00-\u9fa5]/.test(part1)
    const isChinese2 = /[\u4e00-\u9fa5]/.test(part2)
    
    if (isChinese1 && isChinese2) {
      // 两部分都是中文，默认 Artist - Title
      return { artist: part1, title: part2 }
    }
    
    // 英文：启发式判断哪个是艺术家（通常更短）
    if (part1.length < part2.length * 0.7) {
      return { artist: part1, title: part2 }
    } else {
      // 长度相近或第一部分更长，认为是 Artist - Title
      return { artist: part1, title: part2 }
    }
  }
  
  // 尝试按单个连字符分割（可能是 "Artist-Title" 或 "Artist_-_Title"）
  // 先去掉下划线，统一处理
  const normalized = cleaned.replace(/_/g, ' ').replace(/\s+/g, ' ')
  const dashParts = normalized.split(/\s*-\s*/)
  
  if (dashParts.length >= 2) {
    const [part1, ...restParts] = dashParts
    const part2 = restParts.join('-').trim()
    
    // 判断哪个是艺术家
    if (part1.length > 0 && part2.length > 0) {
      // 中文优先 Artist - Title
      const isChinese1 = /[\u4e00-\u9fa5]/.test(part1)
      const isChinese2 = /[\u4e00-\u9fa5]/.test(part2)
      
      if (isChinese1 && isChinese2) {
        return { artist: part1.trim(), title: part2 }
      }
      
      if (part1.length < part2.length * 0.7) {
        return { artist: part1.trim(), title: part2 }
      } else {
        // 如果长度相近或第一部分更长，优先认为是 Artist - Title
        return { artist: part1.trim(), title: part2 }
      }
    }
  }
  
  // 无法可靠分割，整个作为 title
  return { title: cleaned }
}

/**
 * 提取关键词（去重、过滤噪音词）
 */
function extractKeywords(...sources: (string | undefined)[]): string[] {
  const allWords = new Set<string>()
  
  for (const source of sources) {
    if (!source) continue
    
    // 分词：按空格、连字符、逗号分割
    const words = source
      .toLowerCase()
      .split(/[\s\-,]+/)
      .map(w => w.trim())
      .filter(w => {
        // 过滤条件：
        // 1. 长度至少 2
        // 2. 不在噪音词列表
        // 3. 不是纯数字
        return (
          w.length >= 2 &&
          !NOISE_WORDS.has(w) &&
          !/^\d+$/.test(w)
        )
      })
    
    words.forEach(w => allWords.add(w))
  }
  
  return Array.from(allWords)
}

/**
 * 标准化音轨信息
 * @param track - 原始音轨对象
 * @returns 标准化后的信息
 */
export function normalizeTrackInfo(track: Track): NormalizedTrackInfo {
  // 提取原始信息
  const rawArtist = track.artist || ''
  const rawTitle = track.title || ''
  const rawAlbum = track.album || ''
  const rawPath = track.path || ''
  
  // 从路径提取文件名（不含扩展名）
  const filenameMatch = rawPath.match(/[^/\\]+$/)
  const rawFilename = filenameMatch ? filenameMatch[0] : ''
  const filename = cleanString(rawFilename)
  
  // 提取 feat 艺术家（用于 keywords）
  const featArtists = extractFeatArtists(rawTitle)
  
  // 标准化主要字段
  let artist = cleanString(rawArtist)
  let title = cleanString(rawTitle)
  const album = cleanString(rawAlbum)
  
  // 🔥 兜底策略：如果 metadata 缺失或不可靠，从文件名猜测
  if ((!artist || artist === 'Various Artists' || artist === 'Unknown Artist') && 
      (!title || title.startsWith('Unknown Track') || title.startsWith('Track ')) && 
      filename) {
    const parsed = parseFilename(rawFilename)
    artist = parsed.artist || artist || ''
    title = parsed.title || title || ''
    console.log(`📝 [标准化] 从文件名解析: ${filename} → artist="${artist}", title="${title}"`)
  } else if (!title && filename) {
    // 只有 title 缺失
    title = filename
  } else if (!artist && filename) {
    // 只有 artist 缺失（尝试从文件名提取）
    const parsed = parseFilename(rawFilename)
    if (parsed.artist) {
      artist = parsed.artist
    }
  }
  
  // 提取关键词（去重、过滤噪音）
  const keywords = extractKeywords(
    artist,
    title,
    album,
    ...featArtists,
    filename
  )
  
  // 构建结果
  const result: NormalizedTrackInfo = {
    artist: artist || undefined,
    title: title || undefined,
    album: album || undefined,
    filename: filename || undefined,
    duration: track.duration || undefined,  // 添加时长
    keywords
  }
  
  console.log('🔍 [标准化] 输入:', {
    artist: rawArtist,
    title: rawTitle,
    filename: rawFilename
  })
  console.log('✅ [标准化] 输出:', result)
  
  return result
}

/**
 * 生成搜索查询字符串（用于 API 请求）
 * @param normalized - 标准化后的信息
 * @param format - 查询格式
 * @returns 查询字符串
 */
export function buildSearchQuery(
  normalized: NormalizedTrackInfo,
  format: 'artist-title' | 'keywords' = 'artist-title'
): string {
  if (format === 'artist-title' && normalized.artist && normalized.title) {
    return `${normalized.artist} ${normalized.title}`
  }
  
  // 兜底：使用关键词（前 5 个）
  return normalized.keywords.slice(0, 5).join(' ')
}

/**
 * 示例测试用例
 */
export const NORMALIZATION_EXAMPLES = [
  {
    input: {
      artist: 'Taylor Swift',
      title: 'Love Story (Taylor\'s Version) [feat. Some Artist]',
      album: 'Fearless (Taylor\'s Version) - Deluxe Edition',
      path: '/music/Taylor Swift - Love Story (Live).mp3'
    },
    expected: {
      artist: 'Taylor Swift',
      title: 'Love Story',
      album: 'Fearless',
      keywords: ['taylor', 'swift', 'love', 'story', 'fearless', 'some', 'artist']
    }
  },
  {
    input: {
      artist: '',
      title: '',
      album: '',
      path: '/downloads/Ed_Sheeran-Shape_of_You_[Official_Audio].mp3'
    },
    expected: {
      artist: 'Ed Sheeran',
      title: 'Shape of You',
      filename: 'Ed Sheeran Shape of You',
      keywords: ['ed', 'sheeran', 'shape', 'of', 'you']
    }
  },
  {
    input: {
      artist: 'Various Artists',
      title: 'Unknown Track 01',
      album: '',
      path: '/library/周杰伦 - 晴天.mp3'
    },
    expected: {
      artist: '周杰伦',
      title: '晴天',
      filename: '周杰伦 晴天',
      keywords: ['周杰伦', '晴天']
    }
  },
  {
    input: {
      artist: 'The Beatles',
      title: 'Hey Jude - Remastered 2015',
      album: '1 (Remastered)',
      path: '/music/beatles/hey_jude.flac'
    },
    expected: {
      artist: 'The Beatles',
      title: 'Hey Jude',
      album: '1',
      keywords: ['the', 'beatles', 'hey', 'jude']
    }
  }
]
