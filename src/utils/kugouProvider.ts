/**
 * 酷狗音乐歌词 Provider
 * API: 无需 Key，免费使用
 */

import { LyricsCandidate } from './lyricsService'

/**
 * 从酷狗音乐搜索歌词
 * @param artist - 艺术家
 * @param title - 歌曲标题
 * @returns 候选列表
 */
export async function searchFromKugou(
  artist?: string,
  title?: string
): Promise<LyricsCandidate[]> {
  try {
    if (!artist || !title) {
      return []
    }
    
    const keywords = `${artist} ${title}`
    console.log('🔍 [Kugou] 请求:', { artist, title })
    
    // 1. 搜索歌曲
    const searchUrl = `https://msearchretry.kugou.com/api/v3/search/song?keyword=${encodeURIComponent(keywords)}&page=1&pagesize=5&showtype=14`
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })
    
    if (!searchResponse.ok) {
      console.log('⚠️ [Kugou] 搜索失败:', searchResponse.status)
      return []
    }
    
    const searchData = await searchResponse.json()
    
    if (!searchData.data?.info || searchData.data.info.length === 0) {
      console.log('⚠️ [Kugou] 未找到歌曲')
      return []
    }
    
    // 取前3个结果
    const songs = searchData.data.info.slice(0, 3)
    const candidates: LyricsCandidate[] = []
    
    // 2. 获取每首歌的歌词
    for (const song of songs) {
      try {
        if (!song.hash) continue
        
        // 获取歌词访问令牌
        const accessUrl = `https://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=&duration=${song.duration}&hash=${song.hash}&album_audio_id=${song.album_audio_id || ''}`
        
        const accessResponse = await fetch(accessUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        })
        
        if (!accessResponse.ok) continue
        
        const accessData = await accessResponse.json()
        
        if (!accessData.candidates || accessData.candidates.length === 0) continue
        
        const candidate = accessData.candidates[0]
        
        // 获取实际歌词
        const lyricsUrl = `https://lyrics.kugou.com/download?ver=1&client=pc&id=${candidate.id}&accesskey=${candidate.accesskey}&fmt=lrc&charset=utf8`
        
        const lyricsResponse = await fetch(lyricsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        })
        
        if (!lyricsResponse.ok) continue
        
        const lyricsData = await lyricsResponse.json()
        
        if (lyricsData.content) {
          // Base64 解码（支持 UTF-8）
          let decodedLyrics: string
          try {
            // 使用 TextDecoder 处理 UTF-8
            const binaryString = atob(lyricsData.content)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            decodedLyrics = new TextDecoder('utf-8').decode(bytes)
          } catch (e) {
            // 兜底：直接使用 atob
            console.warn('[Kugou] UTF-8 解码失败，使用默认解码:', e)
            decodedLyrics = atob(lyricsData.content)
          }
          
          candidates.push({
            title: song.songname || song.filename || '',
            artist: song.singername || artist || '',
            album: song.album_name,
            duration: song.duration,
            syncedLyrics: decodedLyrics,
            source: 'kugou'
          })
        }
      } catch (error) {
        console.error('❌ [Kugou] 获取歌词失败:', error)
      }
    }
    
    if (candidates.length > 0) {
      console.log(`✅ [Kugou] 找到 ${candidates.length} 个候选`)
    }
    
    return candidates
    
  } catch (error) {
    console.error('❌ [Kugou] 失败:', error)
    return []
  }
}
