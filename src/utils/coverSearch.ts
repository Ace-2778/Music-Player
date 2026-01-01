/**
 * 从 iTunes Search API 搜索专辑封面
 * @param title 歌曲名
 * @param artist 艺术家名
 * @returns 封面 URL（高清版），如果找不到返回 null
 */
export async function fetchCoverFromInternet(
  title: string, 
  artist: string
): Promise<string | null> {
  try {
    // 构建搜索关键词：艺术家 + 歌曲名
    const searchTerm = `${artist} ${title}`.trim()
    
    if (!searchTerm) {
      console.warn('🖼️ [fetchCover] 搜索关键词为空')
      return null
    }

    console.log('🔍 [fetchCover] 搜索封面:', searchTerm)

    // iTunes Search API
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&entity=song&limit=1`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ [fetchCover] iTunes API 请求失败:', response.status)
      return null
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const firstResult = data.results[0]
      
      // iTunes 返回的封面字段（优先高清）
      // artworkUrl100: 100x100
      // artworkUrl60: 60x60
      // 可以手动替换为更大尺寸，例如将 100x100 改为 600x600
      let coverUrl = firstResult.artworkUrl100 || firstResult.artworkUrl60
      
      if (coverUrl) {
        // ⭐ 提升封面质量：将 100x100 替换为 600x600
        coverUrl = coverUrl.replace('100x100', '600x600')
        
        console.log('✅ [fetchCover] 找到封面:', coverUrl)
        return coverUrl
      }
    }

    console.warn('⚠️ [fetchCover] 未找到封面')
    return null
  } catch (error) {
    console.error('❌ [fetchCover] 搜索封面出错:', error)
    return null
  }
}
