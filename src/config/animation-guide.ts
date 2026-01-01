/**
 * Framer Motion 动画使用规范
 * 
 * 项目已安装 framer-motion 作为统一动画方案
 * 
 * 1. 基础用法
 * 
 *    import { motion } from 'framer-motion'
 * 
 *    <motion.div
 *      initial={{ opacity: 0, y: 20 }}
 *      animate={{ opacity: 1, y: 0 }}
 *      exit={{ opacity: 0, y: -20 }}
 *      transition={{ duration: 0.3 }}
 *    >
 *      内容
 *    </motion.div>
 * 
 * 2. AnimatePresence（用于进入/退出动画）
 * 
 *    import { motion, AnimatePresence } from 'framer-motion'
 * 
 *    <AnimatePresence>
 *      {show && (
 *        <motion.div
 *          initial={{ opacity: 0 }}
 *          animate={{ opacity: 1 }}
 *          exit={{ opacity: 0 }}
 *        >
 *          内容
 *        </motion.div>
 *      )}
 *    </AnimatePresence>
 * 
 * 3. 常用动画模式
 * 
 *    淡入淡出：
 *    initial={{ opacity: 0 }}
 *    animate={{ opacity: 1 }}
 *    exit={{ opacity: 0 }}
 * 
 *    上滑进入：
 *    initial={{ opacity: 0, y: 20 }}
 *    animate={{ opacity: 1, y: 0 }}
 *    exit={{ opacity: 0, y: -20 }}
 * 
 *    缩放进入：
 *    initial={{ opacity: 0, scale: 0.9 }}
 *    animate={{ opacity: 1, scale: 1 }}
 *    exit={{ opacity: 0, scale: 0.9 }}
 * 
 *    Hover 动画：
 *    whileHover={{ scale: 1.05 }}
 *    whileTap={{ scale: 0.95 }}
 * 
 * 4. 性能优化
 * 
 *    - 使用 transform 和 opacity 属性（GPU 加速）
 *    - 避免动画 width/height（使用 scale 代替）
 *    - 复杂动画使用 variants 组织
 * 
 * 5. Variants（复杂动画）
 * 
 *    const variants = {
 *      hidden: { opacity: 0, y: 20 },
 *      visible: { opacity: 1, y: 0 },
 *      exit: { opacity: 0, y: -20 }
 *    }
 * 
 *    <motion.div
 *      variants={variants}
 *      initial="hidden"
 *      animate="visible"
 *      exit="exit"
 *    />
 * 
 * 6. 布局动画
 * 
 *    <motion.div layout>
 *      内容（位置/大小变化会自动动画）
 *    </motion.div>
 * 
 * 7. 已应用示例
 * 
 *    - LyricsOverlay：淡入淡出 + 上滑动画
 *    - 封面 hover：scale 放大效果（可选）
 * 
 * 8. 注意事项
 * 
 *    - AnimatePresence 必须包裹条件渲染的 motion 组件
 *    - exit 动画需要 AnimatePresence 才能生效
 *    - 避免 CSS transition 与 framer-motion 冲突
 *    - 移除旧的 CSS 动画类（如 .fade-in, .slide-up）
 * 
 * 9. TypeScript 支持
 * 
 *    framer-motion 内置 TypeScript 类型，无需额外配置
 * 
 * 10. 文档链接
 * 
 *     官方文档：https://www.framer.com/motion/
 *     API 参考：https://www.framer.com/motion/component/
 */

export {}
