<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { ProgressThin } from '@/components/ui/progress-thin'
import { Sparkline } from '@/components/ui/sparkline'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useThreeNetPing } from '@/composables/useThreeNetPing'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, getStatus, getUptimeDays } from '@/utils/helper'
import { getDiskPercentage, getMemoryPercentage, getTrafficUsed, getTrafficUsedPercentage, hasTrafficLimit } from '@/utils/nodeMetricsHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatCurrencyValue, formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, getRemainingValue, isFreePrice, parseTags } from '@/utils/tagHelper'

const props = withDefaults(defineProps<{
  node: NodeData
  reduceMotion?: boolean
  pingEnabled?: boolean
}>(), {
  reduceMotion: false,
  pingEnabled: true,
})
const emit = defineEmits<{
  click: []
  pingClick: []
}>()
const appStore = useAppStore()
const isFavorite = computed(() => appStore.isFavoriteNode(props.node.uuid))

function toggleFavorite(): void {
  appStore.toggleFavoriteNode(props.node.uuid)
}

function handleKeyboardOpen(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  emit('click')
}

interface RemainingInfoTag {
  icon: string
  text?: string
  prefix?: string
  value?: string
  unit?: string
  className?: string
}

const NODE_METRIC_ICONS = {
  cpu: 'tabler:cpu',
  memory: 'icon-park-outline:memory',
  disk: 'tabler:server-2',
  traffic: 'tabler:arrows-transfer-up-down',
} as const

const isMiniNodeCard = computed(() => appStore.nodeCardSize === 'mini')
const nodeCardXSize = computed(() => appStore.nodeCardSize === 'large' ? 'large' : 'medium')
const nodeCardContentClass = computed(() => appStore.nodeCardSize === 'large' ? 'gap-4' : isMiniNodeCard.value ? 'gap-2' : 'gap-3')
const nodeCardContentPaddingClass = computed(() => isMiniNodeCard.value ? 'pb-2' : '')
const nodeCardMetricGridClass = 'grid-cols-3'
const nodeCardMetricBoxClass = computed(() => isMiniNodeCard.value
  ? 'px-1 py-1'
  : appStore.nodeCardSize === 'compact' ? 'px-1.5 py-1.5' : 'px-2 py-1.5')
const nodeCardPanelClass = computed(() => appStore.nodeCardSize === 'large' ? 'h-14' : appStore.nodeCardSize === 'comfortable' ? 'h-12' : isMiniNodeCard.value ? 'h-7' : 'h-11')
const nodeCardPingPanelClass = computed(() => isMiniNodeCard.value ? 'gap-1 p-1' : 'gap-1.5 p-2')
const nodeCardPingTextClass = computed(() => isMiniNodeCard.value ? 'text-[10px]' : 'text-[11px]')
const pingSparklineStyle = computed(() => appStore.threeNetPingSparkline)

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const offlineTime = computed(() => formatDateTime(props.node.time))

const cpuStatus = computed(() => getStatus(props.node.cpu ?? 0))
const memPercentage = computed(() => getMemoryPercentage(props.node))
const memStatus = computed(() => getStatus(memPercentage.value))
const swapTooltip = computed(() => {
  const used = formatBytes(Math.max(0, props.node.swap ?? 0))
  const total = Math.max(0, props.node.swap_total ?? 0)
  return total > 0 ? `Swap 已用 ${used} / 总计 ${formatBytes(total)}` : `Swap 已用 ${used}`
})
const diskPercentage = computed(() => getDiskPercentage(props.node))
const diskStatus = computed(() => getStatus(diskPercentage.value))

const {
  latencyRenderBars,
  lossRenderBars,
  latencyPoints,
  latencyDisplay,
  lossDisplay,
  latencyPanelTooltip,
  lossPanelTooltip,
  latencyToneClass,
  latencyDotClass,
  lossToneClass,
  records,
  metricStats,
  metricLossPoints,
  loading,
} = useNodePingDisplay(() => props.node.uuid, { enabled: () => props.pingEnabled })
const { visible: threeNetPingVisible, items: threeNetPingItems } = useThreeNetPing(() => props.node, {
  records,
  metricStats,
  metricLossPoints,
  loading,
})

const pingPanelRows = computed(() => {
  if (threeNetPingVisible.value) {
    return threeNetPingItems.value.map(item => ({
      key: `task-${item.id}`,
      sparklineAttr: `task-${item.id}`,
      lossAttr: `task-${item.id}`,
      label: item.label,
      latencyLabel: item.label,
      latencyDisplay: item.latencyDisplay,
      latencyTooltip: item.latencyTooltip,
      latencyAria: `${props.node.name} ${item.fullName} 延迟`,
      latencyBars: item.latencyBars,
      latencyBarsAttr: `task-${item.id}-latency`,
      lossLabel: '丢包',
      lossDisplay: item.lossDisplay,
      lossTooltip: item.lossTooltip,
      lossAria: `${props.node.name} ${item.fullName} 丢包`,
      lossBars: item.lossBars,
      lossBarsAttr: `task-${item.id}-loss`,
      ariaLabel: `${props.node.name} ${item.fullName} 延迟和丢包`,
      latencyPoints: item.latencyPoints,
      latencyToneClass: item.latencyToneClass,
      lossToneClass: item.lossToneClass,
      dotClass: item.dotClass,
    }))
  }

  return [{
    key: 'summary',
    sparklineAttr: 'latency',
    lossAttr: 'loss',
    label: '延迟',
    latencyLabel: '延迟',
    latencyDisplay: latencyDisplay.value,
    latencyTooltip: latencyPanelTooltip.value,
    latencyAria: `${props.node.name} 延迟监测`,
    latencyBars: latencyRenderBars.value,
    latencyBarsAttr: 'latency',
    lossLabel: '丢包',
    lossDisplay: lossDisplay.value,
    lossTooltip: lossPanelTooltip.value,
    lossAria: `${props.node.name} 丢包监测`,
    lossBars: lossRenderBars.value,
    lossBarsAttr: 'loss',
    ariaLabel: `${props.node.name} 延迟和丢包监测`,
    latencyPoints: latencyPoints.value,
    latencyToneClass: latencyToneClass.value,
    lossToneClass: lossToneClass.value,
    dotClass: latencyDotClass.value,
  }]
})

const trafficUsedPercentage = computed(() => getTrafficUsedPercentage(props.node))
const trafficUsed = computed(() => getTrafficUsed(props.node))
const nodeMessage = computed(() => props.node.message?.trim() ?? '')
const nodeMessageTooltip = computed(() => {
  const message = nodeMessage.value
  if (!message)
    return ''
  const updatedAt = props.node.status_updated_at ? `\n更新时间：${formatDateTime(props.node.status_updated_at)}` : ''
  return `${message}${updatedAt}`
})

// 流量状态颜色
const trafficStatus = computed(() => {
  if (!hasTrafficLimit(props.node))
    return 'success'
  if (trafficUsedPercentage.value >= 95)
    return 'error'
  if (trafficUsedPercentage.value >= 80)
    return 'warning'
  if (trafficUsedPercentage.value >= 60)
    return 'info'
  return 'success'
})

const trafficPercentageClass = computed(() => {
  if (!hasTrafficLimit(props.node))
    return 'text-muted-foreground'
  if (trafficUsedPercentage.value >= 95)
    return 'text-destructive'
  if (trafficUsedPercentage.value >= 80)
    return 'text-warning'
  if (trafficUsedPercentage.value >= 60)
    return 'text-warning'
  return 'text-success'
})

// 是否显示金额：未登录且开启「未登录隐藏价格」时不显示价格 / 剩余价值，
// 但在线天数、剩余天数等非金额信息仍然展示
const showPrice = computed(() => appStore.privateFeaturesAllowed || !appStore.hidePriceWhenLoggedOut)

const uptimeDaysText = computed(() => {
  const days = getUptimeDays(props.node.uptime)
  return appStore.lang === 'zh-CN' ? `在线 ${days} 天` : `${days} days online`
})

const priceText = computed(() => {
  const node = props.node
  if (node.price === 0 || !showPrice.value)
    return ''
  return formatPriceWithCycle(node.price, node.billing_cycle, node.currency, appStore.lang)
})

// 第三列：剩余天数（始终） + 剩余价值（仅在允许显示金额时），带图标与相邻列对齐
const remainingInfoTags = computed<RemainingInfoTag[]>(() => {
  const node = props.node
  if (node.price === 0)
    return []
  const lang = appStore.lang
  const days = getDaysUntilExpired(node.expired_at)
  const status = getExpireStatus(node.expired_at)
  const items: RemainingInfoTag[] = []
  const expiryClass = status === 'expired' || status === 'critical'
    ? 'text-destructive'
    : status === 'warning' ? 'text-warning' : 'text-muted-foreground'

  if (status === 'unknown') {
    items.push({ icon: 'tabler:calendar-stats', text: '-', className: expiryClass })
  }
  else if (status === 'expired') {
    items.push({ icon: 'tabler:calendar-stats', text: lang === 'zh-CN' ? '已过期' : 'Expired', className: expiryClass })
  }
  else if (status === 'long_term') {
    items.push({ icon: 'tabler:calendar-stats', text: lang === 'zh-CN' ? '长期' : 'Long-term', className: expiryClass })
  }
  else if (lang === 'zh-CN') {
    items.push({ icon: 'tabler:calendar-stats', prefix: '剩余', value: String(days), unit: '天', className: expiryClass })
  }
  else {
    items.push({ icon: 'tabler:calendar-stats', prefix: 'left', value: String(days), unit: 'days', className: expiryClass })
  }

  if (showPrice.value) {
    const text = isFreePrice(node.price)
      ? lang === 'zh-CN' ? '无' : 'N/A'
      : formatCurrencyValue(getRemainingValue(node.price, node.billing_cycle, node.expired_at), node.currency)
    items.push({ icon: 'tabler:coins', text })
  }
  return items
})

const customTags = computed(() => parseTags(props.node.tags))

function getRegionAltText(region: string): string {
  return getRegionDisplayName(region) || getRegionCode(region)
}

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}
</script>

<template>
  <CardX
    hoverable
    :size="nodeCardXSize"
    :content-class="nodeCardContentPaddingClass"
    class="node-card w-full cursor-pointer border-none shadow-[0_0_0_3px] shadow-transparent transition-all duration-200 rounded-xl"
    :class="[!props.node.online && '!shadow-destructive/30']"
    role="button"
    tabindex="0"
    :aria-label="`查看节点 ${props.node.name} 详情`"
    @click="emit('click')"
    @keydown="handleKeyboardOpen"
  >
    <!-- 头部：在线点 + 名称 -->
    <template #header>
      <div class="flex items-center gap-2 min-w-0">
        <div class="relative size-2.5 shrink-0">
          <span
            class="size-2.5 rounded-full block"
            :class="props.node.online ? 'bg-success' : 'bg-destructive'"
          />
          <span
            v-if="!props.reduceMotion"
            class="animate-ping absolute inset-0 rounded-full opacity-60"
            :class="props.node.online ? 'bg-success' : 'bg-destructive'"
          />
        </div>
        <span class="text-sm font-bold flex-1 min-w-0 truncate">{{ props.node.name }}</span>
        <DataTooltip
          v-if="nodeMessage"
          :content="nodeMessageTooltip"
          placement="bottom"
          as="span"
          class="relative z-30 inline-flex shrink-0 cursor-help text-amber-500"
          content-class="z-50 w-56 whitespace-pre-line leading-snug text-left"
        >
          <Icon icon="tabler:alert-triangle-filled" width="14" height="14" aria-label="节点消息" />
        </DataTooltip>
      </div>
    </template>

    <!-- 头部右侧：OS + 国旗 -->
    <template #header-extra>
      <div class="flex gap-1.5 items-center shrink-0">
        <button
          type="button"
          class="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-slate-500/10 hover:text-amber-500"
          :class="isFavorite && 'text-amber-500'"
          :aria-label="isFavorite ? `取消收藏 ${props.node.name}` : `收藏 ${props.node.name}`"
          :title="isFavorite ? '取消收藏' : '收藏节点'"
          @click.stop="toggleFavorite"
          @keydown.stop
        >
          <Icon :icon="isFavorite ? 'tabler:star-filled' : 'tabler:star'" width="14" height="14" />
        </button>
        <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4">
        <img
          v-if="hasRegion(props.node.region)"
          :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionAltText(props.node.region)"
          class="size-5 shrink-0"
        >
      </div>
    </template>

    <template #default>
      <div
        data-node-card-content
        class="node-card-content relative flex flex-col"
        :class="[nodeCardContentClass, !props.node.online && 'node-card-content--offline']"
      >
        <!-- 在线天数固定展示，价格独立展示，避免不同主机卡片高度不一致 -->
        <div class="node-card-status-row relative z-20 flex items-center gap-1.5 -mt-1 h-[19px] overflow-hidden">
          <span
            v-if="props.node.online"
            class="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-muted-foreground leading-tight"
          >
            {{ uptimeDaysText }}
          </span>
          <span
            v-else
            class="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] leading-tight text-destructive"
          >
            <Icon icon="tabler:cloud-off" width="11" height="11" />
            离线
          </span>
          <span
            v-if="priceText"
            class="min-w-0 truncate text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-muted-foreground leading-tight"
          >
            {{ priceText }}
          </span>
        </div>

        <!-- 四项进度条 -->
        <div v-if="isMiniNodeCard" class="grid grid-cols-[3fr_2fr] gap-x-4 gap-y-2">
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-xs">
                <span class="inline-flex items-center text-sky-500" role="img" title="CPU" aria-label="CPU">
                  <Icon :icon="NODE_METRIC_ICONS.cpu" data-node-metric-icon="cpu" width="12" height="12" aria-hidden="true" />
                </span>
                <span class="tabular-nums font-medium">{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
              </div>
              <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
            </div>

            <div class="flex flex-col gap-1" :title="swapTooltip">
              <div class="flex justify-between text-xs">
                <span class="inline-flex items-center text-emerald-500" role="img" title="内存" aria-label="内存">
                  <Icon :icon="NODE_METRIC_ICONS.memory" data-node-metric-icon="memory" width="12" height="12" aria-hidden="true" />
                </span>
                <span class="tabular-nums font-medium">{{ memPercentage.toFixed(1) }}%</span>
              </div>
              <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
            </div>

            <div class="col-span-2 text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.traffic" data-node-metric-icon="traffic" width="12" height="12" class="shrink-0 text-violet-500" aria-hidden="true" />
                <span class="truncate">流量</span>
              </span>
              <span class="tabular-nums font-medium" :class="trafficPercentageClass">
                {{ hasTrafficLimit(props.node) ? `${trafficUsedPercentage.toFixed(1)}%` : '∞' }}
              </span>
            </div>
            <ProgressThin :percentage="trafficUsedPercentage" :status="trafficStatus" :height="4" />
            <div class="text-[11px] truncate" :class="trafficUsedPercentage >= 95 ? 'text-destructive' : 'text-muted-foreground'">
              {{ formatBytes(trafficUsed) }}
              <template v-if="hasTrafficLimit(props.node)">
                / {{ formatBytes(props.node.traffic_limit) }}
              </template>
              <template v-else>
                / ∞
              </template>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <!-- CPU -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.cpu" data-node-metric-icon="cpu" width="13" height="13" class="shrink-0 text-sky-500" aria-hidden="true" />
                <span class="truncate">CPU</span>
              </span>
              <span class="tabular-nums font-medium">{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ (props.node.load ?? 0).toFixed(2) }}, {{ (props.node.load5 ?? 0).toFixed(2) }}, {{ (props.node.load15 ?? 0).toFixed(2) }}
            </div>
          </div>

          <!-- 内存 -->
          <div class="flex flex-col gap-1" :title="swapTooltip">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.memory" data-node-metric-icon="memory" width="13" height="13" class="shrink-0 text-emerald-500" aria-hidden="true" />
                <span class="truncate">内存</span>
              </span>
              <span class="tabular-nums font-medium">{{ memPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
            </div>
          </div>

          <!-- 硬盘 -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.disk" data-node-metric-icon="disk" width="13" height="13" class="shrink-0 text-orange-500" aria-hidden="true" />
                <span class="truncate">硬盘</span>
              </span>
              <span class="tabular-nums font-medium">{{ diskPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
            </div>
          </div>

          <!-- 流量（分级颜色） -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.traffic" data-node-metric-icon="traffic" width="13" height="13" class="shrink-0 text-violet-500" aria-hidden="true" />
                <span class="truncate">流量</span>
              </span>
              <span class="tabular-nums font-medium" :class="trafficPercentageClass">
                {{ hasTrafficLimit(props.node) ? `${trafficUsedPercentage.toFixed(1)}%` : '∞' }}
              </span>
            </div>
            <ProgressThin :percentage="trafficUsedPercentage" :status="trafficStatus" :height="4" />
            <div class="text-[11px] truncate" :class="trafficUsedPercentage >= 95 ? 'text-destructive' : 'text-muted-foreground'">
              {{ formatBytes(trafficUsed) }}
              <template v-if="hasTrafficLimit(props.node)">
                / {{ formatBytes(props.node.traffic_limit) }}
              </template>
              <template v-else>
                / ∞
              </template>
            </div>
          </div>
        </div>

        <!-- 三列：网速 / 总流量 / 剩余天数+价格或负载 -->
        <div class="grid gap-1.5" :class="nodeCardMetricGridClass">
          <!-- 实时网速 -->
          <div class="flex flex-col gap-0.5 rounded-lg bg-slate-500/5 min-w-0 overflow-hidden" :class="nodeCardMetricBoxClass">
            <div class="text-[11px] text-success flex items-center gap-1">
              <Icon icon="tabler:chevron-up" width="11" height="11" />
              <span class="truncate min-w-0 overflow-hidden">{{ formatBytesPerSecond(props.node.net_out ?? 0) }}</span>
            </div>
            <div class="text-[11px] text-blue-600 flex items-center gap-1">
              <Icon icon="tabler:chevron-down" width="11" height="11" />
              <span class="truncate min-w-0 overflow-hidden">{{ formatBytesPerSecond(props.node.net_in ?? 0) }}</span>
            </div>
          </div>

          <!-- 总流量 -->
          <div class="flex flex-col gap-0.5 rounded-lg bg-slate-500/5 min-w-0 overflow-hidden" :class="nodeCardMetricBoxClass">
            <div class="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon icon="tabler:upload" width="11" height="11" />
              <span class="truncate min-w-0 overflow-hidden">{{ formatBytes(props.node.net_total_up ?? 0) }}</span>
            </div>
            <div class="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon icon="tabler:download" width="11" height="11" />
              <span class="truncate min-w-0 overflow-hidden">{{ formatBytes(props.node.net_total_down ?? 0) }}</span>
            </div>
          </div>

          <!-- 第三列：有价格显示剩余天数+价格，否则显示负载 -->
          <div class="flex flex-col gap-0.5 rounded-lg bg-slate-500/5 min-w-0 overflow-hidden" :class="nodeCardMetricBoxClass">
            <template v-if="remainingInfoTags.length">
              <div
                v-for="(item, i) in remainingInfoTags" :key="i"
                class="text-[11px] flex items-center gap-0.5"
                :class="item.className ?? 'text-muted-foreground'"
              >
                <Icon :icon="item.icon" width="11" height="11" class="shrink-0" />
                <span v-if="item.text" class="truncate min-w-0 overflow-hidden">{{ item.text }}</span>
                <template v-else>
                  <span v-if="item.prefix" class="shrink-0">{{ item.prefix }}</span>
                  <span v-if="item.value" class="shrink-0 tabular-nums">{{ item.value }}</span>
                  <span v-if="item.unit" class="shrink-0">{{ item.unit }}</span>
                </template>
              </div>
            </template>
            <template v-else>
              <div class="text-[11px] text-muted-foreground truncate">
                {{ (props.node.load ?? 0).toFixed(2) }}
              </div>
              <div class="text-[11px] text-muted-foreground truncate">
                {{ (props.node.load5 ?? 0).toFixed(2) }} / {{ (props.node.load15 ?? 0).toFixed(2) }}
              </div>
            </template>
          </div>
        </div>

        <!-- 延迟 + 丢包：默认总览一行；开启三网后每条线路一行。新版 Sparkline 由 threeNetPingSparkline 控制。 -->
        <div
          :data-three-net-ping="threeNetPingVisible ? '' : undefined"
          :class="[pingSparklineStyle ? 'ping-sparkline-list gap-y-1' : 'flex flex-col gap-1.5', pingSparklineStyle && !props.node.online && 'opacity-50']"
        >
          <template v-if="pingSparklineStyle">
            <button
              v-for="row in pingPanelRows"
              :key="row.key"
              type="button"
              class="ping-sparkline-row group/ping min-h-5 min-w-0 items-center rounded-md px-0.5 text-left leading-none hover:bg-slate-500/5"
              :title="`${row.latencyTooltip}\n${row.lossTooltip}`"
              :aria-label="row.ariaLabel"
              @click.stop="emit('pingClick')"
            >
              <span class="size-1.5 shrink-0 rounded-full" :class="row.dotClass" />
              <span
                class="min-w-0 truncate text-muted-foreground"
                :class="nodeCardPingTextClass"
              >
                {{ row.label }}
              </span>
              <span
                class="text-right font-medium tabular-nums"
                :class="[nodeCardPingTextClass, row.latencyToneClass]"
              >
                {{ row.latencyDisplay }}
              </span>
              <span
                :data-node-ping-sparkline="row.sparklineAttr"
                class="h-4 min-w-0"
                :class="row.latencyToneClass"
              >
                <Sparkline :values="row.latencyPoints" />
              </span>
              <span
                :data-node-ping-loss="row.lossAttr"
                class="ping-loss-cell grid min-w-[3.75rem] grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-0.5 whitespace-nowrap font-medium tabular-nums"
                :class="nodeCardPingTextClass"
              >
                <template v-if="row.lossDisplay === '-' || row.lossDisplay === '加载中'">
                  <span class="ping-loss-value text-right text-muted-foreground">{{ row.lossDisplay }}</span>
                </template>
                <template v-else>
                  <span class="ping-loss-label text-muted-foreground/80">丢包</span>
                  <span
                    :data-node-ping-loss-value="row.lossAttr"
                    class="ping-loss-value text-right"
                    :class="row.lossToneClass"
                  >
                    {{ row.lossDisplay }}
                  </span>
                </template>
              </span>
            </button>
          </template>
          <template v-else>
            <div
              v-for="row in pingPanelRows"
              :key="row.key"
              class="grid grid-cols-2 gap-1.5"
            >
              <button
                type="button"
                class="group/panel relative flex min-w-0 flex-col rounded-lg bg-slate-500/5"
                :class="[nodeCardPingPanelClass, nodeCardPanelClass, !props.node.online ? 'blur-xs opacity-50' : '']"
                :title="row.latencyTooltip"
                :aria-label="row.latencyAria"
                @click.stop="emit('pingClick')"
              >
                <div class="flex min-w-0 items-center justify-between gap-1 text-[11px] leading-none">
                  <span class="truncate text-muted-foreground">{{ row.latencyLabel }}</span>
                  <span class="shrink-0 font-medium tabular-nums">{{ row.latencyDisplay }}</span>
                </div>
                <div
                  :data-node-ping-bars="row.latencyBarsAttr"
                  class="grid min-h-0 min-w-0 w-full flex-1 items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
                  :style="{ gridTemplateColumns: `repeat(${row.latencyBars.length}, minmax(0, 1fr))` }"
                >
                  <DataTooltip
                    v-for="bar in row.latencyBars" :key="bar.key"
                    placement="top" :content="bar.tooltip" class="h-full w-full"
                  >
                    <span
                      class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                      :class="bar.className"
                    />
                  </DataTooltip>
                </div>
              </button>

              <button
                type="button"
                class="group/panel relative flex min-w-0 flex-col rounded-lg bg-slate-500/5"
                :class="[nodeCardPingPanelClass, nodeCardPanelClass, !props.node.online ? 'blur-xs opacity-50' : '']"
                :title="row.lossTooltip"
                :aria-label="row.lossAria"
                @click.stop="emit('pingClick')"
              >
                <div class="flex min-w-0 items-center justify-between gap-1 text-[11px] leading-none">
                  <span class="truncate text-muted-foreground">{{ row.lossLabel }}</span>
                  <span class="shrink-0 font-medium tabular-nums">{{ row.lossDisplay }}</span>
                </div>
                <div
                  :data-node-ping-bars="row.lossBarsAttr"
                  class="grid min-h-0 min-w-0 w-full flex-1 items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
                  :style="{ gridTemplateColumns: `repeat(${row.lossBars.length}, minmax(0, 1fr))` }"
                >
                  <DataTooltip
                    v-for="bar in row.lossBars" :key="bar.key"
                    placement="top" :content="bar.tooltip" class="h-full w-full"
                  >
                    <span
                      class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                      :class="bar.className"
                    />
                  </DataTooltip>
                </div>
              </button>
            </div>
          </template>
        </div>

        <!-- 自定义标签 -->
        <div v-if="customTags.length > 0" class="flex flex-wrap gap-1">
          <Badge
            v-for="(tag, i) in customTags" :key="`${tag.text}-${i}`"
            variant="outline"
            class="!text-[11px] rounded-full px-2 py-0"
            :style="{ color: tag.hex, borderColor: `${tag.hex}66`, backgroundColor: `${tag.hex}1f` }"
          >
            {{ tag.text }}
          </Badge>
        </div>

        <div
          v-if="!props.node.online"
          data-offline-status
          class="node-card-offline-status pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
        >
          <div class="text-sm font-semibold text-destructive">
            离线
          </div>
          <div class="mt-1 text-[11px] text-muted-foreground">
            {{ offlineTime }}
          </div>
        </div>
      </div>
    </template>
  </CardX>
</template>

<style scoped>
.node-card {
  position: relative;
  overflow: visible;
}

.node-card-content--offline > :not(.node-card-status-row):not(.node-card-offline-status) {
  opacity: 0.42;
  filter: saturate(0.55);
}

.ping-sparkline-list {
  display: grid;
  grid-template-columns: auto minmax(0, max-content) max-content minmax(3.5rem, 1fr) max-content;
  column-gap: 0.25rem;
}

.ping-sparkline-row {
  display: grid;
  grid-column: 1 / -1;
  min-width: 0;
  column-gap: inherit;
  grid-template-columns: auto minmax(0, max-content) max-content minmax(3.5rem, 1fr) max-content;
  grid-template-columns: subgrid;
}

.ping-loss-cell {
  justify-self: end;
}

@media (max-width: 420px) {
  .ping-sparkline-list,
  .ping-sparkline-row {
    grid-template-columns: auto minmax(0, max-content) max-content minmax(3rem, 1fr) max-content;
  }

  .ping-sparkline-row {
    grid-template-columns: subgrid;
  }

  .ping-loss-cell {
    column-gap: 0.25rem;
  }
}
</style>
