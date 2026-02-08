import type { SynthesisHistoryItem } from '~/types'

/**
 * 将多个独立 WAV 文件合并为单个 WAV。
 * 每个 chunk 是完整 WAV（含 header），提取 PCM 数据后重新打包。
 */
function mergeWavChunks(chunks: ArrayBuffer[]): Blob {
  if (chunks.length === 0) return new Blob([], { type: 'audio/wav' })
  if (chunks.length === 1) return new Blob([chunks[0]!], { type: 'audio/wav' })

  // 从第一个 chunk 读取 WAV 参数
  const firstView = new DataView(chunks[0]!)
  const numChannels = firstView.getUint16(22, true)
  const sampleRate = firstView.getUint32(24, true)
  const bitsPerSample = firstView.getUint16(34, true)

  // 提取每个 chunk 的 PCM 数据（跳过各自的 WAV header）
  const pcmParts: Uint8Array[] = []
  let totalPcmLen = 0
  for (const chunk of chunks) {
    const view = new DataView(chunk)
    // 查找 'data' 子块
    let offset = 12 // 跳过 RIFF header (12 bytes)
    while (offset < view.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3),
      )
      const chunkSize = view.getUint32(offset + 4, true)
      if (chunkId === 'data') {
        const pcm = new Uint8Array(chunk, offset + 8, chunkSize)
        pcmParts.push(pcm)
        totalPcmLen += chunkSize
        break
      }
      offset += 8 + chunkSize
    }
  }

  // 构建新的 WAV 文件
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + totalPcmLen)
  const out = new DataView(buffer)

  // RIFF header
  writeString(out, 0, 'RIFF')
  out.setUint32(4, 36 + totalPcmLen, true)
  writeString(out, 8, 'WAVE')
  // fmt sub-chunk
  writeString(out, 12, 'fmt ')
  out.setUint32(16, 16, true) // SubChunk1Size (PCM)
  out.setUint16(20, 1, true)  // AudioFormat (PCM)
  out.setUint16(22, numChannels, true)
  out.setUint32(24, sampleRate, true)
  out.setUint32(28, byteRate, true)
  out.setUint16(32, blockAlign, true)
  out.setUint16(34, bitsPerSample, true)
  // data sub-chunk
  writeString(out, 36, 'data')
  out.setUint32(40, totalPcmLen, true)

  // 写入 PCM 数据
  const outBytes = new Uint8Array(buffer)
  let pos = headerSize
  for (const pcm of pcmParts) {
    outBytes.set(pcm, pos)
    pos += pcm.byteLength
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

export function useTts() {
  const api = useApi()
  const history = useState<SynthesisHistoryItem[]>('ttsHistory', () => [])
  const synthesizing = useState<boolean>('ttsSynthesizing', () => false)
  const streamStatus = useState<string>('ttsStreamStatus', () => '')

  // ─── REST 模式：提交 + 获取完整音频 ───

  async function synthesize(params: {
    text: string
    voice_id: string
    voice_name: string
    overrides?: Record<string, unknown>
  }): Promise<SynthesisHistoryItem> {
    const item = _createItem(params)
    history.value.unshift(item)
    synthesizing.value = true
    item.status = 'synthesizing'

    try {
      const submitBody: Record<string, unknown> = {
        text: params.text,
        voice_id: params.voice_id,
        ...params.overrides,
      }
      const result = await api.ttsSubmit(submitBody)
      item.id = String(result.task_id)

      const audioBlob = await api.ttsTaskAudio(result.task_id)
      item.audio_url = URL.createObjectURL(audioBlob)
      item.status = 'done'
    } catch (e: any) {
      item.status = 'error'
      item.error = e?.data?.message || e?.message || '合成失败'
    } finally {
      synthesizing.value = false
      streamStatus.value = ''
    }

    return item
  }

  // ─── WebSocket 模式：流式接收 + 实时播放 ───

  async function synthesizeWs(params: {
    text: string
    voice_id: string
    voice_name: string
    overrides?: Record<string, unknown>
    onChunk?: (chunk: ArrayBuffer) => void
  }): Promise<SynthesisHistoryItem> {
    const item = _createItem(params)
    history.value.unshift(item)
    synthesizing.value = true
    item.status = 'synthesizing'
    streamStatus.value = 'connecting'

    return new Promise((resolve) => {
      const chunks: ArrayBuffer[] = []
      const wsUrl = _buildWsUrl()
      const ws = new WebSocket(wsUrl)

      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        streamStatus.value = 'queued'
        const body: Record<string, unknown> = {
          text: params.text,
          voice_id: params.voice_id,
          ...params.overrides,
        }
        ws.send(JSON.stringify(body))
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // 二进制：音频 chunk
          chunks.push(event.data)
          streamStatus.value = 'streaming'
          params.onChunk?.(event.data)
        } else {
          // JSON 消息
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'accepted') {
              item.id = String(msg.task_id)
              streamStatus.value = 'queued'
            } else if (msg.type === 'status') {
              streamStatus.value = msg.status
            } else if (msg.type === 'done') {
              // 合并所有 WAV chunk 为单个完整 WAV
              const blob = mergeWavChunks(chunks)
              item.audio_url = URL.createObjectURL(blob)
              item.status = 'done'
              _finish(resolve, item)
              ws.close()
            } else if (msg.type === 'error') {
              item.status = 'error'
              item.error = msg.message
              _finish(resolve, item)
              ws.close()
            }
          } catch { /* 忽略非 JSON */ }
        }
      }

      ws.onerror = () => {
        item.status = 'error'
        item.error = 'WebSocket 连接失败'
        _finish(resolve, item)
      }

      ws.onclose = () => {
        if (item.status === 'synthesizing') {
          // 意外关闭
          if (chunks.length > 0) {
            const blob = mergeWavChunks(chunks)
            item.audio_url = URL.createObjectURL(blob)
            item.status = 'done'
          } else {
            item.status = 'error'
            item.error = '连接意外关闭'
          }
          _finish(resolve, item)
        }
      }
    })
  }

  function _finish(resolve: (item: SynthesisHistoryItem) => void, item: SynthesisHistoryItem) {
    synthesizing.value = false
    streamStatus.value = ''
    resolve(item)
  }

  function _buildWsUrl(): string {
    const loc = window.location
    // 开发模式下直连后端 9881 端口（Nuxt devProxy 不代理 WS）
    const isDev = loc.port === '3000' || loc.port === '3001'
    if (isDev) {
      return `ws://${loc.hostname}:9881/api/v3/tts/stream`
    }
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${loc.host}/api/v3/tts/stream`
  }

  function _createItem(params: { text: string; voice_id: string; voice_name: string; overrides?: Record<string, unknown> }): SynthesisHistoryItem {
    return {
      id: Date.now().toString(),
      text: params.text,
      voice_id: params.voice_id,
      voice_name: params.voice_name,
      params: params.overrides || {},
      audio_url: null,
      timestamp: Date.now(),
      status: 'pending',
    }
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
    streamStatus,
    synthesize,
    synthesizeWs,
    clearHistory,
  }
}
