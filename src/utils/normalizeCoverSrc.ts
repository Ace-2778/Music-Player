/**
 * 标准化封面 URL，防止 data URL 重复拼接
 * 
 * @param src - 封面 URL 或 base64 字符串
 * @returns 标准化后的 URL，失败返回 null
 * 
 * 规则：
 * - 如果已经是完整 URL（http/https/file/data），直接返回
 * - 如果是纯 base64（不含前缀），补上 data:image/jpeg;base64, 前缀
 * - null/undefined 返回 null
 */
export function normalizeCoverSrc(src: string | null | undefined): string | null {
  if (!src) return null
  
  const trimmed = src.trim()
  
  // 已经是完整 URL，直接返回
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }
  
  // 纯 base64，补上前缀
  // 检测是否像 base64（只包含字母数字和 +/= 字符）
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`
  }
  
  // 其他情况返回 null（无效）
  console.warn('⚠️ [normalizeCoverSrc] 无法识别的封面格式:', trimmed.substring(0, 80))
  return null
}
