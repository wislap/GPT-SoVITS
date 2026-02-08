<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
    <!-- 左侧：输入区 -->
    <div class="lg:col-span-2 space-y-4">
      <!-- 声音选择 + 语言 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {{ $t('tts.refAudio') }}
            </label>
            <select
              v-model="selectedVoiceId"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              @change="onVoiceChange"
            >
              <option value="" disabled>{{ $t('tts.inputPlaceholder') }}</option>
              <option v-for="v in voices" :key="v.id" :value="v.id">
                {{ v.name }} ({{ v.version }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {{ $t('tts.textLang') }}
            </label>
            <select
              v-model="textLang"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option v-for="lang in TEXT_LANGUAGES" :key="lang.value" :value="lang.value">
                {{ lang.label }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 文本输入 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {{ $t('tts.inputText') }}
        </label>
        <textarea
          v-model="inputText"
          :placeholder="$t('tts.inputPlaceholder')"
          rows="6"
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div class="flex items-center justify-between mt-3">
          <span class="text-xs text-gray-400">{{ inputText.length }} {{ $t('common.chars') }}</span>
          <div class="flex gap-2">
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

      <!-- 快捷参数 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('params.title') }}
          </h3>
          <button
            class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? $t('params.collapse') : $t('params.expand') }}
          </button>
        </div>

        <!-- 常用参数 -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{{ $t('params.speed') }}</span>
              <span class="font-mono">{{ speedFactor.toFixed(2) }}</span>
            </label>
            <input
              v-model.number="speedFactor"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              class="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{{ $t('params.temperature') }}</span>
              <span class="font-mono">{{ temperature.toFixed(2) }}</span>
            </label>
            <input
              v-model.number="temperature"
              type="range"
              min="0.1"
              max="2.0"
              step="0.05"
              class="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('params.splitMethod') }}
            </label>
            <select
              v-model="splitMethod"
              class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
            >
              <option v-for="m in SPLIT_METHODS" :key="m.value" :value="m.value">
                {{ m.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- 高级参数 -->
        <div v-if="showAdvanced" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{{ $t('params.topK') }}</span>
                <span class="font-mono">{{ topK }}</span>
              </label>
              <input v-model.number="topK" type="range" min="1" max="50" step="1" class="w-full accent-indigo-600" />
            </div>
            <div>
              <label class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{{ $t('params.topP') }}</span>
                <span class="font-mono">{{ topP.toFixed(2) }}</span>
              </label>
              <input v-model.number="topP" type="range" min="0.0" max="1.0" step="0.05" class="w-full accent-indigo-600" />
            </div>
            <div>
              <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ $t('params.seed') }}</label>
              <input
                v-model.number="seed"
                type="number"
                class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ $t('params.batchSize') }}</label>
              <input
                v-model.number="batchSize"
                type="number"
                min="1"
                max="32"
                class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：结果区 -->
    <div class="space-y-4">
      <!-- 当前参考音频 -->
      <div v-if="currentConfig" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {{ $t('tts.refAudio') }}
        </h3>
        <div class="space-y-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <span class="font-medium">{{ $t('tts.promptText') }}:</span>
            {{ currentConfig.ref_audio.prompt_text || '-' }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <span class="font-medium">{{ $t('tts.promptLang') }}:</span>
            {{ currentConfig.ref_audio.prompt_lang }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <span class="font-medium">{{ $t('models.sovitsWeights') }}:</span>
            {{ currentConfig.model.version }}
          </div>
        </div>
      </div>

      <!-- 合成结果 -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('tts.result') }}
          </h3>
          <button
            v-if="history.length > 0"
            class="text-xs text-red-500 hover:underline"
            @click="clearHistory"
          >
            {{ $t('common.reset') }}
          </button>
        </div>

        <div v-if="history.length === 0" class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          {{ $t('tts.inputPlaceholder') }}
        </div>

        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div
            v-for="item in history"
            :key="item.id"
            class="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750"
          >
            <div class="flex items-start justify-between mb-2">
              <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 flex-1">
                {{ item.text }}
              </p>
              <span
                class="ml-2 shrink-0 text-xs px-1.5 py-0.5 rounded"
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
            <div class="flex items-center gap-2 text-xs text-gray-400">
              <span>{{ item.voice_name }}</span>
              <span>·</span>
              <span>{{ new Date(item.timestamp).toLocaleTimeString() }}</span>
            </div>
            <audio
              v-if="item.audio_url"
              :src="item.audio_url"
              controls
              class="w-full mt-2 h-8"
            />
            <p v-if="item.error" class="text-xs text-red-500 mt-1">{{ item.error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TEXT_LANGUAGES, SPLIT_METHODS } from '~/types'

const { voices, currentVoiceId, currentVoiceConfig: currentConfig, fetchVoices, selectVoice } = useVoices()
const { history, synthesizing, synthesize, clearHistory } = useTts()

const selectedVoiceId = ref('')
const inputText = ref('')
const textLang = ref('all_zh')
const speedFactor = ref(1.0)
const temperature = ref(1.0)
const splitMethod = ref('cut5')
const topK = ref(15)
const topP = ref(1.0)
const seed = ref(-1)
const batchSize = ref(1)
const showAdvanced = ref(false)

const canSynthesize = computed(() => {
  return inputText.value.trim().length > 0 && selectedVoiceId.value && !synthesizing.value
})

async function onVoiceChange() {
  if (selectedVoiceId.value) {
    await selectVoice(selectedVoiceId.value)
    if (currentConfig.value) {
      textLang.value = currentConfig.value.params.text_lang
      speedFactor.value = currentConfig.value.params.speed_factor
      temperature.value = currentConfig.value.params.temperature
      splitMethod.value = currentConfig.value.params.text_split_method
      topK.value = currentConfig.value.params.top_k
      topP.value = currentConfig.value.params.top_p
      seed.value = currentConfig.value.params.seed
      batchSize.value = currentConfig.value.params.batch_size
    }
  }
}

async function handleSynthesize() {
  if (!canSynthesize.value) return

  const voiceName = voices.value.find(v => v.id === selectedVoiceId.value)?.name || selectedVoiceId.value

  await synthesize({
    text: inputText.value,
    voice_id: selectedVoiceId.value,
    voice_name: voiceName,
    overrides: {
      text_lang: textLang.value,
      speed_factor: speedFactor.value,
      temperature: temperature.value,
      text_split_method: splitMethod.value,
      top_k: topK.value,
      top_p: topP.value,
      seed: seed.value,
      batch_size: batchSize.value,
    },
  })
}

onMounted(() => {
  fetchVoices()
})
</script>
