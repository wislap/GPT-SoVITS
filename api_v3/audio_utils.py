"""
GPT-SoVITS API v3 - 音频打包工具函数

从 api_v2.py 提取，供 TTS 路由复用。
支持 wav / ogg / aac / raw 格式的音频编码。
"""

import subprocess
import threading
import wave
from io import BytesIO

import numpy as np
import soundfile as sf


def pack_ogg(io_buffer: BytesIO, data: np.ndarray, rate: int) -> BytesIO:
    """将音频数据编码为 OGG 格式（使用独立线程避免 libsndfile 栈溢出）"""

    def handle_pack_ogg():
        with sf.SoundFile(io_buffer, mode="w", samplerate=rate, channels=1, format="ogg") as audio_file:
            audio_file.write(data)

    # stack_size = n * 4096, n = 4096 以避免大音频时的栈溢出
    stack_size = 4096 * 4096
    try:
        threading.stack_size(stack_size)
        pack_ogg_thread = threading.Thread(target=handle_pack_ogg)
        pack_ogg_thread.start()
        pack_ogg_thread.join()
    except RuntimeError as e:
        print(f"RuntimeError: {e}")
        print("Changing the thread stack size is unsupported.")
    except ValueError as e:
        print(f"ValueError: {e}")
        print("The specified stack size is invalid.")

    return io_buffer


def pack_raw(io_buffer: BytesIO, data: np.ndarray, rate: int) -> BytesIO:
    """将音频数据写入为原始 PCM 字节"""
    io_buffer.write(data.tobytes())
    return io_buffer


def pack_wav(io_buffer: BytesIO, data: np.ndarray, rate: int) -> BytesIO:
    """将音频数据编码为 WAV 格式"""
    io_buffer = BytesIO()
    sf.write(io_buffer, data, rate, format="wav")
    return io_buffer


def pack_aac(io_buffer: BytesIO, data: np.ndarray, rate: int) -> BytesIO:
    """将音频数据编码为 AAC 格式（需要 ffmpeg）"""
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-f", "s16le",
            "-ar", str(rate),
            "-ac", "1",
            "-i", "pipe:0",
            "-c:a", "aac",
            "-b:a", "192k",
            "-vn",
            "-f", "adts",
            "pipe:1",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, _ = process.communicate(input=data.tobytes())
    io_buffer.write(out)
    return io_buffer


def pack_audio(io_buffer: BytesIO, data: np.ndarray, rate: int, media_type: str) -> BytesIO:
    """根据 media_type 选择对应的编码方式"""
    if media_type == "ogg":
        io_buffer = pack_ogg(io_buffer, data, rate)
    elif media_type == "aac":
        io_buffer = pack_aac(io_buffer, data, rate)
    elif media_type == "wav":
        io_buffer = pack_wav(io_buffer, data, rate)
    else:
        io_buffer = pack_raw(io_buffer, data, rate)
    io_buffer.seek(0)
    return io_buffer


def wave_header_chunk(frame_input: bytes = b"", channels: int = 1, sample_width: int = 2, sample_rate: int = 32000) -> bytes:
    """生成 WAV 文件头（用于流式 WAV 输出的首个 chunk）"""
    wav_buf = BytesIO()
    with wave.open(wav_buf, "wb") as vfout:
        vfout.setnchannels(channels)
        vfout.setsampwidth(sample_width)
        vfout.setframerate(sample_rate)
        vfout.writeframes(frame_input)
    wav_buf.seek(0)
    return wav_buf.read()
