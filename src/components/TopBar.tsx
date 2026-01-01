import './TopBar.css'

interface TopBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onImportClick: () => void
  loading: boolean
}

export function TopBar({ searchQuery, onSearchChange, onImportClick, loading }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1 className="app-name">Music</h1>
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
      </div>
    </div>
  )
}
