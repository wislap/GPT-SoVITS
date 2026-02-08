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

  // ─── 双向流式 WebSocket 会话（stream-input 协议）───

  // 会话状态
  const wsConnected = useState<boolean>('wsConnected', () => false)
  const wsSentences = useState<number>('wsSentences', () => 0)
  let _ws: WebSocket | null = null
  let _allChunks: ArrayBuffer[] = []
  let _currentSentenceChunks: ArrayBuffer[] = []
  let _onChunkCb: ((chunk: ArrayBuffer) => void) | null = null
  let _sessionItem: SynthesisHistoryItem | null = null

  /**
   * 打开双向流式 WS 会话：发送 init 指令，等待 ready
   */
  function wsOpen(params: {
    voice_id: string
    voice_name: string
    overrides?: Record<string, unknown>
    onChunk?: (chunk: ArrayBuffer) => void
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      _onChunkCb = params.onChunk || null
      _allChunks = []
      _currentSentenceChunks = []
      wsSentences.value = 0
      streamStatus.value = 'connecting'

      // 创建一个会话级的 history item
      _sessionItem = {
        id: Date.now().toString(),
        text: '',
        voice_id: params.voice_id,
        voice_name: params.voice_name,
        params: params.overrides || {},
        audio_url: null,
        timestamp: Date.now(),
        status: 'synthesizing',
      }
      history.value.unshift(_sessionItem)
      _sessionItem = history.value[0]!  // 取 Vue 代理后的引用
      synthesizing.value = true

      const wsUrl = _buildWsUrl('/api/v3/tts/stream-input')
      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      _ws = ws

      let initResolved = false

      ws.onopen = () => {
        // 发送 init 指令
        const initMsg: Record<string, unknown> = {
          cmd: 'init',
          voice_id: params.voice_id,
          ...params.overrides,
        }
        ws.send(JSON.stringify(initMsg))
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          _allChunks.push(event.data)
          _currentSentenceChunks.push(event.data)
          streamStatus.value = 'streaming'
          _onChunkCb?.(event.data)
        } else {
          try {
            const msg = JSON.parse(event.data)
            console.log('[stream-input] msg:', msg)
            if (msg.type === 'ready') {
              wsConnected.value = true
              streamStatus.value = 'ready'
              if (!initResolved) { initResolved = true; resolve() }
            } else if (msg.type === 'sentence') {
              streamStatus.value = `合成: ${msg.text}`
              _currentSentenceChunks = []
            } else if (msg.type === 'sentence_done') {
              wsSentences.value++
              streamStatus.value = `已完成 ${wsSentences.value} 句`
            } else if (msg.type === 'flushed') {
              streamStatus.value = 'flushed'
            } else if (msg.type === 'done') {
              console.log('[stream-input] session done, finalizing...')
              _finalizeSession()
            } else if (msg.type === 'error') {
              console.error('[stream-input] error:', msg.message)
              if (!initResolved) { initResolved = true; reject(new Error(msg.message)) }
              streamStatus.value = `错误: ${msg.message}`
            }
          } catch { /* 忽略非 JSON */ }
        }
      }

      ws.onerror = () => {
        if (!initResolved) { initResolved = true; reject(new Error('WebSocket 连接失败')) }
        wsConnected.value = false
        streamStatus.value = ''
      }

      ws.onclose = (ev) => {
        console.log('[stream-input] ws closed, code:', ev.code, 'reason:', ev.reason)
        wsConnected.value = false
        if (_sessionItem && _sessionItem.status === 'synthesizing') {
          console.log('[stream-input] unexpected close, finalizing...')
          _finalizeSession()
        }
        _ws = null
        streamStatus.value = ''
      }
    })
  }

  /**
   * 通过已有 WS 连接发送文本
   */
  function wsSendText(text: string) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return
    // 更新 history item 的文本
    if (_sessionItem) {
      _sessionItem.text += (_sessionItem.text ? '\n' : '') + text
    }
    _ws.send(JSON.stringify({ cmd: 'text', data: text }))
  }

  /**
   * 强制合成缓冲区中的剩余文本
   */
  function wsFlush() {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return
    _ws.send(JSON.stringify({ cmd: 'flush' }))
    streamStatus.value = 'flushing...'
  }

  /**
   * 结束会话：flush + 关闭
   */
  function wsEnd() {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return
    _ws.send(JSON.stringify({ cmd: 'end' }))
    streamStatus.value = 'ending...'
  }

  /**
   * 会话结束时的清理
   */
  function _finalizeSession() {
    if (_sessionItem) {
      if (_allChunks.length > 0) {
        const blob = mergeWavChunks(_allChunks)
        _sessionItem.audio_url = URL.createObjectURL(blob)
        _sessionItem.status = 'done'
      } else {
        _sessionItem.status = _sessionItem.text ? 'error' : 'done'
        if (!_sessionItem.text) _sessionItem.error = '无音频数据'
      }
    }
    synthesizing.value = false
    wsConnected.value = false
    streamStatus.value = ''
    wsSentences.value = 0
    _allChunks = []
    _currentSentenceChunks = []
    _sessionItem = null
    _ws = null
  }

  function _buildWsUrl(path: string = '/api/v3/tts/stream'): string {
    const loc = window.location
    // 开发模式下直连后端 9881 端口（Nuxt devProxy 不代理 WS）
    const isDev = loc.port === '3000' || loc.port === '3001'
    if (isDev) {
      return `ws://${loc.hostname}:9881${path}`
    }
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${loc.host}${path}`
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
    wsConnected,
    wsSentences,
    synthesize,
    wsOpen,
    wsSendText,
    wsFlush,
    wsEnd,
    clearHistory,
  }
}
