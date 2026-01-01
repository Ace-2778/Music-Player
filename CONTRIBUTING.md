# 贡献指南

感谢您考虑为 Music Player 项目做出贡献！

## 🚀 如何贡献

### 报告 Bug
如果您发现了 bug，请创建一个 Issue，包含以下信息：
- 清晰的标题和描述
- 复现步骤
- 期望行为 vs 实际行为
- 截图（如果适用）
- 操作系统和版本
- Node.js 和 Electron 版本

### 功能建议
欢迎提出新功能建议！请在 Issue 中：
- 描述功能的用途和价值
- 说明实现思路（可选）
- 提供参考案例（可选）

### Pull Request 流程

1. **Fork 并克隆仓库**
   ```bash
   git clone https://github.com/your-username/music-player.git
   cd music-player
   npm install
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **编写代码**
   - 遵循现有代码风格
   - 确保 TypeScript 类型安全
   - 添加必要的注释

4. **测试更改**
   ```bash
   npm run dev  # 开发模式测试
   npm run build  # 构建测试
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add some amazing feature"
   ```
   
   提交信息格式建议：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `style:` 代码格式调整
   - `refactor:` 代码重构
   - `perf:` 性能优化
   - `test:` 测试相关

6. **推送到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 在 GitHub 上打开 PR
   - 填写 PR 模板（描述、相关 Issue 等）
   - 等待代码审查

## 📋 开发规范

### 代码风格
- 使用 TypeScript 严格模式
- 使用 ESLint 进行代码检查
- 组件使用函数式写法 + Hooks
- 遵循 React 最佳实践

### 命名规范
- 组件文件：PascalCase（如 `PlayerBar.tsx`）
- 工具函数：camelCase（如 `lyricsService.ts`）
- 常量：UPPER_SNAKE_CASE（如 `FONT_SIZE_MAX`）
- CSS 类名：kebab-case（如 `lyrics-line-active`）

### 文件组织
- 组件放在 `src/components/`
- 工具函数放在 `src/utils/`
- 类型定义放在 `src/types/`
- 样式文件与组件同目录

### 提交前检查
- [ ] 代码通过 ESLint 检查
- [ ] TypeScript 编译无错误
- [ ] 功能在开发模式下测试通过
- [ ] 没有 console.log 等调试代码（除非必要）
- [ ] 更新了相关文档

## 🎯 重点开发方向

当前项目欢迎以下方向的贡献：

### 高优先级
- macOS 和 Linux 平台适配和测试
- 播放列表管理功能
- 音乐库搜索优化（模糊匹配、拼音搜索）
- 性能优化（大量曲目加载）

### 中优先级
- 均衡器支持
- 主题系统（深色模式、自定义主题）
- 快捷键自定义
- 音频格式支持扩展

### 低优先级
- 音乐标签编辑
- 在线电台支持
- 可视化效果
- 社交功能

## 💬 讨论

- 对于重大功能或架构变更，请先创建 Issue 讨论
- 加入项目讨论，分享您的想法和建议
- 尊重他人，保持友好和专业

## 📄 许可

提交代码即表示您同意在 MIT 许可下开源您的贡献。

---

再次感谢您的贡献！🎉
