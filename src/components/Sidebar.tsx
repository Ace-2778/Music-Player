import './Sidebar.css'

interface SidebarProps {
  activeProvider: string
  onProviderChange: (provider: string) => void
}

export function Sidebar({ activeProvider, onProviderChange }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-title">音乐库</div>
      
      <div
        className={`sidebar-item ${activeProvider === 'local' ? 'active' : ''}`}
        onClick={() => onProviderChange('local')}
      >
        <span className="sidebar-item-icon">🎵</span>
        <span className="sidebar-item-label">本地音乐</span>
      </div>
      
      <div
        className={`sidebar-item ${activeProvider === 'mock-online' ? 'active' : ''}`}
        onClick={() => onProviderChange('mock-online')}
      >
        <span className="sidebar-item-icon">🌐</span>
        <span className="sidebar-item-label">在线音乐</span>
      </div>
    </div>
  )
}
