import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import './SettingsOverlay.css'

interface SettingsOverlayProps {
  isOpen: boolean
  onClose: () => void
  onRescan: (folderPath: string) => void
  onRemove: (folderPath: string) => void
  originPosition: { x: number; y: number } | null // ⭐ 齿轮按钮的真实位置
}

export function SettingsOverlay({ isOpen, onClose, onRescan, onRemove, originPosition }: SettingsOverlayProps) {
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  
  // ⭐ 两段式打开：mount 控制渲染，open 控制动画
  const [settingsMounted, setSettingsMounted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  
  // ⭐ 从 store 获取歌词选项
  const { lyricsOptions, setLyricsOptions } = usePlayerStore()

  // ⭐ 计算扩散圆心和半径
  const getCircleParams = () => {
    // 默认位置（右上角）
    let cx = window.innerWidth - 60
    let cy = 32

    if (originPosition && originPosition.x !== 0 && originPosition.y !== 0) {
      cx = originPosition.x
      cy = originPosition.y
    }

    // ⭐ 计算覆盖全屏所需的最大半径
    const w = window.innerWidth
    const h = window.innerHeight - 72 // 减去 bottom bar
    const maxX = Math.max(cx, w - cx)
    const maxY = Math.max(cy, h - cy)
    const radius = Math.hypot(maxX, maxY) + 40

    return { cx, cy, radius }
  }

  // ⭐ 监听 isOpen，执行两段式打开
  useEffect(() => {
    if (isOpen) {
      // 第1步：先 mount
      setSettingsMounted(true)
      
      // 第2步：用 double rAF 确保初始样式已被应用
      let frameId1: number
      let frameId2: number
      
      frameId1 = requestAnimationFrame(() => {
        frameId2 = requestAnimationFrame(() => {
          setSettingsOpen(true)
        })
      })
      
      return () => {
        cancelAnimationFrame(frameId1)
        cancelAnimationFrame(frameId2)
      }
    } else {
      // 关闭时：先触发 exit 动画
      setSettingsOpen(false)
      
      // 等待动画完成后再卸载（动画时间 0.45s）
      const timer = setTimeout(() => {
        setSettingsMounted(false)
      }, 450)
      
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // 加载文件夹列表
  useEffect(() => {
    if (settingsMounted) {
      loadFolders()
    }
  }, [settingsMounted])

  const loadFolders = async () => {
    try {
      const folderList = await window.electronAPI.getLibraryFolders()
      setFolders(folderList)
    } catch (error) {
      console.error('❌ [Settings] 加载文件夹列表失败:', error)
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
      console.log('✅ [Settings] 文件夹已移除:', folderPath)
    } catch (error) {
      console.error('❌ [Settings] 移除文件夹失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRescan = async (folderPath: string) => {
    setLoading(true)
    try {
      onRescan(folderPath)
      console.log('✅ [Settings] 开始重新扫描:', folderPath)
      // 关闭设置面板，让用户看到扫描过程
      onClose()
    } catch (error) {
      console.error('❌ [Settings] 重新扫描失败:', error)
    } finally {
      setLoading(false)
    }
  }
  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 禁用底层滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // 点击空白处关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const { cx, cy, radius } = getCircleParams()

  return (
    <AnimatePresence mode="wait" initial={false}>
      {settingsMounted && (
        <motion.div
          className="settings-overlay"
          onClick={handleOverlayClick}
          initial={{
            clipPath: `circle(0px at ${cx}px ${cy}px)` // ⭐ 从齿轮真实位置扩散
          }}
          animate={settingsOpen ? {
            clipPath: `circle(${radius}px at ${cx}px ${cy}px)` // ⭐ 扩散到覆盖全屏
          } : {
            clipPath: `circle(0px at ${cx}px ${cy}px)` // ⭐ 保持初始状态（未动画时）
          }}
          exit={{
            clipPath: `circle(0px at ${cx}px ${cy}px)` // ⭐ 收回到齿轮位置
          }}
          transition={{
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1] // ⭐ easeOutCubic 类似效果
          }}
          style={{ willChange: 'clip-path' }} // ⭐ 性能优化
        >
          {/* 设置内容容器 - 淡入/scale，无 y 位移 */}
          <motion.div
            className="settings-content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={settingsOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ 
              duration: 0.25, 
              delay: settingsOpen ? 0.2 : 0, // ⭐ 扩散到 70% 后开始淡入（关闭时无延迟）
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            <div className="settings-header">
              <h2 className="settings-title">设置</h2>
              <button className="settings-close-btn" onClick={onClose}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="settings-body">
              {/* 显示设置 */}
              <div className="settings-section">
                <h3 className="settings-section-title">显示设置</h3>
                
                <div className="settings-list">
                  {/* 歌词对齐方式 */}
                  <div className="settings-item">
                    <label className="settings-item-label">歌词对齐方式</label>
                    <div className="settings-item-control">
                      <select 
                        className="settings-select"
                        value={lyricsOptions.align}
                        onChange={(e) => setLyricsOptions({ align: e.target.value as 'left' | 'center' })}
                      >
                        <option value="left">左对齐</option>
                        <option value="center">居中</option>
                      </select>
                    </div>
                  </div>

                  {/* 启用在线搜索 */}
                  <div className="settings-item">
                    <label className="settings-item-label">启用在线封面/歌词</label>
                    <div className="settings-item-control">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={lyricsOptions.enableOnlineSearch}
                          onChange={(e) => setLyricsOptions({ enableOnlineSearch: e.target.checked })}
                        />
                        <span className="settings-switch-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 曲库管理 */}
              <div className="settings-section">
                <h3 className="settings-section-title">曲库管理</h3>
                
                {folders.length === 0 ? (
                  <div className="settings-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>暂无导入的文件夹</p>
                    <span>点击顶部的"导入文件夹"按钮来添加音乐</span>
                  </div>
                ) : (
                  <div className="settings-folder-list">
                    {folders.map((folder, index) => (
                      <div key={index} className="settings-folder-item">
                        <div className="settings-folder-path">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                          <span title={folder}>{folder}</span>
                        </div>
                        <div className="settings-folder-actions">
                          <button
                            className="settings-folder-action"
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
                            className="settings-folder-action settings-folder-remove"
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}