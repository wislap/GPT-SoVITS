import type { SynthesisHistoryItem } from '~/types'

export function useTts() {
  const history = useState<SynthesisHistoryItem[]>('ttsHistory', () => [])
  const synthesizing = useState<boolean>('ttsSynthesizing', () => false)

  async function synthesize(params: {
    text: string
    voice_id: string
    voice_name: string
    overrides?: Record<string, unknown>
  }): Promise<SynthesisHistoryItem> {
    const item: SynthesisHistoryItem = {
      id: Date.now().toString(),
      text: params.text,
      voice_id: params.voice_id,
      voice_name: params.voice_name,
      params: params.overrides || {},
      audio_url: null,
      timestamp: Date.now(),
      status: 'pending',
    }

    history.value.unshift(item)
    synthesizing.value = true
    item.status = 'synthesizing'

    try {
      const config = useRuntimeConfig()
      const base = config.public.apiBase || '/api/v3'

      const body = {
        text: params.text,
        voice_id: params.voice_id,
        ...params.overrides,
      }

      const response = await $fetch<Blob>(`${base}/tts`, {
        method: 'POST',
        body,
        responseType: 'blob',
      })

      item.audio_url = URL.createObjectURL(response)
      item.status = 'done'
    } catch (e: any) {
      item.status = 'error'
      item.error = e?.message || '合成失败'
    } finally {
      synthesizing.value = false
    }

    return item
  }

  function clearHistory() {
    history.value.forEach((item) => {
      if (item.audio_url) URL.revokeObjectURL(item.audio_url)
    })
    history.value = []
  }

  return {
    history,
    synthesizing,
    synthesize,
    clearHistory,
  }
}
