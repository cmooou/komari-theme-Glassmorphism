import type { MaybeRefOrGetter } from 'vue'
import type { NodePingHistoryPoint } from '@/composables/useNodePingStats'
import { computed, toValue } from 'vue'
import { useNodePingStats } from '@/composables/useNodePingStats'
import { PING_SUMMARY_MAX_COUNT } from '@/constants/load'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/helper'

type NodePingMetric = 'latency' | 'loss'

export interface NodePingBar {
  key: string
  className: string
  tooltip: string
}

interface UseNodePingDisplayOptions {
  enabled?: MaybeRefOrGetter<boolean>
  loadingDisplayText?: string
  emptyDisplayText?: string
  loadingPanelTooltipText?: Partial<Record<NodePingMetric, string>>
  emptyPanelTooltipText?: Partial<Record<NodePingMetric, string>>
}

const EMPTY_PING_BAR_COUNT = 20

function getLatencyToneClass(latency: number): string {
  if (latency <= 60)
    return 'bg-signal-1'
  if (latency <= 100)
    return 'bg-signal-2'
  if (latency <= 160)
    return 'bg-signal-3 ping-signal-pattern-2'
  if (latency <= 200)
    return 'bg-signal-4 ping-signal-pattern-3'
  return 'bg-signal-5 ping-signal-pattern-4'
}

function getLossToneClass(loss: number): string {
  if (loss <= 1)
    return 'bg-signal-1'
  if (loss <= 3)
    return 'bg-signal-2'
  if (loss <= 6)
    return 'bg-signal-3 ping-signal-pattern-2'
  if (loss <= 9)
    return 'bg-signal-4 ping-signal-pattern-3'
  return 'bg-signal-5 ping-signal-pattern-4'
}

export function buildEmptyPingBars(tooltip: string, keyPrefix = 'latency'): NodePingBar[] {
  return Array.from({ length: EMPTY_PING_BAR_COUNT }, (_, index) => ({
    key: `${keyPrefix}-empty-${index}`,
    className: 'bg-muted-foreground/10',
    tooltip,
  }))
}

export function buildLatencyBars(history: NodePingHistoryPoint[]): NodePingBar[] {
  if (!history.length)
    return []

  return history.map((point, index) => ({
    key: `${point.time}-${index}`,
    className: point.latency === null
      ? 'bg-muted-foreground/15'
      : getLatencyToneClass(point.latency),
    tooltip: point.latency === null
      ? `${formatDateTime(point.time, 'HH:mm:ss')}\n无采样数据`
      : `${formatDateTime(point.time, 'HH:mm:ss')}\n${Math.round(point.latency)} ms`,
  }))
}

export function buildLossBars(history: NodePingHistoryPoint[]): NodePingBar[] {
  if (!history.length)
    return []

  return history.map((point, index) => ({
    key: `${point.time}-${index}`,
    className: point.loss === null
      ? 'bg-muted-foreground/15'
      : getLossToneClass(point.loss),
    tooltip: point.loss === null
      ? `${formatDateTime(point.time, 'HH:mm:ss')}\n无采样数据`
      : `${formatDateTime(point.time, 'HH:mm:ss')}\n${point.loss.toFixed(1)}%`,
  }))
}

export function useNodePingDisplay(
  uuid: MaybeRefOrGetter<string>,
  options: UseNodePingDisplayOptions = {},
) {
  const appStore = useAppStore()

  const pingStatsEnabled = computed(() => {
    if (toValue(options.enabled) === false)
      return false
    if (appStore.publicSettings?.record_enabled === false)
      return false
    return appStore.publicSettings?.ping_record_preserve_time !== 0
  })

  const pingStatsHours = computed(() => {
    const preserveTime = appStore.publicSettings?.ping_record_preserve_time
    if (typeof preserveTime === 'number' && preserveTime > 0)
      return Math.min(preserveTime, 1)
    return 1
  })

  const pingStats = useNodePingStats(uuid, {
    hours: pingStatsHours,
    enabled: pingStatsEnabled,
    maxCount: PING_SUMMARY_MAX_COUNT,
  })

  const emptyBarsTooltip = computed(() => {
    if (pingStats.loading.value)
      return '加载中'
    if (pingStats.error.value)
      return '加载失败'
    if (!pingStatsEnabled.value)
      return '未启用记录'
    return '无采样数据'
  })

  const latencyRenderBars = computed(() => {
    const bars = buildLatencyBars(pingStats.history.value)
    return bars.length ? bars : buildEmptyPingBars(emptyBarsTooltip.value, 'latency')
  })

  const lossRenderBars = computed(() => {
    const bars = buildLossBars(pingStats.history.value)
    return bars.length ? bars : buildEmptyPingBars(emptyBarsTooltip.value, 'loss')
  })

  const latencyDisplay = computed(() => {
    if (pingStats.hasData.value)
      return `${Math.round(pingStats.avgLatency.value)} ms`
    if (pingStats.loading.value)
      return options.loadingDisplayText ?? '加载中'
    return options.emptyDisplayText ?? '-'
  })

  const lossDisplay = computed(() => {
    if (pingStats.hasData.value)
      return `${pingStats.avgLoss.value.toFixed(1)}%`
    if (pingStats.loading.value)
      return options.loadingDisplayText ?? '加载中'
    return options.emptyDisplayText ?? '-'
  })

  const latencyPanelTooltip = computed(() => {
    if (!pingStats.hasData.value) {
      if (pingStats.loading.value)
        return options.loadingPanelTooltipText?.latency ?? ''
      return options.emptyPanelTooltipText?.latency ?? ''
    }
    return `平均延迟 ${Math.round(pingStats.avgLatency.value)} ms`
  })

  const lossPanelTooltip = computed(() => {
    if (!pingStats.hasData.value) {
      if (pingStats.loading.value)
        return options.loadingPanelTooltipText?.loss ?? ''
      return options.emptyPanelTooltipText?.loss ?? ''
    }

    const volatility = pingStats.avgVolatility.value > 0
      ? `，平均波动 ${pingStats.avgVolatility.value.toFixed(2)}`
      : ''
    return `平均丢包 ${pingStats.avgLoss.value.toFixed(1)}%${volatility}`
  })

  return {
    records: pingStats.records,
    metricStats: pingStats.metricStats,
    metricLossPoints: pingStats.metricLossPoints,
    loading: pingStats.loading,
    latencyRenderBars,
    lossRenderBars,
    latencyDisplay,
    lossDisplay,
    latencyPanelTooltip,
    lossPanelTooltip,
  }
}
