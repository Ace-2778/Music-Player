import { LyricsLine } from '../types/lyrics'

/**
 * 解析 LRC 格式歌词
 * 支持：[mm:ss]、[mm:ss.xx]、[mm:ss.xxx]
 * 支持同一行多个时间戳
 * 忽略 meta 标签：[ti:], [ar:], [al:], [by:], [offset:] 等
 */
export function parseLRC(raw: string): LyricsLine[] {
  const lines: LyricsLine[] = []
  const rawLines = raw.split('\n')

  // LRC 时间戳正则：[mm:ss.xx] 或 [mm:ss]
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/g

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    // 忽略 meta 标签
    if (/^\[(ti|ar|al|by|offset):/i.test(trimmed)) {
      continue
    }

    // 提取所有时间戳
    const timestamps: number[] = []
    let match: RegExpExecArray | null

    // 重置正则
    timeRegex.lastIndex = 0

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0

      const timeMs = (minutes * 60 + seconds) * 1000 + milliseconds
      timestamps.push(timeMs)
    }

    // 提取文本（移除所有时间戳）
    const text = trimmed.replace(timeRegex, '').trim()

    // 如果有时间戳，每个时间戳生成一条 line
    if (timestamps.length > 0) {
      for (const timeMs of timestamps) {
        lines.push({ timeMs, text })
      }
    } else {
      // 没有时间戳，当作普通文本
      if (text) {
        lines.push({ text })
      }
    }
  }

  // 按 timeMs 升序排序（没有 timeMs 的排在最后）
  lines.sort((a, b) => {
    if (a.timeMs === undefined && b.timeMs === undefined) return 0
    if (a.timeMs === undefined) return 1
    if (b.timeMs === undefined) return -1
    return a.timeMs - b.timeMs
  })

  return lines
}

/**
 * 将纯文本按换行拆分为 lines
 */
export function toPlainLines(raw: string): LyricsLine[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(text => ({ text }))
}

/**
 * 检测是否为 LRC 格式（包含时间戳）
 */
export function isLRCFormat(raw: string): boolean {
  return /\[\d+:\d+(?:\.\d+)?\]/.test(raw)
}
