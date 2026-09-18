import { requestManager } from '@/services/request.service'
import { getSharedApi } from '@/utils/api'

const THEME_SHORT_NAME = 'GlassmorphismTS'

function cloneThemeSettings(current: Record<string, unknown> | string | null | undefined): Record<string, unknown> {
  if (!current)
    return {}

  if (typeof current === 'string') {
    try {
      return cloneThemeSettings(JSON.parse(current) as Record<string, unknown>)
    }
    catch {
      return {}
    }
  }

  if (typeof current === 'object' && !Array.isArray(current))
    return { ...current }

  return {}
}

/**
 * Komari 的 pingtasks 在库里必须是 JSON 字符串。
 * `/api/public` 会解析成 number[]；如果把数组原样写回，下次解析会得到空任务列表。
 */
function encodePingTaskIds(raw: unknown, fallback: readonly number[]): string {
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0)
        return JSON.stringify(parsed)
    }
    catch {
      return raw
    }
    return raw
  }

  if (Array.isArray(raw) && raw.length > 0)
    return JSON.stringify(raw)

  return JSON.stringify([...fallback])
}

export function mergeThreeNetPingNodeTaskBindings(
  current: Record<string, unknown> | null | undefined,
  bindings: Record<string, number[]>,
  globalTaskIds: readonly number[] = [],
): Record<string, unknown> {
  const settings = cloneThemeSettings(current)
  delete settings.threeNetPingNodeIds
  settings.threeNetPingTaskIds = encodePingTaskIds(settings.threeNetPingTaskIds, globalTaskIds)
  settings.threeNetPingNodeTaskBindings = JSON.stringify(bindings)
  return settings
}

export async function saveGlassmorphismThemeSettings(settings: Record<string, unknown>): Promise<void> {
  await requestManager.run(
    'theme-settings:save',
    signal => getSharedApi().saveThemeSettings(THEME_SHORT_NAME, settings, signal),
    { retryAttempts: 0 },
  )
}
