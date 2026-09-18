import type { MaybeRefOrGetter } from 'vue'
import type { NodePingBar } from '@/composables/useNodePingDisplay'
import type { PingMetricLossPoint, PingRecord } from '@/composables/useNodePingStats'
import type { NodeData } from '@/stores/nodes'
import type { NodeStatusPing, PingMetricTaskStats } from '@/utils/rpc'
import { computed, toValue } from 'vue'
import {
  buildEmptyPingBars,
  buildLatencyBars,
  buildLossBars,
  getLatencyToneDotClass,
  getLatencyToneTextClass,
  getLossToneTextClass,
} from '@/composables/useNodePingDisplay'
import { buildPingStatsForTask } from '@/composables/useNodePingStats'
import { useAppStore } from '@/stores/app'

const ISP_LABELS = [
  { test: /电信|telecom|\bct\b/i, label: '电信' },
  { test: /联通|unicom|\bcu\b/i, label: '联通' },
  { test: /移动|mobile|cmcc|\bcm\b/i, label: '移动' },
  { test: /教育|cernet/i, label: '教育' },
] as const

interface ThreeNetPingItem {
  id: number
  label: string
  fullName: string
  latencyDisplay: string
  lossDisplay: string
  latencyTooltip: string
  lossTooltip: string
  latencyBars: NodePingBar[]
  lossBars: NodePingBar[]
  latencyPoints: Array<number | null>
  latencyToneClass: string
  lossToneClass: string
  dotClass: string
}

interface UseThreeNetPingOptions {
  records?: MaybeRefOrGetter<readonly PingRecord[]>
  metricStats?: MaybeRefOrGetter<readonly PingMetricTaskStats[] | undefined>
  metricLossPoints?: MaybeRefOrGetter<readonly PingMetricLossPoint[] | undefined>
  loading?: MaybeRefOrGetter<boolean>
}

function ispShortLabel(value: string): string | undefined {
  return ISP_LABELS.find(item => item.test.test(value))?.label
}

const PING_TASK_SEPARATOR_RE = /[-_/|：:\s]+/
const TRAILING_REGION_SUFFIX_RE = /[省市]$/
const IP_VERSION_SUFFIX_RE = /(?:ipv|v)([46])\b/i

function shortenPingTaskName(name: string, fallback: string): string {
  const trimmed = name.trim()
  if (!trimmed)
    return fallback

  const ipVersionMatch = trimmed.match(IP_VERSION_SUFFIX_RE)
  const ipVersion = ipVersionMatch ? `v${ipVersionMatch[1]}` : ''
  const normalizedName = trimmed.replace(IP_VERSION_SUFFIX_RE, '').trim()
  const parts = normalizedName.split(PING_TASK_SEPARATOR_RE).map(part => part.trim()).filter(Boolean)
  const withIpVersion = (label: string) => `${label}${ipVersion}`
  if (parts.length >= 2) {
    const ispPart = parts.at(-1) ?? ''
    const isp = ispShortLabel(ispPart)
    if (isp) {
      const region = parts.slice(0, -1).join('').replace(TRAILING_REGION_SUFFIX_RE, '').trim()
      return withIpVersion(region ? `${region}${isp}` : isp)
    }
  }

  const ispOnly = ispShortLabel(normalizedName)
  if (ispOnly)
    return withIpVersion(ispOnly)

  const tail = parts.at(-1)
  if (tail && tail.length <= 6)
    return withIpVersion(tail)

  const shortened = normalizedName.length > 6 ? `${normalizedName.slice(0, 6)}…` : normalizedName
  return withIpVersion(shortened || fallback)
}

function readPingSample(ping: NodeData['ping'], taskId: number): NodeStatusPing | undefined {
  if (!ping)
    return undefined
  return ping[String(taskId)]
}

function taskNameFromStats(metricStats: readonly PingMetricTaskStats[] | undefined, taskId: number): string {
  const match = metricStats?.find(stat => Number(stat.task_id) === taskId)
  return match?.name?.trim() || ''
}

export function useThreeNetPing(node: MaybeRefOrGetter<NodeData>, options: UseThreeNetPingOptions = {}) {
  const appStore = useAppStore()

  const taskIds = computed(() => {
    const binding = appStore.threeNetPingNodeTaskBindings[toValue(node).uuid]
    return binding?.length ? [...binding] : [...appStore.threeNetPingTaskIds]
  })
  const visible = computed(() => appStore.threeNetPingEnabled && taskIds.value.length > 0)

  const historyItems = computed(() => {
    if (!visible.value)
      return []

    const records = toValue(options.records) ?? []
    const metricStats = toValue(options.metricStats)
    const metricLossPoints = toValue(options.metricLossPoints)
    const loading = toValue(options.loading) === true

    return taskIds.value.map((id) => {
      const stats = buildPingStatsForTask(records, id, metricStats, metricLossPoints)
      const fullName = taskNameFromStats(metricStats, id) || `任务 ${id}`
      const emptyTooltip = loading ? '加载中' : `${fullName}\n暂无探测数据`
      const latencyHistoryBars = buildLatencyBars(stats.history)
      const lossHistoryBars = buildLossBars(stats.history)

      return {
        id,
        statsFullName: fullName,
        stats,
        loading,
        latencyPoints: stats.history.map(point => point.latency),
        latencyBars: latencyHistoryBars.length
          ? latencyHistoryBars
          : buildEmptyPingBars(emptyTooltip, `task-${id}-latency`),
        lossBars: lossHistoryBars.length
          ? lossHistoryBars
          : buildEmptyPingBars(emptyTooltip, `task-${id}-loss`),
      }
    })
  })

  const items = computed<ThreeNetPingItem[]>(() => {
    if (!visible.value)
      return []

    const current = toValue(node)

    return historyItems.value.map((item) => {
      const sample = readPingSample(current.ping, item.id)
      const stats = item.stats
      const fullName = sample?.name?.trim() || item.statsFullName
      const latest = sample && Number.isFinite(sample.latest) ? sample.latest : null
      const lost = latest !== null && latest < 0
      const displayLatency = latest !== null && !lost
        ? latest
        : stats.hasData
          ? stats.avgLatency
          : null
      const lossValue = sample && Number.isFinite(sample.loss)
        ? sample.loss
        : stats.hasData
          ? stats.avgLoss
          : null

      return {
        id: item.id,
        label: shortenPingTaskName(fullName, `#${item.id}`),
        fullName,
        latencyDisplay: latest === null && !stats.hasData
          ? (item.loading ? '加载中' : '-')
          : lost
            ? '丢包'
            : `${Math.round(displayLatency ?? 0)} ms`,
        lossDisplay: lossValue === null
          ? (item.loading ? '加载中' : '-')
          : `${lossValue.toFixed(1)}%`,
        latencyTooltip: latest === null && !stats.hasData
          ? `${fullName}\n暂无探测数据`
          : lost
            ? `${fullName}\n最近一次探测丢包`
            : `${fullName}\n延迟 ${Math.round(displayLatency ?? 0)} ms`,
        lossTooltip: lossValue === null
          ? `${fullName}\n暂无探测数据`
          : sample && Number.isFinite(sample.loss)
            ? `${fullName}\n丢包 ${lossValue.toFixed(1)}%`
            : `${fullName}\n平均丢包 ${lossValue.toFixed(1)}%`,
        latencyBars: item.latencyBars,
        lossBars: item.lossBars,
        latencyPoints: item.latencyPoints,
        latencyToneClass: lost
          ? 'text-signal-5'
          : displayLatency === null
            ? 'text-muted-foreground'
            : getLatencyToneTextClass(displayLatency),
        lossToneClass: lossValue === null
          ? 'text-muted-foreground'
          : getLossToneTextClass(lossValue),
        dotClass: lost
          ? 'bg-signal-5'
          : displayLatency === null
            ? 'bg-muted-foreground/40'
            : getLatencyToneDotClass(displayLatency),
      }
    })
  })

  return {
    visible,
    items,
  }
}
