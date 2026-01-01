import { useState, useEffect } from 'react'
import './LibraryManager.css'

interface LibraryManagerProps {
  onRescan: (folderPath: string) => void
  onRemove: (folderPath: string) => void
}

export function LibraryManager({ onRescan, onRemove }: LibraryManagerProps) {
  const [folders, setFolders] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // 加载文件夹列表
  useEffect(() => {
    if (isOpen) {
      loadFolders()
    }
  }, [isOpen])

  const loadFolders = async () => {
    try {
      const folderList = await window.electronAPI.getLibraryFolders()
      setFolders(folderList)
    } catch (error) {
      console.error('❌ [LibraryManager] 加载文件夹列表失败:', error)
    }
  }

  const handleRemove = async (folderPath: string) => {
    if (!confirm(`确定要移除文件夹吗？\n\n${folderPath}\n\n该文件夹的所有歌曲将从曲库中移除。`)) {
      return
    }

    setLoading(true)
    try {
      await window.electronAPI.removeLibraryFolder(folderPath)
      setFolders(folders.filter(f => f !== folderPath))
      onRemove(folderPath)
      console.log('✅ [LibraryManager] 文件夹已移除:', folderPath)
    } catch (error) {
      console.error('❌ [LibraryManager] 移除文件夹失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRescan = async (folderPath: string) => {
    setLoading(true)
    try {
      onRescan(folderPath)
      console.log('✅ [LibraryManager] 开始重新扫描:', folderPath)
    } catch (error) {
      console.error('❌ [LibraryManager] 重新扫描失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button 
        className="library-manager-toggle"
        onClick={() => setIsOpen(true)}
        title="管理曲库"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m8.66-14.66l-4.24 4.24m-4.24 4.24l-4.24 4.24m16.97-2.83l-6 6m-6-6l-6 6"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="library-manager-overlay" onClick={() => setIsOpen(false)}>
      <div className="library-manager-panel" onClick={(e) => e.stopPropagation()}>
        <div className="library-manager-header">
          <h2>曲库管理</h2>
          <button 
            className="library-manager-close"
            onClick={() => setIsOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="library-manager-content">
          {folders.length === 0 ? (
            <div className="library-manager-empty">
              <p>暂无导入的文件夹</p>
            </div>
          ) : (
            <div className="library-folder-list">
              {folders.map((folder, index) => (
                <div key={index} className="library-folder-item">
                  <div className="library-folder-path">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span title={folder}>{folder}</span>
                  </div>
                  <div className="library-folder-actions">
                    <button
                      className="library-folder-action"
                      onClick={() => handleRescan(folder)}
                      disabled={loading}
                      title="重新扫描"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                      </svg>
                      重新扫描
                    </button>
                    <button
                      className="library-folder-action library-folder-remove"
                      onClick={() => handleRemove(folder)}
                      disabled={loading}
                      title="移除"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      移除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
