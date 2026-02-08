import type { VoiceConfig, VoiceListItem, HealthResponse } from '~/types'

const API_BASE = '/api/v3'

async function apiFetch<T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: Record<string, any> }): Promise<T> {
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string) || API_BASE
  return await $fetch<T>(`${base}${path}`, options)
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

  async function createVoice(config: VoiceConfig): Promise<VoiceConfig> {
    return apiFetch<VoiceConfig>('/voices', { method: 'POST', body: config as unknown as Record<string, any> })
  }

  async function updateVoice(voiceId: string, config: VoiceConfig): Promise<VoiceConfig> {
    return apiFetch<VoiceConfig>(`/voices/${voiceId}`, { method: 'PUT', body: config as unknown as Record<string, any> })
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
    getVoice,
    getDefaultConfig,
    reloadConfig,
    createVoice,
    updateVoice,
    deleteVoice,
    batchDeleteVoices,
  }
}
