<template>
  <div class="space-y-6">
    <!-- 顶部导航 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          @click="router.push('/config')"
        >
          ← {{ $t('config.back') }}
        </button>
        <span class="text-gray-300 dark:text-gray-600">/</span>
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ isNew ? $t('config.newProfile') : (config?.voice.name || route.params.id) }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          @click="router.push('/config')"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          :disabled="saving"
          class="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
          @click="handleSave"
        >
          {{ saving ? '...' : $t('common.save') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400 text-sm">
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="config" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- ═══ 基本信息 ═══ -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ $t('config.voiceInfo') }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.voiceId') }}</label>
            <input
              v-model="config.voice.id"
              :disabled="!isNew"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g. my_voice"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.voiceName') }}</label>
            <input
              v-model="config.voice.name"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              placeholder="Display name"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.voiceDesc') }}</label>
            <textarea
              v-model="config.voice.description"
              rows="2"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-y"
              placeholder="Optional description"
            />
          </div>
        </div>
      </div>

      <!-- ═══ 模型配置 ═══ -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ $t('nav.models') }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.gptWeights') }}</label>
            <input
              v-model="config.model.gpt_weights"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono"
              placeholder="GPT_weights_v2/xxx.ckpt"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.sovitsWeights') }}</label>
            <input
              v-model="config.model.sovits_weights"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono"
              placeholder="SoVITS_weights_v2/xxx.pth"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('models.version') }}</label>
            <select
              v-model="config.model.version"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option value="v1">v1</option>
              <option value="v2">v2</option>
              <option value="v2Pro">v2Pro</option>
              <option value="v2ProPlus">v2ProPlus</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ═══ 参考音频 ═══ -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ $t('tts.refAudio') }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.audioPath') }}</label>
            <input
              v-model="config.ref_audio.path"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono"
              placeholder="voices/my_voice/ref.wav"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('tts.promptText') }}</label>
            <textarea
              v-model="config.ref_audio.prompt_text"
              rows="2"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-y"
              placeholder="参考音频对应的文本"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('tts.promptLang') }}</label>
            <select
              v-model="config.ref_audio.prompt_lang"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option v-for="lang in TEXT_LANGUAGES" :key="lang.value" :value="lang.value">
                {{ lang.label }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- ═══ 推理参数 ═══ -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ $t('params.title') }}</h2>
        <div class="space-y-4">
          <!-- 采样参数 -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">{{ $t('config.sampling') }}</h3>
            <div class="grid grid-cols-2 gap-3">
              <ParamInput v-model="config.params.top_k" :label="$t('params.topK')" type="number" :min="1" :max="100" />
              <ParamInput v-model="config.params.top_p" :label="$t('params.topP')" type="number" :min="0" :max="1" :step="0.05" />
              <ParamInput v-model="config.params.temperature" :label="$t('params.temperature')" type="number" :min="0.01" :max="2" :step="0.05" />
              <ParamInput v-model="config.params.repetition_penalty" :label="$t('params.repetitionPenalty')" type="number" :min="1" :max="2" :step="0.05" />
              <ParamInput v-model="config.params.seed" :label="$t('params.seed')" type="number" :min="-1" />
            </div>
          </div>

          <!-- 文本处理 -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">{{ $t('config.textProcessing') }}</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ $t('tts.textLang') }}</label>
                <select
                  v-model="config.params.text_lang"
                  class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs"
                >
                  <option v-for="lang in TEXT_LANGUAGES" :key="lang.value" :value="lang.value">{{ lang.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ $t('params.splitMethod') }}</label>
                <select
                  v-model="config.params.text_split_method"
                  class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs"
                >
                  <option v-for="m in SPLIT_METHODS" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 批处理 & 音频 -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">{{ $t('config.processing') }}</h3>
            <div class="grid grid-cols-2 gap-3">
              <ParamInput v-model="config.params.batch_size" :label="$t('params.batchSize')" type="number" :min="1" :max="32" />
              <ParamInput v-model="config.params.speed_factor" :label="$t('params.speed')" type="number" :min="0.25" :max="4" :step="0.05" />
              <ParamInput v-model="config.params.fragment_interval" :label="$t('params.fragmentInterval')" type="number" :min="0" :max="1" :step="0.05" />
              <ParamInput v-model="config.params.sample_steps" :label="$t('params.sampleSteps')" type="number" :min="1" :max="100" />
            </div>
          </div>

          <!-- 开关 -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">{{ $t('config.flags') }}</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <ToggleSwitch v-model="config.params.split_bucket" :label="$t('config.splitBucket')" />
              <ToggleSwitch v-model="config.params.parallel_infer" :label="$t('config.parallelInfer')" />
              <ToggleSwitch v-model="config.params.super_sampling" :label="$t('config.superSampling')" />
              <ToggleSwitch v-model="config.params.streaming_mode" :label="$t('config.streaming')" />
              <ToggleSwitch v-model="config.params.return_fragment" :label="$t('config.returnFragment')" />
              <ToggleSwitch v-model="config.params.fixed_length_chunk" :label="$t('config.fixedChunk')" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 输出配置 ═══ -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 lg:col-span-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ $t('config.output') }}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ $t('config.mediaType') }}</label>
            <select
              v-model="config.output.media_type"
              class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs"
            >
              <option v-for="t in MEDIA_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VoiceConfig } from '~/types'
import { TEXT_LANGUAGES, SPLIT_METHODS, MEDIA_TYPES } from '~/types'

const route = useRoute()
const router = useRouter()
const api = useApi()

const isNew = computed(() => route.params.id === 'new')
const loading = ref(true)
const saving = ref(false)
const config = ref<VoiceConfig | null>(null)

function makeEmptyConfig(): VoiceConfig {
  return {
    voice: { id: '', name: '', description: '' },
    model: { gpt_weights: '', sovits_weights: '', version: 'v2' },
    ref_audio: { path: '', prompt_text: '', prompt_lang: 'all_zh', aux_ref_audio_paths: [] },
    params: {
      text_lang: 'all_zh',
      text_split_method: 'cut5',
      top_k: 15,
      top_p: 1.0,
      temperature: 1.0,
      repetition_penalty: 1.35,
      seed: -1,
      batch_size: 1,
      batch_threshold: 0.75,
      split_bucket: true,
      parallel_infer: true,
      speed_factor: 1.0,
      fragment_interval: 0.3,
      sample_steps: 32,
      super_sampling: false,
      streaming_mode: false,
      return_fragment: false,
      overlap_length: 2,
      min_chunk_length: 16,
      fixed_length_chunk: false,
    },
    output: { media_type: 'wav' },
  }
}

async function handleSave() {
  if (!config.value) return
  saving.value = true
  try {
    if (isNew.value) {
      await api.createVoice(config.value)
    } else {
      await api.updateVoice(route.params.id as string, config.value)
    }
    router.push('/config')
  } catch (e: any) {
    const detail = e?.data?.detail || e?.message || '保存失败'
    alert(detail)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isNew.value) {
    config.value = makeEmptyConfig()
    loading.value = false
  } else {
    try {
      config.value = await api.getVoice(route.params.id as string)
    } catch {
      config.value = null
    } finally {
      loading.value = false
    }
  }
})
</script>
