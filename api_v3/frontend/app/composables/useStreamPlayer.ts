/**
 * 流式音频播放器 - 使用 Web Audio API
 *
 * 收到第一个 chunk 即可开始播放，后续 chunk 排队追加。
 * 后端发送的是 raw PCM（WAV header + raw data），需要解码后播放。
 */
export function useStreamPlayer() {
  let audioCtx: AudioContext | null = null
  let nextStartTime = 0
  let isPlaying = false
  let scheduledBuffers: AudioBufferSourceNode[] = []

  const playing = ref(false)
  const chunksReceived = ref(0)

  function init() {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    nextStartTime = audioCtx.currentTime
    isPlaying = false
    chunksReceived.value = 0
    scheduledBuffers = []
    playing.value = false
  }

  async function feedChunk(data: ArrayBuffer) {
    if (!audioCtx) init()
    const ctx = audioCtx!

    // 如果 AudioContext 被暂停（浏览器策略），恢复它
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    chunksReceived.value++

    try {
      // 解码音频数据（支持 WAV/PCM）
      const audioBuffer = await ctx.decodeAudioData(data.slice(0))

      // 创建 source 节点
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)

      // 排队播放：确保 chunk 按顺序无缝衔接
      const startAt = Math.max(ctx.currentTime, nextStartTime)
      source.start(startAt)
      nextStartTime = startAt + audioBuffer.duration

      scheduledBuffers.push(source)
      playing.value = true
      isPlaying = true

      // 播放完成后清理
      source.onended = () => {
        const idx = scheduledBuffers.indexOf(source)
        if (idx >= 0) scheduledBuffers.splice(idx, 1)
        if (scheduledBuffers.length === 0) {
          playing.value = false
          isPlaying = false
        }
      }
    } catch {
      // decodeAudioData 可能失败（如果 chunk 不是完整的可解码音频）
      // 对于 raw PCM chunk（非第一个），需要手动构造 WAV
      // 后端已经在第一个 chunk 加了 WAV header，后续是 raw PCM
      // 尝试作为 raw 16-bit PCM 处理
      try {
        await feedRawPcm(data, ctx)
      } catch {
        // 无法解码，跳过
      }
    }
  }

  async function feedRawPcm(data: ArrayBuffer, ctx: AudioContext) {
    // 假设 16-bit PCM, mono, 32000Hz（GPT-SoVITS 默认输出）
    const sampleRate = 32000
    const int16 = new Int16Array(data)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = (int16[i] ?? 0) / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate)
    audioBuffer.getChannelData(0).set(float32)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    const startAt = Math.max(ctx.currentTime, nextStartTime)
    source.start(startAt)
    nextStartTime = startAt + audioBuffer.duration

    scheduledBuffers.push(source)
    playing.value = true
    isPlaying = true

    source.onended = () => {
      const idx = scheduledBuffers.indexOf(source)
      if (idx >= 0) scheduledBuffers.splice(idx, 1)
      if (scheduledBuffers.length === 0) {
        playing.value = false
        isPlaying = false
      }
    }
  }

  function stop() {
    scheduledBuffers.forEach((s) => {
      try { s.stop() } catch { /* already stopped */ }
    })
    scheduledBuffers = []
    playing.value = false
    isPlaying = false
    nextStartTime = 0
  }

  function destroy() {
    stop()
    if (audioCtx) {
      audioCtx.close()
      audioCtx = null
    }
  }

  return {
    playing,
    chunksReceived,
    init,
    feedChunk,
    stop,
    destroy,
  }
}
