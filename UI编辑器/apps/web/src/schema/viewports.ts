import type { ViewportPreset } from './types'

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: 'mobile-375', name: '手机 375×812', width: 375, height: 812, category: 'mobile' },
  { id: 'mobile-390', name: 'iPhone 14', width: 390, height: 844, category: 'mobile' },
  { id: 'mobile-414', name: '手机 414×896', width: 414, height: 896, category: 'mobile' },
  { id: 'tablet-768', name: '平板 768×1024', width: 768, height: 1024, category: 'tablet' },
  { id: 'tablet-1024', name: 'iPad 1024×1366', width: 1024, height: 1366, category: 'tablet' },
  { id: 'desktop-1280', name: '桌面 1280×800', width: 1280, height: 800, category: 'desktop' },
  { id: 'desktop-1440', name: '桌面 1440×900', width: 1440, height: 900, category: 'desktop' },
  { id: 'desktop-1920', name: '桌面 1920×1080', width: 1920, height: 1080, category: 'desktop' },
]

export const DEFAULT_VIEWPORT_ID = 'desktop-1920'

export function findViewport(id?: string): ViewportPreset {
  return VIEWPORT_PRESETS.find((v) => v.id === id) ?? VIEWPORT_PRESETS[0]
}

export function matchViewportId(width: number, height: number): string {
  const found = VIEWPORT_PRESETS.find((v) => v.width === width && v.height === height)
  return found?.id ?? 'custom'
}
