<template>
  <div class="space-y-6">
    <!-- 过滤器栏 -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- 类型过滤 -->
      <div class="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
        <button
          v-for="opt in typeOptions"
          :key="opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="filterType === opt.value
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
          @click="filterType = opt.value"
        >
          {{ opt.icon }} {{ opt.label }}
        </button>
      </div>

      <!-- 版本过滤 -->
      <div class="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
        <button
          v-for="ver in versionOptions"
          :key="ver"
          class="px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="filterVersion === ver
            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
          @click="filterVersion = filterVersion === ver ? '' : ver"
        >
          {{ ver || $t('models.allVersions') }}
        </button>
      </div>

      <!-- 统计 -->
      <div class="ml-auto text-xs text-gray-400">
        {{ filteredModels.length }} / {{ allModels.length }} {{ $t('models.items') }}
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">
      {{ $t('common.loading') }}
    </div>

    <!-- 空状态 -->
    <div v-else-if="filteredModels.length === 0" class="text-center py-12 text-gray-400 text-sm">
      {{ $t('models.noModels') }}
    </div>

    <!-- 模型卡片列表 -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div
        v-for="(model, idx) in filteredModels"
        :key="idx"
        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-shadow hover:shadow-md"
      >
        <!-- 卡片头部：核心信息 -->
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <!-- 类型图标 -->
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                :class="model.type === 'onnx'
                  ? 'bg-amber-50 dark:bg-amber-900/30'
                  : 'bg-purple-50 dark:bg-purple-900/30'"
              >
                <span class="text-lg">{{ model.type === 'onnx' ? '⚡' : '🔥' }}</span>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {{ model.character || $t('models.unknown') }}
                </p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded"
                    :class="model.type === 'onnx'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'"
                  >
                    {{ model.type === 'onnx' ? 'ONNX' : 'PyTorch' }}
                  </span>
                  <span class="text-[10px] text-gray-400">{{ model.version }}</span>
                  <span class="text-[10px] text-gray-400">·</span>
                  <span class="text-[10px] text-gray-400">{{ formatSize(model.total_size_bytes) }}</span>
                </div>
              </div>
            </div>
            <!-- 状态标签 -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="model.voice_id"
                class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              >
                🎤 {{ model.voice_id }}
              </span>
              <span
                v-if="model.type === 'onnx' && model.complete === false"
                class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              >
                ⚠ {{ $t('models.incomplete') }}
              </span>
              <!-- 展开按钮 -->
              <button
                class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400"
                @click="toggleExpand(idx)"
              >
                <span class="text-xs transition-transform" :class="expanded[idx] ? 'rotate-180' : ''">▼</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 展开详情 -->
        <Transition name="slide">
          <div v-if="expanded[idx]" class="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
            <div class="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <!-- PyTorch 详情 -->
              <template v-if="model.type === 'pytorch'">
                <div v-if="model.gpt" class="flex items-start gap-2">
                  <span class="font-medium text-gray-500 w-14 shrink-0">GPT</span>
                  <div class="min-w-0">
                    <p class="truncate" :title="model.gpt.path">{{ model.gpt.filename }}</p>
                    <p class="text-[10px] text-gray-400">
                      {{ formatSize(model.gpt.size_bytes) }}
                      <template v-if="model.gpt.epoch != null"> · epoch {{ model.gpt.epoch }}</template>
                      <template v-if="model.gpt.step != null"> · step {{ model.gpt.step }}</template>
                    </p>
                  </div>
                </div>
                <div v-else class="flex items-center gap-2 text-orange-500">
                  <span class="font-medium w-14 shrink-0">GPT</span>
                  <span>{{ $t('models.notFound') }}</span>
                </div>
                <div v-if="model.sovits" class="flex items-start gap-2">
                  <span class="font-medium text-gray-500 w-14 shrink-0">SoVITS</span>
                  <div class="min-w-0">
                    <p class="truncate" :title="model.sovits.path">{{ model.sovits.filename }}</p>
                    <p class="text-[10px] text-gray-400">
                      {{ formatSize(model.sovits.size_bytes) }}
                      <template v-if="model.sovits.epoch != null"> · epoch {{ model.sovits.epoch }}</template>
                      <template v-if="model.sovits.step != null"> · step {{ model.sovits.step }}</template>
                    </p>
                  </div>
                </div>
                <div v-else class="flex items-center gap-2 text-orange-500">
                  <span class="font-medium w-14 shrink-0">SoVITS</span>
                  <span>{{ $t('models.notFound') }}</span>
                </div>
              </template>

              <!-- ONNX 详情 -->
              <template v-if="model.type === 'onnx'">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-500 w-14 shrink-0">{{ $t('models.dir') }}</span>
                  <span class="truncate" :title="model.onnx_model_dir">{{ model.onnx_model_dir }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-500 w-14 shrink-0">{{ $t('models.files') }}</span>
                  <span>{{ model.file_count }} {{ $t('models.items') }}</span>
                  <span v-if="model.has_fp16" class="px-1 py-0.5 text-[10px] rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">FP16</span>
                  <span v-if="model.has_prompt_encoder" class="px-1 py-0.5 text-[10px] rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300">PromptEncoder</span>
                </div>
                <div v-if="model.missing_files && model.missing_files.length > 0" class="flex items-start gap-2 text-red-500">
                  <span class="font-medium w-14 shrink-0">{{ $t('models.missing') }}</span>
                  <span>{{ model.missing_files.join(', ') }}</span>
                </div>
              </template>

              <!-- 通用信息 -->
              <div class="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                <span class="font-medium text-gray-500 w-14 shrink-0">{{ $t('models.modified') }}</span>
                <span>{{ formatDate(model.modified) }}</span>
              </div>

              <!-- 转换按钮（仅 PyTorch 且 GPT+SoVITS 都存在） -->
              <div v-if="model.type === 'pytorch' && model.gpt && model.sovits" class="pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                  @click="openConvertDialog(model)"
                >
                  ⚡ {{ $t('models.convertToOnnx') }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
    <!-- 转换对话框 -->
    <Teleport to="body">
      <div v-if="convertDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="convertDialog = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ $t('models.convertToOnnx') }}</h3>

          <!-- 未开始 -->
          <template v-if="!convertTaskId">
            <div class="space-y-3 text-xs">
              <div>
                <label class="block text-gray-500 mb-1">GPT (.ckpt)</label>
                <input v-model="convertForm.gpt" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs" readonly />
              </div>
              <div>
                <label class="block text-gray-500 mb-1">SoVITS (.pth)</label>
                <input v-model="convertForm.sovits" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs" readonly />
              </div>
              <div>
                <label class="block text-gray-500 mb-1">{{ $t('models.outputDir') }}</label>
                <input v-model="convertForm.outputDir" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs" :placeholder="convertForm.defaultOutputDir" />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" @click="convertDialog = false">{{ $t('common.cancel') }}</button>
              <button class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" @click="startConvert">{{ $t('models.startConvert') }}</button>
            </div>
          </template>

          <!-- 进行中 / 完成 -->
          <template v-else>
            <div class="space-y-3">
              <!-- 进度条 -->
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all duration-500"
                  :class="convertStatus === 'error' ? 'bg-red-500' : convertStatus === 'done' ? 'bg-green-500' : 'bg-indigo-500'"
                  :style="{ width: `${convertProgress}%` }"
                />
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400">{{ convertMessage }}</p>
              <p class="text-[10px] text-gray-400">{{ convertProgress }}%</p>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button
                v-if="convertStatus === 'done' || convertStatus === 'error'"
                class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                @click="closeConvertDialog"
              >{{ $t('common.confirm') }}</button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { ModelEntry } from '~/types'

const api = useApi()
const { t } = useI18n()

const allModels = ref<ModelEntry[]>([])
const loading = ref(true)
const filterType = ref('')
const filterVersion = ref('')
const expanded = ref<Record<number, boolean>>({})

// 转换对话框
const convertDialog = ref(false)
const convertForm = reactive({ gpt: '', sovits: '', outputDir: '', defaultOutputDir: '' })
const convertTaskId = ref('')
const convertStatus = ref('')
const convertProgress = ref(0)
const convertMessage = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const typeOptions = computed(() => [
  { value: '', label: t('models.all'), icon: '📦' },
  { value: 'pytorch', label: 'PyTorch', icon: '🔥' },
  { value: 'onnx', label: 'ONNX', icon: '⚡' },
])

const versionOptions = computed(() => {
  const versions = new Set(allModels.value.map(m => m.version))
  return ['', ...Array.from(versions).sort()]
})

const filteredModels = computed(() => {
  let list = allModels.value
  if (filterType.value) {
    list = list.filter(m => m.type === filterType.value)
  }
  if (filterVersion.value) {
    list = list.filter(m => m.version.toLowerCase() === filterVersion.value.toLowerCase())
  }
  return list
})

function toggleExpand(idx: number) {
  expanded.value[idx] = !expanded.value[idx]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function openConvertDialog(model: ModelEntry) {
  if (model.type !== 'pytorch' || !model.gpt || !model.sovits) return
  convertForm.gpt = model.gpt.path
  convertForm.sovits = model.sovits.path
  const charName = model.character || 'output'
  convertForm.defaultOutputDir = `onnx_models/${charName}`
  convertForm.outputDir = convertForm.defaultOutputDir
  convertTaskId.value = ''
  convertStatus.value = ''
  convertProgress.value = 0
  convertMessage.value = ''
  convertDialog.value = true
}

async function startConvert() {
  const outDir = convertForm.outputDir || convertForm.defaultOutputDir
  try {
    const res = await api.submitConvert(convertForm.gpt, convertForm.sovits, outDir)
    if (res.error) {
      convertMessage.value = res.error
      convertStatus.value = 'error'
      convertTaskId.value = 'error'
      return
    }
    convertTaskId.value = res.task_id
    convertStatus.value = res.status
    startPolling()
  } catch (e: any) {
    convertMessage.value = e?.message || String(e)
    convertStatus.value = 'error'
    convertTaskId.value = 'error'
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!convertTaskId.value || convertTaskId.value === 'error') {
      stopPolling()
      return
    }
    try {
      const task = await api.getConvertStatus(convertTaskId.value)
      convertStatus.value = task.status
      convertProgress.value = task.progress
      convertMessage.value = task.message
      if (task.status === 'done' || task.status === 'error') {
        stopPolling()
        if (task.status === 'done') refreshModels()
      }
    } catch {
      stopPolling()
    }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function closeConvertDialog() {
  stopPolling()
  convertDialog.value = false
}

async function refreshModels() {
  try {
    const res = await api.listModels()
    allModels.value = res.models
  } catch { /* ignore */ }
}

onMounted(async () => {
  try {
    const res = await api.listModels()
    allModels.value = res.models
  } catch (e) {
    console.error('Failed to load models:', e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.slide-enter-to,
.slide-leave-from {
  max-height: 300px;
  opacity: 1;
}
</style>
