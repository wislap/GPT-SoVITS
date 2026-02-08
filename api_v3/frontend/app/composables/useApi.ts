import type { VoiceConfig, VoiceListItem, HealthResponse } from '~/types'

async function apiFetch<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string) || '/api/v3'
  return await $fetch<T>(`${base}${path}`, options as any)
}

export function useApi() {
  async function getHealth(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>('/health')
  }

  async function listVoices(): Promise<VoiceListItem[]> {
    return apiFetch<VoiceListItem[]>('/voices')
  }

  async function getVoice(voiceId: string): Promise<VoiceConfig> {
    return apiFetch<VoiceConfig>(`/voices/${voiceId}`)
  }

  async function getDefaultConfig(): Promise<VoiceConfig> {
    return apiFetch<VoiceConfig>('/config/default')
  }

  async function reloadConfig(): Promise<{ status: string; message: string }> {
    return apiFetch('/config/reload', { method: 'POST' })
  }

  async function listVoicesFull(): Promise<VoiceConfig[]> {
    return apiFetch<VoiceConfig[]>('/voices/full')
  }

  async function createVoice(config: VoiceConfig): Promise<VoiceConfig> {
    return apiFetch<VoiceConfig>('/voices', { method: 'POST', body: config })
  }

  async function updateVoice(voiceId: string, config: VoiceConfig): Promise<VoiceConfig> {
    return apiFetch<VoiceConfig>(`/voices/${voiceId}`, { method: 'PUT', body: config })
  }

  async function deleteVoice(voiceId: string): Promise<{ status: string; deleted: string }> {
    return apiFetch(`/voices/${voiceId}`, { method: 'DELETE' })
  }

  async function batchDeleteVoices(ids: string[]): Promise<{ status: string; deleted: string[]; not_found: string[] }> {
    return apiFetch('/voices/batch-delete', { method: 'POST', body: { ids } })
  }

  return {
    getHealth,
    listVoices,
    listVoicesFull,
    getVoice,
    getDefaultConfig,
    reloadConfig,
    createVoice,
    updateVoice,
    deleteVoice,
    batchDeleteVoices,
  }
}
