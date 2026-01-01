/**
 * 歌词显示配置说明
 * 
 * 1. 配置位置：src/store/playerStore.ts 中的 lyricsOptions
 * 
 * 2. 配置项：
 *    - align: 'left' | 'center' | 'right'  // 歌词对齐方式
 *    - fontFamily: string                   // 字体（如 'Arial', 'PingFang SC' 等）
 *    - fontSize: number                     // 字号（单位 px，默认 16）
 *    - lineHeight: number                   // 行高（倍数，默认 1.8）
 * 
 * 3. 默认值：
 *    {
 *      align: 'left',
 *      fontFamily: 'system-ui, sans-serif',
 *      fontSize: 16,
 *      lineHeight: 1.8
 *    }
 * 
 * 4. 如何修改：
 *    - 临时修改：在代码中调用 setLyricsOptions({ fontSize: 18 })
 *    - 永久修改：未来可添加设置界面，将配置持久化到 electron-store
 * 
 * 5. 扩展接口：
 *    - setLyricsOptions 支持部分更新（Partial<LyricsDisplayOptions>）
 *    - 可在此基础上添加更多配置项（如颜色、背景、动画速度等）
 * 
 * 6. 持久化预留：
 *    - 可在主进程添加 IPC handlers：save-lyrics-options / get-lyrics-options
 *    - 可在 App 启动时自动加载保存的配置
 * 
 * 示例用法：
 * 
 *   // 在组件中修改配置
 *   const { setLyricsOptions } = usePlayerStore()
 *   
 *   // 修改对齐方式
 *   setLyricsOptions({ align: 'center' })
 *   
 *   // 修改字体大小
 *   setLyricsOptions({ fontSize: 18 })
 *   
 *   // 修改多个属性
 *   setLyricsOptions({ 
 *     fontSize: 20, 
 *     lineHeight: 2.0,
 *     fontFamily: 'PingFang SC, sans-serif'
 *   })
 */

export {}
