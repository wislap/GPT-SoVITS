<template>
  <div class="space-y-6">
    <!-- 状态卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
            <span class="text-lg">🟢</span>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('common.success') }}</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ health?.status === 'ok' ? $t('common.online') : $t('common.offline') }}
            </p>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <span class="text-lg">🎤</span>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('nav.models') }}</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ health?.voices_count ?? 0 }}
            </p>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="health?.backend === 'genie' ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-purple-50 dark:bg-purple-900/30'">
            <span class="text-lg">{{ health?.backend === 'genie' ? '⚡' : '🔥' }}</span>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('common.backendType') }}</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ backendLabel }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 声音列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ $t('nav.tts') }}
        </h2>
        <NuxtLink
          to="/tts"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {{ $t('tts.synthesize') }} →
        </NuxtLink>
      </div>
      <div v-if="voices.length === 0" class="text-center py-8 text-gray-400 text-sm">
        {{ $t('common.loading') }}
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="v in voices"
          :key="v.id"
          to="/tts"
          class="p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all cursor-pointer"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {{ v.name.charAt(0) }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ v.name }}</p>
              <p class="text-xs text-gray-400">{{ v.version }} · {{ v.id }}</p>
            </div>
          </div>
          <p v-if="v.description" class="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
            {{ v.description }}
          </p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HealthResponse, VoiceListItem } from '~/types'

const api = useApi()
const health = ref<HealthResponse | null>(null)
const voices = ref<VoiceListItem[]>([])

const backendLabel = computed(() => {
  const b = health.value?.backend
  if (b === 'genie') return 'Genie-TTS (ONNX)'
  if (b === 'gsv') return 'GPT-SoVITS (PyTorch)'
  return b || '-'
})

onMounted(async () => {
  try {
    const [h, v] = await Promise.all([api.getHealth(), api.listVoices()])
    health.value = h
    voices.value = v
  } catch (e) {
    console.error('Failed to load dashboard data:', e)
  }
})
</script>
