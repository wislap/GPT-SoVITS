export interface VoiceInfo {
  id: string
  name: string
  description: string
}

export interface ModelConfig {
  gpt_weights: string
  sovits_weights: string
  version: string
}

export interface RefAudioConfig {
  path: string
  prompt_text: string
  prompt_lang: string
  aux_ref_audio_paths: string[]
}

export interface InferParams {
  text_lang: string
  text_split_method: string
  top_k: number
  top_p: number
  temperature: number
  repetition_penalty: number
  seed: number
  batch_size: number
  batch_threshold: number
  split_bucket: boolean
  parallel_infer: boolean
  speed_factor: number
  fragment_interval: number
  sample_steps: number
  super_sampling: boolean
  streaming_mode: boolean
  return_fragment: boolean
  overlap_length: number
  min_chunk_length: number
  fixed_length_chunk: boolean
}

export interface OutputConfig {
  media_type: string
}

export interface VoiceConfig {
  voice: VoiceInfo
  model: ModelConfig
  ref_audio: RefAudioConfig
  params: InferParams
  output: OutputConfig
}

export interface VoiceListItem {
  id: string
  name: string
  description: string
  version: string
}

export interface HealthResponse {
  status: string
  version: string
  voices_count: number
}

export interface TtsRequest {
  text: string
  voice_id: string
  text_lang?: string
  speed_factor?: number
  temperature?: number
  top_k?: number
  top_p?: number
  streaming_mode?: boolean
  media_type?: string
}

export interface SynthesisHistoryItem {
  id: string
  text: string
  voice_id: string
  voice_name: string
  params: Partial<InferParams>
  audio_url: string | null
  timestamp: number
  status: 'pending' | 'synthesizing' | 'done' | 'error'
  error?: string
}

export const TEXT_LANGUAGES = [
  { value: 'all_zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'all_ja', label: '日本語' },
  { value: 'all_ko', label: '한국어' },
  { value: 'all_yue', label: '粤语' },
  { value: 'zh', label: '中英混合' },
  { value: 'ja', label: '日英混合' },
  { value: 'yue', label: '粤英混合' },
  { value: 'ko', label: '韩英混合' },
  { value: 'auto', label: '自动识别' },
  { value: 'auto_yue', label: '自动识别(粤语)' },
] as const

export const SPLIT_METHODS = [
  { value: 'cut0', label: '不切' },
  { value: 'cut1', label: '凑四句一切' },
  { value: 'cut2', label: '凑50字一切' },
  { value: 'cut3', label: '按中文句号切' },
  { value: 'cut4', label: '按英文句号切' },
  { value: 'cut5', label: '按标点符号切' },
] as const

export const MEDIA_TYPES = [
  { value: 'wav', label: 'WAV' },
  { value: 'ogg', label: 'OGG' },
  { value: 'aac', label: 'AAC' },
] as const
