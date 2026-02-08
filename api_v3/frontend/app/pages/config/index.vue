<template>
  <div class="space-y-6">
    <!-- ═══ 默认配置（可折叠） ═══ -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <button
        class="w-full flex items-center justify-between p-5 text-left"
        @click="showDefaults = !showDefaults"
      >
        <div class="flex items-center gap-2">
          <span class="text-base">⚙️</span>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{ $t('settings.title') }}
          </h2>
          <span class="text-xs text-gray-400 ml-1">default.toml</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="text-xs px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            @click.stop="handleReload"
          >
            {{ reloading ? '...' : '↻ ' + $t('config.reload') }}
          </button>
          <svg
            class="w-4 h-4 text-gray-400 transition-transform"
            :class="{ 'rotate-180': showDefaults }"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <div v-if="showDefaults && defaultConfig" class="px-5 pb-5 space-y-4">
        <div class="border-t border-gray-100 dark:border-gray-700 pt-4">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('params.title') }}</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            <div
              v-for="(value, key) in defaultConfig.params"
              :key="key"
              class="px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700"
            >
              <p class="text-[10px] text-gray-400 leading-tight">{{ key }}</p>
              <p class="text-xs font-mono text-gray-800 dark:text-gray-200 mt-0.5">{{ value }}</p>
            </div>
          </div>
        </div>
        <div>
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('config.output') }}</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            <div
              v-for="(value, key) in defaultConfig.output"
              :key="key"
              class="px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700"
            >
              <p class="text-[10px] text-gray-400 leading-tight">{{ key }}</p>
              <p class="text-xs font-mono text-gray-800 dark:text-gray-200 mt-0.5">{{ value }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="showDefaults && !defaultConfig" class="px-5 pb-5">
        <div class="text-center py-6 text-gray-400 text-sm">{{ $t('common.loading') }}</div>
      </div>
    </div>

    <!-- ═══ Voice Profiles ═══ -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <!-- 工具栏 -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{ $t('config.voiceProfiles') }}
          </h2>
          <span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {{ voiceConfigs.length }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <!-- 多选切换 -->
          <button
            class="text-xs px-2.5 py-1.5 rounded-md transition-colors"
            :class="selectMode
              ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100'"
            @click="toggleSelectMode"
          >
            {{ selectMode ? `✓ ${selectedIds.size} ${$t('config.selected')}` : `☐ ${$t('config.select')}` }}
          </button>
          <!-- 批量删除 -->
          <button
            v-if="selectMode && selectedIds.size > 0"
            class="text-xs px-2.5 py-1.5 rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            @click="handleBatchDelete"
          >
            🗑 {{ $t('config.delete') }} ({{ selectedIds.size }})
          </button>
          <!-- 新建 -->
          <button
            class="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
            @click="handleCreate"
          >
            + {{ $t('config.newProfile') }}
          </button>
        </div>
      </div>

      <!-- 列表 -->
      <div v-if="voiceConfigs.length === 0" class="text-center py-12 text-gray-400 text-sm">
        <p class="text-2xl mb-2">🎤</p>
        <p>{{ $t('config.noProfiles') }}</p>
        <p class="text-xs mt-1">{{ $t('config.noProfilesHint') }}</p>
      </div>

      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700 -mx-5">
        <div
          v-for="v in voiceConfigs"
          :key="v.voice.id"
          class="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer group"
          @click="handleRowClick(v.voice.id)"
        >
          <!-- 多选框 -->
          <div
            v-if="selectMode"
            class="shrink-0"
            @click.stop="toggleSelect(v.voice.id)"
          >
            <div
              class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
              :class="selectedIds.has(v.voice.id)
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 dark:border-gray-600'"
            >
              <svg v-if="selectedIds.has(v.voice.id)" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <!-- 头像 -->
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            {{ v.voice.name.charAt(0) }}
          </div>

          <!-- 信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {{ v.voice.name }}
              </p>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono shrink-0">
                {{ v.model.version }}
              </span>
            </div>
            <p class="text-xs text-gray-400 truncate mt-0.5">
              {{ v.voice.description || v.voice.id }}
            </p>
          </div>

          <!-- 模型摘要 -->
          <div class="hidden lg:block text-right shrink-0">
            <p class="text-[11px] text-gray-400 truncate max-w-48">
              {{ v.model.gpt_weights?.split('/').pop() || '-' }}
            </p>
            <p class="text-[11px] text-gray-400 truncate max-w-48 mt-0.5">
              {{ v.model.sovits_weights?.split('/').pop() || '-' }}
            </p>
          </div>

          <!-- 箭头 -->
          <svg
            v-if="!selectMode"
            class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VoiceConfig, VoiceListItem } from '~/types'

const router = useRouter()
const api = useApi()

const defaultConfig = ref<VoiceConfig | null>(null)
const voices = ref<VoiceListItem[]>([])
const voiceConfigs = ref<VoiceConfig[]>([])
const reloading = ref(false)
const showDefaults = ref(false)

const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) {
    selectedIds.value = new Set()
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function handleRowClick(id: string) {
  if (selectMode.value) {
    toggleSelect(id)
  } else {
    router.push(`/config/${id}`)
  }
}

function handleCreate() {
  router.push('/config/new')
}

async function handleBatchDelete() {
  if (!confirm(`确定删除 ${selectedIds.value.size} 个 Voice Profile？`)) return
  try {
    await api.batchDeleteVoices([...selectedIds.value])
    selectedIds.value = new Set()
    selectMode.value = false
    await loadData()
  } catch (e) {
    console.error('Failed to delete voices:', e)
  }
}

async function handleReload() {
  reloading.value = true
  try {
    await api.reloadConfig()
    await loadData()
  } finally {
    reloading.value = false
  }
}

async function loadData() {
  try {
    const [dc, vl] = await Promise.all([api.getDefaultConfig(), api.listVoices()])
    defaultConfig.value = dc
    voices.value = vl

    const configs = await Promise.all(vl.map((v: VoiceListItem) => api.getVoice(v.id)))
    voiceConfigs.value = configs
  } catch (e) {
    console.error('Failed to load config data:', e)
  }
}

onMounted(() => {
  loadData()
})
</script>
