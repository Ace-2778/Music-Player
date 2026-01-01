import { Track } from '../store/playerStore'
import './TrackList.css'

interface TrackListProps {
  tracks: Track[]
  currentTrack: Track | null
  onTrackClick: (track: Track) => void
}

// 格式化时长为 mm:ss
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function TrackList({ tracks, currentTrack, onTrackClick }: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <div className="tracklist-empty">
        <p>暂无歌曲</p>
        <p className="empty-hint">点击"导入文件夹"开始使用</p>
      </div>
    )
  }

  return (
    <div className="tracklist">
      <div className="tracklist-header">
        <div className="col-title">标题</div>
        <div className="col-artist">歌手</div>
        <div className="col-album">专辑</div>
        <div className="col-duration">时长</div>
      </div>
      
      <div className="tracklist-body">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => onTrackClick(track)}
          >
            <div className="col-title">{track.title}</div>
            <div className="col-artist">{track.artist}</div>
            <div className="col-album">{track.album}</div>
            <div className="col-duration">{formatTime(track.duration)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
