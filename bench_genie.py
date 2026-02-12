"""
Genie-TTS CPU 推理性能 benchmark
用法: python bench_genie.py
"""
import sys, os, time
os.environ.setdefault("GENIE_DATA_DIR", "./GenieData")
sys.path.insert(0, "Genie-TTS/src")

import builtins
_orig = builtins.input
builtins.input = lambda *a, **kw: "n"
import genie_tts
builtins.input = _orig

import onnxruntime
import numpy as np

print(f"onnxruntime {onnxruntime.__version__}")
print(f"available providers: {onnxruntime.get_available_providers()}")
print(f"CPU threads (intra): {onnxruntime.get_all_providers()}")
print()

from genie_tts.ModelManager import model_manager
from genie_tts.Core.Inference import tts_client
from genie_tts.Audio.ReferenceAudio import ReferenceAudio

import tomli
with open("api_v3/voices/klala-onnx.toml", "rb") as fp:
    cfg = tomli.load(fp)
MODEL_DIR = cfg["model"]["onnx_model_dir"]
REF_AUDIO = cfg["ref_audio"]["path"]
REF_TEXT = cfg["ref_audio"]["prompt_text"]
TEST_TEXT = "你好，这是一段测试文本。"
print(f"模型目录: {MODEL_DIR}")
print(f"参考音频: {REF_AUDIO}")
print(f"参考文本: {REF_TEXT}")

# 1. 模型加载
print("\n=== 模型加载 ===")
t0 = time.perf_counter()
model_manager.load_character("bench", MODEL_DIR, "chinese")
t1 = time.perf_counter()
print(f"角色模型加载: {t1-t0:.3f}s")

gsv_model = model_manager.get("bench")

# 2. 参考音频处理
print("\n=== 参考音频处理 ===")
t0 = time.perf_counter()
prompt_audio = ReferenceAudio(REF_AUDIO, REF_TEXT, "chinese")
t1 = time.perf_counter()
print(f"参考音频处理 (HuBERT + G2P): {t1-t0:.3f}s")

# 3. 文本 G2P
print("\n=== 文本 G2P ===")
from genie_tts.GetPhonesAndBert import get_phones_and_bert
t0 = time.perf_counter()
text_seq, text_bert = get_phones_and_bert('。' + TEST_TEXT, language='chinese')
t1 = time.perf_counter()
print(f"文本 G2P + BERT: {t1-t0:.3f}s")

# 4. T2S Encoder
print("\n=== T2S 推理 ===")
t0 = time.perf_counter()
x, prompts = gsv_model.T2S_ENCODER.run(None, {
    "ref_seq": prompt_audio.phonemes_seq,
    "text_seq": text_seq,
    "ref_bert": prompt_audio.text_bert,
    "text_bert": text_bert,
    "ssl_content": prompt_audio.ssl_content,
})
t1 = time.perf_counter()
print(f"T2S Encoder: {t1-t0:.3f}s")

# 5. T2S First Stage Decoder
t0 = time.perf_counter()
y, y_emb, *present_key_values = gsv_model.T2S_FIRST_STAGE_DECODER.run(
    None, {"x": x, "prompts": prompts}
)
t1 = time.perf_counter()
print(f"T2S First Stage Decoder: {t1-t0:.3f}s")

# 6. T2S Stage Decoder (自回归循环)
input_names = [inp.name for inp in gsv_model.T2S_STAGE_DECODER.get_inputs()]
t0 = time.perf_counter()
step_times = []
idx = 0
for idx in range(500):
    st = time.perf_counter()
    input_feed = {name: data for name, data in zip(input_names, [y, y_emb, *present_key_values])}
    outputs = gsv_model.T2S_STAGE_DECODER.run(None, input_feed)
    y, y_emb, stop_condition_tensor, *present_key_values = outputs
    step_times.append(time.perf_counter() - st)
    if stop_condition_tensor:
        break
t1 = time.perf_counter()
print(f"T2S Stage Decoder: {t1-t0:.3f}s ({idx+1} steps)")
print(f"  平均每步: {np.mean(step_times)*1000:.1f}ms")
print(f"  最慢一步: {np.max(step_times)*1000:.1f}ms")
print(f"  最快一步: {np.min(step_times)*1000:.1f}ms")

# 7. Vocoder (VITS)
semantic_tokens = y
eos_indices = np.where(semantic_tokens >= 1024)
if len(eos_indices[0]) > 0:
    first_eos_index = eos_indices[-1][0]
    semantic_tokens = semantic_tokens[..., :first_eos_index]
semantic_tokens = np.expand_dims(semantic_tokens[:, -idx:], axis=0)

t0 = time.perf_counter()
if gsv_model.PROMPT_ENCODER is not None:
    prompt_audio.update_global_emb(prompt_encoder=gsv_model.PROMPT_ENCODER)
    audio = gsv_model.VITS.run(None, {
        "text_seq": text_seq,
        "pred_semantic": semantic_tokens,
        "ge": prompt_audio.global_emb,
        "ge_advanced": prompt_audio.global_emb_advanced,
    })[0]
else:
    audio = gsv_model.VITS.run(None, {
        "text_seq": text_seq,
        "pred_semantic": semantic_tokens,
        "ref_audio": prompt_audio.audio_32k,
    })[0]
t1 = time.perf_counter()
print(f"Vocoder (VITS): {t1-t0:.3f}s")

print(f"\n=== 总结 ===")
print(f"音频长度: {audio.squeeze().shape[0]/32000:.2f}s")
