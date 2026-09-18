<script setup lang="ts">
import type { PingTaskInfo } from '@/utils/rpc'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { loadPublicPingTasks } from '@/services/metrics.service'
import { mergeThreeNetPingNodeTaskBindings, saveGlassmorphismThemeSettings } from '@/services/theme-settings.service'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'

const TASK_LIMIT = 3

const appStore = useAppStore()
const nodesStore = useNodesStore()
const router = useRouter()

const tasks = ref<PingTaskInfo[]>([])
const nodeSearch = ref('')
const taskSearch = ref('')
const activeNodeId = ref('')
const nodeTaskBindings = ref<Record<string, number[]>>({})
const loadingTasks = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dirty = ref(false)

const visibleNodes = computed(() => nodesStore.visibleNodes)
const configuredNodeCount = computed(() => Object.keys(nodeTaskBindings.value).length)
const activeNode = computed(() => visibleNodes.value.find(node => node.uuid === activeNodeId.value))
const activeTaskIds = computed(() => nodeTaskBindings.value[activeNodeId.value] ?? [])
const filteredTasks = computed(() => {
  const keyword = taskSearch.value.trim().toLowerCase()
  if (!keyword)
    return tasks.value

  return tasks.value.filter((task) => {
    const content = `${task.id} ${task.name}`
    return content.toLowerCase().includes(keyword)
  })
})
const filteredNodes = computed(() => {
  const keyword = nodeSearch.value.trim().toLowerCase()
  if (!keyword)
    return visibleNodes.value

  return visibleNodes.value.filter((node) => {
    const content = `${node.name} ${node.uuid}`
    return content.toLowerCase().includes(keyword)
  })
})
const saveDisabled = computed(() => saving.value || loadingTasks.value || !dirty.value)
const saveButtonLabel = computed(() => saving.value ? '保存中' : dirty.value ? '保存配置' : '配置已保存')
const saveButtonIcon = computed(() => saving.value
  ? 'tabler:loader-2'
  : dirty.value ? 'tabler:device-floppy' : 'tabler:circle-check')

function normalizeTaskIds(value: readonly number[] | undefined): number[] {
  if (!value)
    return []

  return [...new Set(value.filter(taskId => Number.isInteger(taskId) && taskId > 0))].slice(0, TASK_LIMIT)
}

function taskCountForNode(nodeId: string): number {
  return nodeTaskBindings.value[nodeId]?.length ?? 0
}

function hydrateFromSettings(): void {
  if (visibleNodes.value.length === 0 || dirty.value)
    return

  const currentActiveNodeId = activeNodeId.value
  const sourceBindings = appStore.threeNetPingNodeTaskBindings
  const nextBindings: Record<string, number[]> = {}

  for (const node of visibleNodes.value) {
    const taskIds = normalizeTaskIds(sourceBindings[node.uuid])
    if (taskIds.length === 0)
      continue
    nextBindings[node.uuid] = taskIds
  }

  nodeTaskBindings.value = nextBindings
  activeNodeId.value = visibleNodes.value.some(node => node.uuid === currentActiveNodeId)
    ? currentActiveNodeId
    : Object.keys(nextBindings)[0] ?? visibleNodes.value[0]?.uuid ?? ''
}

function setDirty(): void {
  dirty.value = true
  errorMessage.value = ''
}

function showError(message: string): void {
  errorMessage.value = message
  window.$message?.error(message)
}

function toggleTask(taskId: number): void {
  if (saving.value || !activeNodeId.value)
    return

  const current = activeTaskIds.value
  const selected = current.includes(taskId)
  if (!selected && current.length >= TASK_LIMIT) {
    window.$message?.warning(`每台服务器最多选择 ${TASK_LIMIT} 个 Ping 任务。`)
    return
  }

  const nodeId = activeNodeId.value
  const nextTaskIds = selected
    ? current.filter(id => id !== taskId)
    : [...current, taskId]
  const nextBindings = { ...nodeTaskBindings.value }

  if (nextTaskIds.length > 0)
    nextBindings[nodeId] = nextTaskIds
  else
    delete nextBindings[nodeId]

  nodeTaskBindings.value = nextBindings
  setDirty()
}

function taskName(taskId: number): string {
  return tasks.value.find(task => task.id === taskId)?.name ?? `任务 ${taskId}`
}

function nodeTaskSummary(nodeId: string): string {
  const ids = nodeTaskBindings.value[nodeId] ?? []
  return ids.length > 0 ? ids.map(taskId => taskName(taskId)).join('、') : '使用全局任务'
}

async function save(): Promise<void> {
  if (saving.value)
    return

  errorMessage.value = ''
  saving.value = true
  try {
    if (!(await appStore.verifyLoginState({ force: true }))) {
      showError('保存前请先登录管理员账号。')
      return
    }

    const bindings: Record<string, number[]> = {}
    for (const [nodeId, taskIds] of Object.entries(nodeTaskBindings.value)) {
      const normalized = normalizeTaskIds(taskIds)
      if (normalized.length > 0)
        bindings[nodeId] = normalized
    }

    const settings = mergeThreeNetPingNodeTaskBindings(
      appStore.publicSettings?.theme_settings,
      bindings,
      appStore.threeNetPingTaskIds,
    )
    await saveGlassmorphismThemeSettings(settings)
    if (appStore.publicSettings) {
      appStore.publicSettings = {
        ...appStore.publicSettings,
        theme_settings: settings,
      }
    }
    dirty.value = false
    window.$message?.success('按服务器 Ping 任务配置已保存。')
  }
  catch (error) {
    showError(error instanceof Error ? error.message : '保存失败，请稍后重试。')
  }
  finally {
    saving.value = false
  }
}

onMounted(async () => {
  loadingTasks.value = true
  try {
    tasks.value = await loadPublicPingTasks()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Ping 任务加载失败。'
  }
  finally {
    loadingTasks.value = false
  }
})

watch(
  () => [
    visibleNodes.value.map(node => node.uuid).join('|'),
    appStore.threeNetPingNodeTaskBindings,
  ],
  hydrateFromSettings,
  { immediate: true },
)
</script>

<template>
  <main class="px-4 pt-5 pb-28 sm:py-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="mb-2 flex items-center gap-2 text-muted-foreground">
          <Button variant="ghost" size="xs" class="px-1.5" @click="router.push('/')">
            <Icon icon="tabler:arrow-left" />
            返回首页
          </Button>
        </div>
        <h1 class="text-xl font-semibold tracking-tight">
          按服务器配置 Ping 任务
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          选择服务器后直接勾选 1～3 个 Ping 任务；取消全部任务后，该服务器恢复使用全局任务。
        </p>
      </div>
      <Button class="hidden sm:inline-flex" :disabled="saveDisabled" @click="save">
        <Icon :icon="saveButtonIcon" :class="saving && 'animate-spin'" />
        {{ saveButtonLabel }}
      </Button>
    </div>

    <CardX class="mt-5" size="small">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm">
          <Icon icon="tabler:info-circle" class="text-primary" />
          <span>已配置 {{ configuredNodeCount }} 台服务器。</span>
        </div>
        <Badge variant="outline">
          每台服务器最多 {{ TASK_LIMIT }} 个任务，服务器数量不限
        </Badge>
      </div>
    </CardX>

    <div v-if="errorMessage" class="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <Icon icon="tabler:alert-circle" class="mt-0.5 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>

    <div class="mt-5 grid gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.5fr)]">
      <CardX content-class="p-0" size="small">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <span>服务器列表</span>
            <Badge variant="secondary">
              {{ visibleNodes.length }}
            </Badge>
          </div>
        </template>
        <div class="border-b px-3 py-2">
          <div class="relative">
            <Icon icon="tabler:search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="nodeSearch" class="h-8 pl-9 text-xs" placeholder="搜索服务器" />
          </div>
        </div>
        <div v-if="filteredNodes.length" class="max-h-[min(42dvh,22rem)] overflow-y-auto p-2 sm:max-h-[min(62vh,44rem)]">
          <div
            v-for="node in filteredNodes"
            :key="node.uuid"
            class="mb-1 rounded-md border border-transparent transition-colors last:mb-0"
            :class="activeNodeId === node.uuid && 'border-primary/30 bg-primary/10'"
          >
            <button
              type="button"
              class="w-full min-w-0 rounded-md px-2.5 py-2 text-left hover:bg-accent/60"
              @click="activeNodeId = node.uuid"
            >
              <div class="flex items-center gap-2">
                <span class="size-2 shrink-0 rounded-full" :class="node.online ? 'bg-emerald-500' : 'bg-muted-foreground/40'" />
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ node.name }}</span>
                <Badge v-if="taskCountForNode(node.uuid) > 0" variant="default" class="h-5 px-1.5 text-[10px]">
                  {{ taskCountForNode(node.uuid) }}/{{ TASK_LIMIT }}
                </Badge>
              </div>
              <div class="mt-1 truncate pl-4 text-[11px] text-muted-foreground" :title="nodeTaskSummary(node.uuid)">
                {{ nodeTaskSummary(node.uuid) }}
              </div>
            </button>
          </div>
        </div>
        <Empty v-else description="暂无匹配服务器" class="py-12" />
      </CardX>

      <CardX v-if="activeNode" size="small">
        <template #header>
          <div class="min-w-0">
            <div class="truncate font-medium">
              {{ activeNode.name }}
            </div>
            <div class="mt-0.5 truncate text-[11px] text-muted-foreground">
              {{ activeNode.uuid }}
            </div>
          </div>
        </template>

        <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div class="text-sm text-muted-foreground">
            勾选该服务器要展示的 Ping 任务，取消全部选择即可恢复全局任务。
          </div>
          <Badge variant="outline">
            {{ activeTaskIds.length }} / {{ TASK_LIMIT }} 已选择
          </Badge>
        </div>

        <div class="mt-4">
          <div class="relative">
            <Icon icon="tabler:search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="taskSearch" class="h-9 pl-9" placeholder="搜索 Ping 任务名称或 ID" />
          </div>
        </div>

        <div v-if="loadingTasks" class="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Icon icon="tabler:loader-2" class="mr-2 animate-spin" />
          正在加载 Ping 任务…
        </div>
        <div v-else-if="filteredTasks.length" class="mt-4 grid gap-2 sm:grid-cols-2">
          <label
            v-for="task in filteredTasks"
            :key="task.id"
            class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
            :class="activeTaskIds.includes(task.id) ? 'border-primary/50 bg-primary/10' : 'border-border hover:bg-accent/50'"
          >
            <input
              type="checkbox"
              class="size-4 shrink-0 accent-primary"
              :checked="activeTaskIds.includes(task.id)"
              :disabled="saving"
              @change="toggleTask(task.id)"
            >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ task.name }}</span>
              <span class="mt-0.5 block text-[11px] text-muted-foreground">ID {{ task.id }}</span>
            </span>
            <Icon v-if="activeTaskIds.includes(task.id)" icon="tabler:check" class="shrink-0 text-primary" />
          </label>
        </div>
        <Empty v-else description="暂无匹配 Ping 任务" class="py-12" />
      </CardX>

      <CardX v-else size="small">
        <Empty description="请选择服务器" />
      </CardX>
    </div>

    <div class="theme-ping-mobile-actions fixed inset-x-0 bottom-0 z-[60] border-t border-border/70 bg-background/90 px-4 pt-3 backdrop-blur-xl sm:hidden">
      <Button class="h-11 w-full" :disabled="saveDisabled" @click="save">
        <Icon :icon="saveButtonIcon" :class="saving && 'animate-spin'" />
        {{ saveButtonLabel }}
      </Button>
    </div>
  </main>
</template>

<style scoped>
.theme-ping-mobile-actions {
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
  padding-right: max(1rem, var(--komari-safe-area-right, env(safe-area-inset-right, 0px)));
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  padding-bottom: calc(0.75rem + var(--komari-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-left: max(1rem, var(--komari-safe-area-left, env(safe-area-inset-left, 0px)));
}
</style>
