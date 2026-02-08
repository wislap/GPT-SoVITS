import type { VoiceListItem, VoiceConfig } from '~/types'

export function useVoices() {
  const api = useApi()
  const voices = useState<VoiceListItem[]>('voices', () => [])
  const currentVoiceId = useState<string>('currentVoiceId', () => '')
  const currentVoiceConfig = useState<VoiceConfig | null>('currentVoiceConfig', () => null)
  const loading = useState<boolean>('voicesLoading', () => false)

  async function fetchVoices() {
    loading.value = true
    try {
      voices.value = await api.listVoices()
      if (voices.value.length > 0 && !currentVoiceId.value) {
        await selectVoice(voices.value[0].id)
      }
    } finally {
      loading.value = false
    }
  }

  async function selectVoice(voiceId: string) {
    currentVoiceId.value = voiceId
    try {
      currentVoiceConfig.value = await api.getVoice(voiceId)
    } catch (e) {
      currentVoiceConfig.value = null
    }
  }

  return {
    voices,
    currentVoiceId,
    currentVoiceConfig,
    loading,
    fetchVoices,
    selectVoice,
  }
}
