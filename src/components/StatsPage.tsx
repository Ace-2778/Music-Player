import { Track } from '../store/playerStore'
import type { LibraryDataLayer } from '../store/libraryStore'
import './StatsPage.css'

interface StatsPageProps {
  tracks: Track[]
  libraryStore: LibraryDataLayer
}

export function StatsPage({ tracks, libraryStore }: StatsPageProps) {
  // 计算统计数据
  const playCounts = libraryStore.getPlayCounts()
  const playDurations = libraryStore.getPlayDurations() // ⭐ 新增：获取真实播放时长
  const favorites = libraryStore.getFavorites()
  const recents = libraryStore.getRecents()
  
  // 播放次数排序
  const topPlayedTracks = tracks
    .map(t => ({
      ...t,
      playCount: playCounts[t.id] || 0
    }))
    .filter(t => t.playCount > 0)
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 10)

  // 统计艺术家播放次数
  const artistStats = tracks.reduce((acc, track) => {
    const playCount = playCounts[track.id] || 0
    if (playCount > 0) {
      const artist = track.artist || '未知艺术家'
      acc[artist] = (acc[artist] || 0) + playCount
    }
    return acc
  }, {} as Record<string, number>)

  const topArtists = Object.entries(artistStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // 统计专辑播放次数
  const albumStats = tracks.reduce((acc, track) => {
    const playCount = playCounts[track.id] || 0
    if (playCount > 0) {
      const album = track.album || '未知专辑'
      acc[album] = (acc[album] || 0) + playCount
    }
    return acc
  }, {} as Record<string, number>)

  const topAlbums = Object.entries(albumStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // 总播放次数
  const totalPlayCount = Object.values(playCounts).reduce<number>((sum, count) => sum + (count || 0), 0)

  // ⭐ 修改：总播放时长改为使用真实记录的播放时长（秒）
  const totalPlayTime = Object.values(playDurations).reduce<number>((sum, duration) => sum + (duration || 0), 0)

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours} 小时 ${minutes} 分钟`
    }
    return `${minutes} 分钟`
  }

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h2>统计信息</h2>
      </div>

      <div className="stats-container">
        {/* 概览卡片 */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-value">{tracks.length}</div>
            <div className="stat-label">本地歌曲</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{favorites.length}</div>
            <div className="stat-label">我的收藏</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalPlayCount}</div>
            <div className="stat-label">总播放次数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatDuration(totalPlayTime)}</div>
            <div className="stat-label">总播放时长</div>
          </div>
        </div>

        {/* 上方统计数据行 */}
        <div className="stats-row">
          {/* 播放最多的歌曲 */}
          <div className="stats-section">
            <h3>最常播放的歌曲</h3>
            <div className="stats-list">
              {topPlayedTracks.length === 0 ? (
                <div className="stats-empty">暂无数据</div>
              ) : (
                topPlayedTracks.map((track, index) => (
                  <div key={track.id} className="stats-item">
                    <div className="stats-rank">{index + 1}</div>
                    <div className="stats-info">
                      <div className="stats-title">{track.displayTitle || track.title}</div>
                      <div className="stats-artist">{track.artist}</div>
                    </div>
                    <div className="stats-count">{track.playCount}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 最常播放的艺术家 */}
          <div className="stats-section">
            <h3>最常播放的艺术家</h3>
            <div className="stats-list">
              {topArtists.length === 0 ? (
                <div className="stats-empty">暂无数据</div>
              ) : (
                topArtists.map((entry, index) => (
                  <div key={entry[0]} className="stats-item">
                    <div className="stats-rank">{index + 1}</div>
                    <div className="stats-info">
                      <div className="stats-title">{entry[0]}</div>
                    </div>
                    <div className="stats-count">{entry[1]}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 下方统计数据行 */}
        <div className="stats-row">
          {/* 最常播放的专辑 */}
          <div className="stats-section">
            <h3>最常播放的专辑</h3>
            <div className="stats-list">
              {topAlbums.length === 0 ? (
                <div className="stats-empty">暂无数据</div>
              ) : (
                topAlbums.map((entry, index) => (
                  <div key={entry[0]} className="stats-item">
                    <div className="stats-rank">{index + 1}</div>
                    <div className="stats-info">
                      <div className="stats-title">{entry[0]}</div>
                    </div>
                    <div className="stats-count">{entry[1]}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 最近播放的歌曲 */}
          <div className="stats-section">
            <h3>最近播放</h3>
            <div className="stats-list">
              {recents.length === 0 ? (
                <div className="stats-empty">暂无数据</div>
              ) : (
                recents.slice(0, 10).map((trackId: string, index: number) => {
                  const track = tracks.find(t => t.id === trackId)
                  if (!track) return null
                  return (
                    <div key={trackId} className="stats-item">
                      <div className="stats-rank">{index + 1}</div>
                      <div className="stats-info">
                        <div className="stats-title">{track.displayTitle || track.title}</div>
                        <div className="stats-artist">{track.artist}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
