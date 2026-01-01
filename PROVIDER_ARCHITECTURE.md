# Music Provider 架构说明

## 概述

本音乐播放器采用 Provider 模式设计，支持多音乐源扩展。当前实现了本地音乐和 Mock 在线音乐，为未来接入真实在线音乐服务（网易云音乐、QQ音乐等）预留了架构。

## 目录结构

```
src/
├── providers/
│   ├── types.ts                 # Provider 接口定义
│   ├── LocalProvider.ts         # 本地音乐 Provider
│   ├── MockOnlineProvider.ts    # Mock 在线音乐 Provider
│   └── index.ts                 # Provider 管理器
├── components/
│   ├── Sidebar.tsx              # 侧边栏（音乐源切换）
│   └── Player.tsx               # 播放器组件
└── store/
    └── playerStore.ts           # 播放器状态管理
```

## MusicProvider 接口

每个音乐源都需要实现 `MusicProvider` 接口：

```typescript
interface MusicProvider {
  // Provider 标识
  readonly name: string
  readonly displayName: string
  
  // 是否启用
  isEnabled(): boolean
  
  // 搜索
  search(keyword: string, limit?: number): Promise<SearchResult>
  
  // 获取歌曲详情
  getTrackDetail(trackId: string): Promise<Track | null>
  
  // 获取播放 URL
  getStreamUrl(trackId: string): Promise<string | null>
  
  // 认证相关（可选）
  auth?(): Promise<boolean>
  isAuthenticated?(): boolean
}
```

## 已实现的 Provider

### 1. LocalProvider
- **功能**：管理本地音乐库
- **特点**：
  - 从渲染进程内存读取 Track 列表
  - 支持搜索、排序
  - 通过 IPC 获取本地文件 URL
  - 完整支持播放

### 2. MockOnlineProvider
- **功能**：演示在线音乐功能
- **特点**：
  - 提供 Mock 数据（周杰伦歌曲列表）
  - 支持搜索
  - 不提供真实播放 URL
  - 用于展示 UI 和交互流程

## 如何添加新的 Provider

### 步骤 1：创建 Provider 类

```typescript
// src/providers/NeteaseMusicProvider.ts
import { MusicProvider, Track, SearchResult } from './types'

export class NeteaseMusicProvider implements MusicProvider {
  readonly name = 'netease'
  readonly displayName = '网易云音乐'
  
  isEnabled(): boolean {
    return true
  }
  
  async search(keyword: string, limit: number = 30): Promise<SearchResult> {
    // 调用网易云音乐 API
    const response = await fetch(`https://api.example.com/search?keyword=${keyword}`)
    const data = await response.json()
    
    return {
      tracks: data.songs.map(this.transformTrack),
      total: data.total
    }
  }
  
  async getTrackDetail(trackId: string): Promise<Track | null> {
    // 获取歌曲详情
  }
  
  async getStreamUrl(trackId: string): Promise<string | null> {
    // 获取播放 URL
  }
  
  private transformTrack(apiTrack: any): Track {
    return {
      id: apiTrack.id.toString(),
      path: '',
      title: apiTrack.name,
      artist: apiTrack.artists[0].name,
      album: apiTrack.album.name,
      duration: apiTrack.duration / 1000,
      provider: 'netease'
    }
  }
}
```

### 步骤 2：注册 Provider

```typescript
// src/providers/index.ts
import { NeteaseMusicProvider } from './NeteaseMusicProvider'

class ProviderManager {
  constructor() {
    this.register(new LocalProvider())
    this.register(new MockOnlineProvider())
    this.register(new NeteaseMusicProvider()) // 添加新 Provider
  }
}
```

### 步骤 3：更新 UI

在 `Sidebar.tsx` 中添加新的音乐源选项：

```tsx
<div
  className={`sidebar-item ${activeProvider === 'netease' ? 'active' : ''}`}
  onClick={() => onProviderChange('netease')}
>
  <span className="sidebar-item-icon">☁️</span>
  <span className="sidebar-item-label">网易云音乐</span>
</div>
```

### 步骤 4：更新播放逻辑

如果新 Provider 支持播放，需要修改 `playerStore.ts` 中的播放逻辑：

```typescript
playTrack: async (track, index) => {
  const { audioElement } = get()
  if (!audioElement) return

  try {
    let fileUrl: string | null = null
    
    // 根据 provider 获取播放 URL
    if (track.provider === 'local') {
      fileUrl = await window.electronAPI.getFileUrl(track.path)
    } else {
      // 在线音乐
      const provider = providerManager.getProvider(track.provider)
      if (provider) {
        fileUrl = await provider.getStreamUrl(track.id)
      }
    }
    
    if (!fileUrl) {
      alert('无法获取播放地址')
      return
    }
    
    audioElement.src = fileUrl
    // ...
  } catch (error) {
    console.error('播放失败:', error)
  }
}
```

## 当前限制

- **仅支持本地音乐播放**：`MockOnlineProvider` 不提供真实播放 URL
- **搜索在渲染进程处理**：本地音乐搜索不需要网络请求
- **播放队列与显示列表分离**：搜索和排序不影响播放顺序

## 未来扩展

计划支持的在线音乐源：
- [ ] 网易云音乐
- [ ] QQ 音乐
- [ ] Spotify
- [ ] YouTube Music

## 注意事项

1. **版权问题**：接入在线音乐服务需要遵守相关版权规定
2. **API 认证**：大多数在线音乐服务需要 API Key 或用户登录
3. **跨域问题**：在 Electron 中需要正确配置 CORS
4. **音频格式**：确保 HTMLAudioElement 支持返回的音频格式
