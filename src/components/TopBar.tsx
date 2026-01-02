import { useRef } from 'react'
import './TopBar.css'

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onImportClick: () => void;
  loading: boolean;
  onRescan: (folderPath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  isSettingsOpen: boolean; // ⭐ 从父组件接收设置状态
  onSettingsToggle: (position?: { x: number; y: number }) => void; // ⭐ 传递按钮位置
}

export function TopBar({ 
  searchQuery, 
  onSearchChange, 
  onImportClick, 
  loading, 
  onRescan, 
  onRemoveFolder, 
  isSettingsOpen, 
  onSettingsToggle 
}: TopBarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null)

  // ⭐ 点击齿轮时计算按钮中心位置
  const handleSettingsClick = () => {
    if (settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      onSettingsToggle({ x, y })
    } else {
      onSettingsToggle() // fallback
    }
  }
  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* ⭐ 移除 Music 标题，保持极简 */}
      </div>
      
      <div className="topbar-center">
        <input
          type="text"
          className="search-input"
          placeholder="搜索歌曲、歌手或专辑..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="topbar-right">
        <button 
          className="import-button"
          onClick={onImportClick}
          disabled={loading}
        >
          {loading ? '扫描中...' : '导入文件夹'}
        </button>
        
        {/* ⭐ 设置齿轮按钮 */}
        <button 
          ref={settingsButtonRef}
          className={`settings-button ${isSettingsOpen ? 'settings-open' : ''}`}
          onClick={handleSettingsClick}
          aria-label="Settings"
          title="设置"
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            className="settings-icon"
          >
            <path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94c0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.64l-1.92-3.32c-.12-.22-.39-.3-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.09-.49 0-.61.22L2.74 8.87c-.12.22-.07.49.12.64l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.64l1.92 3.32c.12.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32c.12-.22.07-.49-.12-.64l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
