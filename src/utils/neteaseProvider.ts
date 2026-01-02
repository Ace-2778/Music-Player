/**
 * 网易云音乐歌词 Provider
 * API: 无需 Key，免费使用
 */

import { LyricsCandidate } from './lyricsService'

/**
 * 从网易云音乐搜索歌词
 * @param artist - 艺术家
 * @param title - 歌曲标题
 * @returns 候选列表
 */
export async function searchFromNetEase(
  artist?: string,
  title?: string
): Promise<LyricsCandidate[]> {
  try {
    if (!artist || !title) {
      return []
    }
    
    const keywords = `${artist} ${title}`
    console.log('🔍 [NetEase] 请求:', { artist, title })
    
    // 1. 搜索歌曲
    const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keywords)}&type=1&offset=0&limit=5`
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://music.163.com/',
        'Accept-Charset': 'UTF-8'
      }
    })
    
    if (!searchResponse.ok) {
      console.log('⚠️ [NetEase] 搜索失败:', searchResponse.status)
      return []
    }
    
    const searchData = await searchResponse.json()
    
    if (!searchData.result?.songs || searchData.result.songs.length === 0) {
      console.log('⚠️ [NetEase] 未找到歌曲')
      return []
    }
    
    // 取前3个结果
    const songs = searchData.result.songs.slice(0, 3)
    const candidates: LyricsCandidate[] = []
    
    // 2. 获取每首歌的歌词
    for (const song of songs) {
      try {
        const lyricsUrl = `https://music.163.com/api/song/lyric?id=${song.id}&lv=-1&tv=-1`
        
        const lyricsResponse = await fetch(lyricsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://music.163.com/',
            'Accept-Charset': 'UTF-8'
          }
        })
        
        if (!lyricsResponse.ok) continue
        
        const lyricsData = await lyricsResponse.json()
        
        if (lyricsData.lrc?.lyric) {
          candidates.push({
            title: song.name || '',
            artist: song.artists?.[0]?.name || artist || '',
            album: song.album?.name,
            duration: song.duration ? Math.round(song.duration / 1000) : undefined,
            syncedLyrics: lyricsData.lrc.lyric,
            source: 'netease'
          })
        }
      } catch (error) {
        console.error('❌ [NetEase] 获取歌词失败:', error)
      }
    }
    
    if (candidates.length > 0) {
      console.log(`✅ [NetEase] 找到 ${candidates.length} 个候选`)
    }
    
    return candidates
    
  } catch (error) {
    console.error('❌ [NetEase] 失败:', error)
    return []
  }
}
