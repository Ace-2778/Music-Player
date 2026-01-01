# 🎵 Music Player

一个基于 Electron + React 的现代化本地音乐播放器，支持在线歌词同步、专辑封面显示和智能音乐管理。

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ 核心功能

### 🎼 音乐播放
- **完整播放控制**：播放/暂停、上一曲/下一曲、进度条拖拽、音量调节
- **音频元数据解析**：自动读取音频文件的标题、艺术家、专辑、时长信息
- **文件夹扫描**：递归扫描音乐文件夹，支持 MP3、FLAC、WAV 等主流格式
- **持久化配置**：音量设置自动保存，下次启动恢复

### 🎨 现代化 UI
- **极简设计**：精心打磨的界面，专注于内容呈现
- **响应式布局**：最小窗口尺寸 1100x700，适配不同屏幕
- **专辑封面**：
  - 优先显示音频文件内嵌封面
  - 自动从 iTunes API 搜索在线封面
  - 封面缓存机制，减少网络请求
  - ⚠️ **搜索精准度有限**：基于歌曲标题和艺术家进行模糊匹配，部分歌曲可能无法找到封面或匹配到错误的专辑封面

### 📖 在线歌词同步
- **LRC 格式支持**：精确到毫秒的时间戳同步
- **在线歌词获取**：
  - 主源：LRCLIB（优先，支持 LRC 格式）
  - 备用源：lyrics.ovh（纯文本）
  - 8秒超时 + 竞态控制，保证响应速度
  - ⚠️ **搜索精准度有限**：由于依赖第三方 API 和模糊匹配算法，部分歌曲可能无法找到歌词或匹配到错误的歌词
- **智能歌词显示**：
  - 当前行高亮 + 自动居中滚动
  - 二分查找算法（O(log n)）优化性能
  - 点击歌词行跳转播放时间
  - 支持纯文本歌词手动滚动
- **字号自定义**：
  - 右键菜单快速调整（12-28px）
  - 快捷键支持：`Ctrl +` 增大、`Ctrl -` 减小、`Ctrl 0` 重置
  - 字号持久化，重启保持

### 🎯 交互体验
- **搜索功能**：实时搜索标题/艺术家
- **排序功能**：按标题/艺术家排序
- **键盘快捷键**：
  - `Space`：播放/暂停
  - `↑/↓`：音量 ±5
  - `ESC`：关闭歌词页
  - `Ctrl +/-/0`：歌词字号调整（歌词页内）
- **覆盖层歌词**：
  - 点击专辑封面打开全屏歌词页
  - 左侧封面展示 + 右侧歌词滚动
  - 点击遮罩或按 ESC 关闭

## 🏗️ 技术架构

### 前端技术栈
- **Electron 30.0.1**：跨平台桌面应用框架
- **React 18.2.0**：UI 构建
- **TypeScript**：类型安全
- **Zustand 5.0.9**：轻量级状态管理
- **Framer Motion 12.23.26**：流畅动画效果
- **Vite**：快速开发构建工具

### 核心库
- **music-metadata 11.10.3**：音频元数据解析
- **electron-store 11.0.2**：配置持久化存储

### 架构特点
- **安全 IPC 通信**：`contextIsolation: true` + `nodeIntegration: false`
- **Provider 架构**：可扩展的音乐源管理（本地/在线/Mock）
- **LRC 解析器**：支持多时间戳、毫秒精度解析
- **智能搜索管线**：
  - 统一的 SearchPlan 架构（normalize → plan → scoring → cache）
  - 多维度评分系统（标题、艺术家、专辑、时长）
  - Token Overlap (40%) + Levenshtein 编辑距离 (60%) 混合算法
- **封面搜索优化**：
  - iTunes API 专辑优先策略（entity=album → entity=song）
  - albumTracks 步骤：专辑曲目列表精确匹配
  - 关键词清洗与规范化
  - 封面 URL 质量提升（600x600）
- **缓存策略**：
  - 专辑封面 URL 缓存（electron-store）
  - 歌词结果缓存（内存缓存 + 竞态控制）
  - 失败缓存（TTL 10分钟，避免重复请求）

## 🚀 快速开始

### 环境要求
- Node.js 16+ 
- npm 或 yarn

### 安装依赖
```bash
npm install
# 或
yarn install
```

### 开发模式
```bash
npm run dev
```
应用会在开发模式下启动，支持热重载。

### 构建打包
```bash
npm run build
```
会生成对应平台的可执行文件。

## 📁 项目结构

```
Music-Player/
├── electron/                 # Electron 主进程
│   ├── main.ts              # 主进程入口，IPC 处理
│   └── preload.ts           # 预加载脚本，安全桥接
├── src/
│   ├── components/          # React 组件
│   │   ├── TopBar.tsx       # 顶部栏（搜索/排序）
│   │   ├── TrackList.tsx    # 曲目列表
│   │   ├── PlayerBar.tsx    # 底部播放器
│   │   └── LyricsOverlay.tsx # 歌词覆盖层
│   ├── store/
│   │   └── playerStore.ts   # Zustand 状态管理
│   ├── providers/           # 音乐源 Provider
│   │   ├── LocalProvider.ts
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── lyricsService.ts    # 在线歌词获取
│   │   ├── lrcParser.ts        # LRC 格式解析
│   │   ├── coverSearch.ts      # 封面搜索（iTunes API）
│   │   ├── scoringSystem.ts    # 多维度评分系统
│   │   ├── normalizeTrackInfo.ts # 曲目信息标准化
│   │   ├── searchPlan.ts       # 搜索计划生成与执行
│   │   └── normalizeCoverSrc.ts # 封面 URL 标准化
│   └── types/               # TypeScript 类型定义
│       └── lyrics.ts
├── dist/                    # 构建输出（前端）
├── dist-electron/           # 构建输出（Electron）
└── package.json
```

## 🎮 使用指南

> **💡 推荐窗口尺寸**：建议使用最小窗口尺寸（1100x700）运行应用以获得最佳视觉效果。过大的窗口尺寸可能导致界面元素分布不均，影响使用体验。

### 1. 添加音乐
点击 **"选择文件夹"** 按钮，选择包含音乐文件的文件夹。应用会自动扫描并导入所有支持的音频文件。

### 2. 播放音乐
- 点击曲目列表中的任意歌曲开始播放
- 使用底部播放器控制播放/暂停、切歌、调节音量
- 拖动进度条跳转到指定位置

### 3. 查看歌词
- 点击底部播放器左侧的专辑封面打开歌词页
- 歌词会自动同步高亮当前播放的行
- 点击歌词行可跳转到对应时间点
- 右键歌词区域调整字号

### 4. 快捷键
- **空格**：播放/暂停
- **方向键上/下**：音量增减
- **ESC**：关闭歌词页
- **Ctrl +**：增大歌词字号
- **Ctrl -**：减小歌词字号
- **Ctrl 0**：重置歌词字号

## 🔧 配置说明

应用配置通过 `electron-store` 持久化存储在：
- Windows: `%APPDATA%/music-player/config.json`
- macOS: `~/Library/Application Support/music-player/config.json`
- Linux: `~/.config/music-player/config.json`

### 配置项
```json
{
  "volume": 80,                    // 音量（0-100）
  "trackCovers": {},               // 封面 URL 缓存
  "lyricsOptions": {               // 歌词显示选项
    "align": "left",
    "fontFamily": "system-ui, sans-serif",
    "fontSize": 20,
    "lineHeight": 1.8
  }
}
```

## 🎯 核心功能实现

### 多维度评分系统
实现智能的模糊匹配算法，用于从多个候选结果中选择最佳匹配项：

```typescript
// 评分维度与权重
const weights = {
  title: 0.5,    // 标题权重 50%
  artist: 0.3,   // 艺术家权重 30%
  album: 0.1,    // 专辑权重 10%
  duration: 0.1  // 时长权重 10%
}

// 混合相似度算法
function stringSimilarity(str1: string, str2: string): number {
  const tokenOverlap = calculateTokenOverlap(str1, str2)  // 40%
  const levenshtein = 1 - (levenshteinDistance(str1, str2) / maxLength)  // 60%
  return tokenOverlap * 0.4 + levenshtein * 0.6
}
```

**特点**：
- Token 分词匹配（处理顺序差异）
- Levenshtein 编辑距离（处理拼写差异）
- 时长容差 ±10 秒匹配
- 评分阈值 50-55 分（过滤低质量结果）

### 封面搜索策略
iTunes API 专辑优先 + 单曲兜底的多步骤搜索：

```typescript
// 搜索步骤
1. iTunes 专辑搜索 (entity=album)
   → 专辑评分 > 55 分
   → 执行 albumTracks 步骤（曲目列表匹配）
   
2. albumTracks 精确匹配
   → 在专辑曲目中查找当前歌曲
   → 评分 > 50 分即采用专辑封面
   
3. iTunes 单曲兜底 (entity=song)
   → 评分 > 50 分
   
4. 失败缓存 10 分钟
   → 避免重复请求无效资源
```

**优化点**：
- 关键词清洗（移除 feat.、remaster 等干扰词）
- 封面 URL 正则提升（100x100 → 600x600）
- 超时控制 8 秒
- 失败缓存机制

### 歌词同步算法
使用二分查找在 O(log n) 时间复杂度内找到当前播放时间对应的歌词行：

```typescript
const getActiveLyricIndex = (lines: LyricsLine[], currentTimeMs: number) => {
  let left = 0, right = lines.length - 1, result = -1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (lines[mid].timeMs <= currentTimeMs) {
      result = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  return result
}
```

### 在线歌词获取策略
1. 优先从 LRCLIB 获取带时间戳的 LRC 格式歌词
2. 若失败，从 lyrics.ovh 获取纯文本歌词
3. 内存缓存 + 请求 ID 防止竞态条件
4. 8 秒超时保证响应速度

### 安全的 IPC 通信
使用 contextBridge 在主进程和渲染进程间安全通信：

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  scanMusicFolder: (path) => ipcRenderer.invoke('scan-music-folder', path),
  getLyricsOptions: () => ipcRenderer.invoke('get-lyrics-options'),
  // ...
})
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发建议
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 待实现功能
- [ ] 播放列表管理（创建/编辑/删除）
- [ ] 播放历史记录
- [ ] 音乐标签编辑
- [ ] 均衡器支持
- [ ] 主题自定义
- [ ] macOS/Lin
- [ ] 优化歌词搜索算法，提升匹配精准度
- [ ] 优化封面搜索算法，提升匹配精准度
- [ ] 支持手动选择/上传封面和歌词ux 平台测试和优化
- [ ] 更多在线音乐源支持

## 📄 开源协议

MIT License

---

**⭐ 如果觉得这个项目不错，请给个 Star 支持一下！**
