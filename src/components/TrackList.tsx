import { useState, useRef } from 'react'
import { Track } from '../store/playerStore'
import { libraryStore } from '../store/libraryStore'
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
  const [contextMenuTrack, setContextMenuTrack] = useState<Track | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const [favorites, setFavorites] = useState<Set<string>>(new Set(libraryStore.getFavorites()))
  const [playlists, setPlaylists] = useState(libraryStore.getPlaylists())
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault()
    setContextMenuTrack(track)
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleFavoriteClick = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation()
    const newFavorites = new Set(favorites)
    if (newFavorites.has(track.id)) {
      newFavorites.delete(track.id)
    } else {
      newFavorites.add(track.id)
    }
    libraryStore.toggleFavorite(track.id)
    setFavorites(newFavorites)
  }

  const handleAddToPlaylist = (playlistId: string) => {
    if (contextMenuTrack) {
      libraryStore.addToPlaylist(playlistId, contextMenuTrack.id)
      console.log('✅ 已添加到播放列表')
    }
    setContextMenuTrack(null)
  }

  const handlePlay = () => {
    if (contextMenuTrack) {
      onTrackClick(contextMenuTrack)
    }
    setContextMenuTrack(null)
  }

  const handleToggleFavorite = () => {
    if (contextMenuTrack) {
      libraryStore.toggleFavorite(contextMenuTrack.id)
      const newFavorites = new Set(favorites)
      if (newFavorites.has(contextMenuTrack.id)) {
        newFavorites.delete(contextMenuTrack.id)
      } else {
        newFavorites.add(contextMenuTrack.id)
      }
      setFavorites(newFavorites)
    }
    setContextMenuTrack(null)
  }

  // 点击外部关闭菜单
  const handleClickOutside = (e: React.MouseEvent) => {
    if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
      setContextMenuTrack(null)
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="tracklist-empty">
        <p>暂无歌曲</p>
        <p className="empty-hint">点击"导入文件夹"开始使用</p>
      </div>
    )
  }

  return (
    <div className="tracklist" onClick={handleClickOutside}>
      <div className="tracklist-header">
        <div className="col-title">标题</div>
        <div className="col-artist">歌手</div>
        <div className="col-album">专辑</div>
        <div className="col-favorite"></div>
        <div className="col-duration">时长</div>
      </div>
      
      <div className="tracklist-body">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => onTrackClick(track)}
            onContextMenu={(e) => handleContextMenu(e, track)}
          >
            <div className="col-title">{track.displayTitle || track.title}</div>
            <div className="col-artist">{track.artist}</div>
            <div className="col-album">{track.album}</div>
            <div className="col-favorite">
              <button
                className={`favorite-btn ${favorites.has(track.id) ? 'favorited' : ''}`}
                onClick={(e) => handleFavoriteClick(e, track)}
                title={favorites.has(track.id) ? '取消收藏' : '收藏'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
            <div className="col-duration">{formatTime(track.duration)}</div>
          </div>
        ))}
      </div>

      {/* 右键菜单 */}
      {contextMenuTrack && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
        >
          <button className="context-menu-item" onClick={handlePlay}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            播放
          </button>

          {playlists.length > 0 && (
            <>
              <div className="context-menu-divider"></div>
              <div className="context-menu-submenu">
                <div className="context-menu-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  添加到歌单
                </div>
                {playlists.map(playlist => (
                  <button
                    key={playlist.id}
                    className="context-menu-item context-menu-subitem"
                    onClick={() => handleAddToPlaylist(playlist.id)}
                  >
                    {playlist.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="context-menu-divider"></div>
          <button className="context-menu-item" onClick={handleToggleFavorite}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {favorites.has(contextMenuTrack.id) ? '取消收藏' : '收藏'}
          </button>
        </div>
      )}
    </div>
  )
}
