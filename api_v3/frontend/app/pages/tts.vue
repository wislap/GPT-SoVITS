<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
    <!-- 左侧：输入区 -->
    <div class="lg:col-span-2 space-y-4">
      <!-- 声音配置 + 语言 + 应用 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {{ $t('tts.selectVoice') }}
            </label>
            <select
              v-model="selectedVoiceId"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              @change="onVoiceChange"
            >
              <option value="_default">{{ $t('config.defaultConfig') }}</option>
              <option v-for="v in voices" :key="v.id" :value="v.id">
                {{ v.name }} ({{ v.version }})
              </option>
            </select>
          </div>
          <div class="w-36">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {{ $t('tts.textLang') }}
            </label>
            <select
              v-model="textLang"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option v-for="lang in TEXT_LANGUAGES" :key="lang.value" :value="lang.value">
                {{ lang.label }}
              </option>
            </select>
          </div>
          <button
            :disabled="applying || !currentConfig"
            class="shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            :class="modelMatched
              ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40'"
            @click="handleApply"
          >
            {{ applying ? '...' : (modelMatched ? '✓ ' + $t('tts.applied') : '⟳ ' + $t('tts.apply')) }}
          </button>
        </div>
      </div>

      <!-- 文本输入 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {{ $t('tts.inputText') }}
        </label>
        <textarea
          v-model="inputText"
          :placeholder="$t('tts.inputPlaceholder')"
          rows="6"
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-y"
          @keydown.ctrl.enter="handleSynthesize"
        />
        <div class="flex items-center justify-between mt-3">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">{{ inputText.length }} {{ $t('common.chars') }} · Ctrl+Enter</span>
            <span v-if="streamStatus" class="text-xs text-indigo-500 animate-pulse">
              {{ streamStatus }}<template v-if="streamPlayer.chunksReceived.value > 0"> · {{ streamPlayer.chunksReceived.value }} chunks</template>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <!-- WS/REST 切换 -->
            <button
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              :class="useWebSocket
                ? 'border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'"
              @click="useWebSocket = !useWebSocket"
            >
              {{ useWebSocket ? 'WS' : 'REST' }}
            </button>
            <button
              :disabled="!canSynthesize"
              class="px-5 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              @click="handleSynthesize"
            >
              {{ synthesizing ? '...' : $t('tts.synthesize') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 推理参数 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('params.title') }}</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <ParamSlider v-model="speedFactor" :label="$t('params.speed')" :min="0.5" :max="2.0" :step="0.05" :ref-value="refParams?.speed_factor" />
          <ParamSlider v-model="temperature" :label="$t('params.temperature')" :min="0.1" :max="2.0" :step="0.05" :ref-value="refParams?.temperature" />
          <ParamSlider v-model="topK" :label="$t('params.topK')" :min="1" :max="50" :step="1" :ref-value="refParams?.top_k" />
          <ParamSlider v-model="topP" :label="$t('params.topP')" :min="0" :max="1" :step="0.05" :ref-value="refParams?.top_p" />
          <ParamInput v-model="seed" :label="$t('params.seed')" type="number" :min="-1" />
          <ParamInput v-model="batchSize" :label="$t('params.batchSize')" type="number" :min="1" :max="32" />
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ $t('params.splitMethod') }}</label>
            <select
              v-model="splitMethod"
              class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
            >
              <option v-for="m in SPLIT_METHODS" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：配置详情 + 结果 -->
    <div class="space-y-4">
      <!-- 当前配置详情 -->
      <div v-if="currentConfig" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ currentConfig.voice.name || $t('config.defaultConfig') }}
        </h3>
        <div class="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <div><span class="font-medium">{{ $t('models.version') }}:</span> {{ currentConfig.model.version }}</div>
          <div><span class="font-medium">{{ $t('config.audioPath') }}:</span> {{ currentConfig.ref_audio.path || '-' }}</div>
          <div><span class="font-medium">{{ $t('tts.promptText') }}:</span> {{ currentConfig.ref_audio.prompt_text || '-' }}</div>
          <div>
            <span class="font-medium">GPT:</span>
            <span class="font-mono text-[10px]">{{ shortPath(currentConfig.model.gpt_weights) }}</span>
          </div>
          <div>
            <span class="font-medium">SoVITS:</span>
            <span class="font-mono text-[10px]">{{ shortPath(currentConfig.model.sovits_weights) }}</span>
          </div>
        </div>
      </div>

      <!-- 合成结果 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('tts.result') }}</h3>
          <button
            v-if="history.length > 0"
            class="text-xs text-red-500 hover:underline"
            @click="clearHistory"
          >
            {{ $t('common.reset') }}
          </button>
        </div>

        <div v-if="history.length === 0" class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          {{ $t('tts.noHistory') }}
        </div>

        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div
            v-for="item in history"
            :key="item.id"
            class="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750"
          >
            <div class="flex items-start justify-between mb-1">
              <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 flex-1">{{ item.text }}</p>
              <span
                class="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                :class="{
                  'bg-yellow-100 text-yellow-700': item.status === 'synthesizing',
                  'bg-green-100 text-green-700': item.status === 'done',
                  'bg-red-100 text-red-700': item.status === 'error',
                  'bg-gray-100 text-gray-500': item.status === 'pending',
                }"
              >
                {{ item.status === 'synthesizing' ? '...' : item.status }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-gray-400">
              <span>{{ item.voice_name }}</span>
              <span>·</span>
              <span>{{ new Date(item.timestamp).toLocaleTimeString() }}</span>
            </div>
            <audio v-if="item.audio_url" :src="item.audio_url" controls class="w-full mt-2 h-8" />
            <p v-if="item.error" class="text-xs text-red-500 mt-1">{{ item.error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VoiceConfig } from '~/types'
import { TEXT_LANGUAGES, SPLIT_METHODS } from '~/types'

const api = useApi()
const { voices, currentVoiceConfig: currentConfig, fetchVoices, selectVoice } = useVoices()
const { history, synthesizing, streamStatus, synthesize, synthesizeWs, clearHistory } = useTts()
const useWebSocket = ref(true)
const streamPlayer = useStreamPlayer()

const selectedVoiceId = ref('_default')
const inputText = ref('')
const textLang = ref('all_zh')
const speedFactor = ref(1.0)
const temperature = ref(1.0)
const splitMethod = ref('cut5')
const topK = ref(15)
const topP = ref(1.0)
const seed = ref(-1)
const batchSize = ref(1)

const applying = ref(false)
const appliedGpt = useState<string>('appliedGpt', () => '')
const appliedSovits = useState<string>('appliedSovits', () => '')

const modelMatched = computed(() => {
  if (!currentConfig.value) return false
  const cfg = currentConfig.value
  return cfg.model.gpt_weights === appliedGpt.value && cfg.model.sovits_weights === appliedSovits.value
})

// 声音配置的基准参数（用于滑条上显示参考标记）
const refParams = ref<Record<string, number> | null>(null)

const canSynthesize = computed(() => {
  return inputText.value.trim().length > 0 && currentConfig.value && !synthesizing.value
})

function shortPath(path: string): string {
  if (!path) return '-'
  const parts = path.split('/')
  return parts.length > 1 ? parts.slice(-2).join('/') : path
}

async function onVoiceChange() {
  if (selectedVoiceId.value === '_default') {
    currentConfig.value = await api.getDefaultConfig()
  } else {
    await selectVoice(selectedVoiceId.value)
  }
  if (currentConfig.value) {
    applyParamsFromConfig(currentConfig.value)
  }
  // 缓存用户选择
  api.saveSettings({ last_voice_id: selectedVoiceId.value }).catch(() => {})
}

function applyParamsFromConfig(cfg: VoiceConfig) {
  const p = cfg.params
  textLang.value = p.text_lang
  speedFactor.value = p.speed_factor
  temperature.value = p.temperature
  splitMethod.value = p.text_split_method
  topK.value = p.top_k
  topP.value = p.top_p
  seed.value = p.seed
  batchSize.value = p.batch_size
  refParams.value = {
    speed_factor: p.speed_factor,
    temperature: p.temperature,
    top_k: p.top_k,
    top_p: p.top_p,
  }
}

async function handleApply() {
  if (!currentConfig.value || applying.value) return
  if (modelMatched.value) return

  applying.value = true
  try {
    const cfg = currentConfig.value
    if (cfg.model.gpt_weights && cfg.model.gpt_weights !== appliedGpt.value) {
      await api.setGptWeights(cfg.model.gpt_weights)
    }
    if (cfg.model.sovits_weights && cfg.model.sovits_weights !== appliedSovits.value) {
      await api.setSovitsWeights(cfg.model.sovits_weights)
    }
    appliedGpt.value = cfg.model.gpt_weights
    appliedSovits.value = cfg.model.sovits_weights
  } catch (e: any) {
    alert(e?.data?.message || e?.message || '模型切换失败')
  } finally {
    applying.value = false
  }
}

async function handleSynthesize() {
  if (!canSynthesize.value) return

  const voiceName = selectedVoiceId.value === '_default'
    ? '默认'
    : (voices.value.find((v: any) => v.id === selectedVoiceId.value)?.name || selectedVoiceId.value)

  const overrides = {
    text_lang: textLang.value,
    speed_factor: speedFactor.value,
    temperature: temperature.value,
    text_split_method: splitMethod.value,
    top_k: topK.value,
    top_p: topP.value,
    seed: seed.value,
    batch_size: batchSize.value,
  }

  let result
  if (useWebSocket.value) {
    // 初始化流式播放器
    streamPlayer.init()
    result = await synthesizeWs({
      text: inputText.value,
      voice_id: selectedVoiceId.value,
      voice_name: voiceName,
      overrides,
      onChunk: (chunk: ArrayBuffer) => {
        streamPlayer.feedChunk(chunk)
      },
    })
  } else {
    result = await synthesize({
      text: inputText.value,
      voice_id: selectedVoiceId.value,
      voice_name: voiceName,
      overrides,
    })
  }

  // 合成成功后更新已应用的模型状态
  if (result.status === 'done' && currentConfig.value) {
    appliedGpt.value = currentConfig.value.model.gpt_weights
    appliedSovits.value = currentConfig.value.model.sovits_weights
  }
}

onMounted(async () => {
  await fetchVoices()
  // 从后端加载上次选择的声音
  try {
    const settings = await api.getSettings()
    const lastId = (settings.last_voice_id as string) || '_default'
    selectedVoiceId.value = lastId
  } catch { /* 默认值 */ }

  // 加载对应配置
  if (selectedVoiceId.value === '_default') {
    currentConfig.value = await api.getDefaultConfig()
  } else {
    await selectVoice(selectedVoiceId.value)
  }
  if (currentConfig.value) {
    applyParamsFromConfig(currentConfig.value)
  }
})
</script>
