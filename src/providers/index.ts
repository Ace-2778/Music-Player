import { MusicProvider } from './types'
import { LocalProvider } from './LocalProvider'
import { MockOnlineProvider } from './MockOnlineProvider'

// Provider 管理器
class ProviderManager {
  private providers: Map<string, MusicProvider> = new Map()
  private activeProvider: MusicProvider | null = null
  
  constructor() {
    // 注册默认 providers
    this.register(new LocalProvider())
    this.register(new MockOnlineProvider())
    
    // 默认使用本地音乐
    this.setActive('local')
  }
  
  register(provider: MusicProvider) {
    this.providers.set(provider.name, provider)
  }
  
  getProvider(name: string): MusicProvider | undefined {
    return this.providers.get(name)
  }
  
  getAllProviders(): MusicProvider[] {
    return Array.from(this.providers.values())
  }
  
  getActive(): MusicProvider | null {
    return this.activeProvider
  }
  
  setActive(name: string): boolean {
    const provider = this.providers.get(name)
    if (provider && provider.isEnabled()) {
      this.activeProvider = provider
      return true
    }
    return false
  }
}

// 单例
export const providerManager = new ProviderManager()

// 导出所有 providers
export { LocalProvider } from './LocalProvider'
export { MockOnlineProvider } from './MockOnlineProvider'
export * from './types'
