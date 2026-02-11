import type { VoiceConfig, VoiceListItem, HealthResponse, ModelsResponse, ConvertTask } from '~/types'

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

  async function scanGptWeights(version?: string): Promise<{ files: string[] }> {
    const query = version ? `?version=${version}` : ''
    return apiFetch(`/scan/gpt-weights${query}`)
  }

  async function scanSovitsWeights(version?: string): Promise<{ files: string[] }> {
    const query = version ? `?version=${version}` : ''
    return apiFetch(`/scan/sovits-weights${query}`)
  }

  async function scanAudio(dir?: string): Promise<{ files: string[] }> {
    const query = dir ? `?dir=${encodeURIComponent(dir)}` : ''
    return apiFetch(`/scan/audio${query}`)
  }

  // ─── v2 兼容端点 ───

  async function setGptWeights(weightsPath: string): Promise<{ message: string }> {
    return await $fetch(`/api/v2/set_gpt_weights?weights_path=${encodeURIComponent(weightsPath)}`)
  }

  async function setSovitsWeights(weightsPath: string): Promise<{ message: string }> {
    return await $fetch(`/api/v2/set_sovits_weights?weights_path=${encodeURIComponent(weightsPath)}`)
  }

  async function listModels(type?: string, version?: string): Promise<ModelsResponse> {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (version) params.set('version', version)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<ModelsResponse>(`/models${query}`)
  }

  async function submitConvert(gptWeights: string, sovitsWeights: string, outputDir: string): Promise<{ task_id: string; status: string; error?: string }> {
    return apiFetch('/models/convert', {
      method: 'POST',
      body: { gpt_weights: gptWeights, sovits_weights: sovitsWeights, output_dir: outputDir },
    })
  }

  async function getConvertStatus(taskId: string): Promise<ConvertTask> {
    return apiFetch<ConvertTask>(`/models/convert/${taskId}`)
  }

  async function listConvertTasks(): Promise<{ tasks: ConvertTask[] }> {
    return apiFetch('/models/convert')
  }

  async function scanOnnxDirs(): Promise<{ dirs: string[] }> {
    return apiFetch('/models/scan/onnx')
  }

  async function getSettings(): Promise<Record<string, unknown>> {
    return apiFetch('/settings')
  }

  async function saveSettings(data: Record<string, unknown>): Promise<{ status: string }> {
    return apiFetch('/settings', { method: 'PUT', body: data })
  }

  async function ttsV2(params: Record<string, unknown>): Promise<Blob> {
    return await $fetch<Blob>(`/api/v2/tts`, {
      method: 'POST',
      body: params,
      responseType: 'blob',
    })
  }

  // ─── v3 推理端点 ───

  async function ttsSubmit(params: Record<string, unknown>): Promise<{ task_id: number; timestamp: number; status: string }> {
    return apiFetch('/tts', { method: 'POST', body: params })
  }

  async function ttsTaskStatus(taskId: number): Promise<Record<string, unknown>> {
    return apiFetch(`/tts/${taskId}`)
  }

  async function ttsTaskAudio(taskId: number): Promise<Blob> {
    const config = useRuntimeConfig()
    const base = (config.public.apiBase as string) || '/api/v3'
    return await $fetch<Blob>(`${base}/tts/${taskId}/audio`, { responseType: 'blob' })
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
    scanGptWeights,
    scanSovitsWeights,
    scanAudio,
    setGptWeights,
    setSovitsWeights,
    ttsV2,
    ttsSubmit,
    ttsTaskStatus,
    ttsTaskAudio,
    listModels,
    submitConvert,
    getConvertStatus,
    listConvertTasks,
    scanOnnxDirs,
    getSettings,
    saveSettings,
  }
}
