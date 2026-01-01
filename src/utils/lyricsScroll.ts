import { LyricsLine } from '../types/lyrics'

/**
 * 根据当前播放时间获取活跃歌词的索引
 * 
 * 规则：找到最后一个 timeMs <= currentTimeMs 的行
 * 如果没有时间戳，返回 -1
 * 
 * @param lines 歌词行数组
 * @param currentTimeMs 当前播放时间（毫秒）
 * @returns 活跃歌词索引，如果没有匹配或无时间戳返回 -1
 */
export function getActiveLyricIndex(
  lines: LyricsLine[],
  currentTimeMs: number
): number {
  if (!lines || lines.length === 0) return -1

  // 检查是否有时间戳
  const hasTimestamps = lines.some(line => line.timeMs !== undefined)
  if (!hasTimestamps) return -1

  let activeIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 跳过没有时间戳的行
    if (line.timeMs === undefined) continue

    // 如果当前行时间 <= 播放时间，更新活跃索引
    if (line.timeMs <= currentTimeMs) {
      activeIndex = i
    } else {
      // 后续行时间更大，停止查找
      break
    }
  }

  return activeIndex
}

/**
 * 预留：滚动到活跃歌词（供后续实现）
 * 
 * @param containerRef 歌词容器 ref
 * @param activeIndex 活跃歌词索引
 * @param offset 偏移量（可选，默认居中）
 */
export function scrollToActiveLyric(
  containerRef: HTMLElement | null,
  activeIndex: number,
  offset: 'top' | 'center' | 'bottom' = 'center'
): void {
  if (!containerRef || activeIndex < 0) return

  const activeElement = containerRef.children[activeIndex] as HTMLElement
  if (!activeElement) return

  // 计算滚动位置
  let scrollTop: number

  switch (offset) {
    case 'top':
      scrollTop = activeElement.offsetTop
      break
    case 'bottom':
      scrollTop = activeElement.offsetTop - containerRef.clientHeight + activeElement.clientHeight
      break
    case 'center':
    default:
      scrollTop = activeElement.offsetTop - containerRef.clientHeight / 2 + activeElement.clientHeight / 2
      break
  }

  // 平滑滚动
  containerRef.scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  })
}
