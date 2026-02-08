"""
GPT-SoVITS API v3 - 配置管理路由

提供声音配置的 CRUD 接口。
"""

from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api_v3.config import (
    VoiceConfig,
    load_voice,
    load_default_config,
    list_voices,
    save_voice,
    reload_default_config,
    _dict_to_voice_config,
    _find_voice_file,
    VOICES_DIR,
)


router = APIRouter(prefix="/api/v3", tags=["config"])


# ─── 响应 / 请求模型 ───

class VoiceInfoResponse(BaseModel):
    id: str
    name: str
    description: str

class ModelConfigResponse(BaseModel):
    gpt_weights: str
    sovits_weights: str
    version: str

class RefAudioResponse(BaseModel):
    path: str
    prompt_text: str
    prompt_lang: str
    aux_ref_audio_paths: list[str] = []

class InferParamsResponse(BaseModel):
    text_lang: str
    text_split_method: str
    top_k: int
    top_p: float
    temperature: float
    repetition_penalty: float
    seed: int
    batch_size: int
    batch_threshold: float
    split_bucket: bool
    parallel_infer: bool
    speed_factor: float
    fragment_interval: float
    sample_steps: int
    super_sampling: bool
    streaming_mode: bool
    return_fragment: bool
    overlap_length: int
    min_chunk_length: int
    fixed_length_chunk: bool

class OutputConfigResponse(BaseModel):
    media_type: str

class VoiceConfigResponse(BaseModel):
    voice: VoiceInfoResponse
    model: ModelConfigResponse
    ref_audio: RefAudioResponse
    params: InferParamsResponse
    output: OutputConfigResponse

class VoiceListItem(BaseModel):
    id: str
    name: str
    description: str
    version: str

class VoiceConfigRequest(BaseModel):
    """创建 / 更新 voice 的请求体"""
    voice: VoiceInfoResponse
    model: ModelConfigResponse
    ref_audio: RefAudioResponse
    params: InferParamsResponse
    output: OutputConfigResponse

class BatchDeleteRequest(BaseModel):
    ids: list[str]


# ─── 工具函数 ───

def _voice_config_to_response(cfg: VoiceConfig) -> dict:
    """将 VoiceConfig dataclass 转为可序列化的 dict"""
    return {
        "voice": asdict(cfg.voice),
        "model": asdict(cfg.model),
        "ref_audio": asdict(cfg.ref_audio),
        "params": asdict(cfg.params),
        "output": asdict(cfg.output),
    }


# ─── 声音列表 ───

@router.get("/voices", response_model=list[VoiceListItem], summary="列出所有声音")
async def api_list_voices():
    """返回所有可用声音的摘要列表"""
    voices = list_voices()
    return [
        VoiceListItem(
            id=v.voice.id,
            name=v.voice.name,
            description=v.voice.description,
            version=v.model.version,
        )
        for v in voices
    ]


# ─── 声音 CRUD ───

@router.post("/voices", response_model=VoiceConfigResponse, status_code=201, summary="创建声音配置")
async def api_create_voice(body: VoiceConfigRequest):
    """创建新的声音配置文件"""
    voice_id = body.voice.id
    if not voice_id:
        raise HTTPException(status_code=400, detail="voice.id 不能为空")

    # 检查是否已存在
    existing = _find_voice_file(voice_id)
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"声音 {voice_id!r} 已存在")

    cfg = _dict_to_voice_config(body.model_dump())
    try:
        save_voice(cfg)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return _voice_config_to_response(cfg)


@router.post("/voices/batch-delete", summary="批量删除声音配置")
async def api_batch_delete_voices(body: BatchDeleteRequest):
    """批量删除多个声音配置"""
    deleted = []
    not_found = []
    for vid in body.ids:
        file_path = _find_voice_file(vid)
        if file_path is None:
            not_found.append(vid)
        else:
            file_path.unlink()
            deleted.append(vid)
    return {"status": "ok", "deleted": deleted, "not_found": not_found}


@router.get("/voices/{voice_id}", response_model=VoiceConfigResponse, summary="获取声音配置")
async def api_get_voice(voice_id: str):
    """获取指定声音的完整配置（已合并默认配置）"""
    try:
        cfg = load_voice(voice_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"声音 {voice_id!r} 不存在")
    return _voice_config_to_response(cfg)


@router.put("/voices/{voice_id}", response_model=VoiceConfigResponse, summary="更新声音配置")
async def api_update_voice(voice_id: str, body: VoiceConfigRequest):
    """更新已有的声音配置"""
    existing = _find_voice_file(voice_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"声音 {voice_id!r} 不存在")

    cfg = _dict_to_voice_config(body.model_dump())
    # 确保 voice.id 与路径参数一致
    cfg.voice.id = voice_id
    try:
        save_voice(cfg, path=existing)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return _voice_config_to_response(cfg)


@router.delete("/voices/{voice_id}", summary="删除声音配置")
async def api_delete_voice(voice_id: str):
    """删除指定声音的配置文件"""
    file_path = _find_voice_file(voice_id)
    if file_path is None:
        raise HTTPException(status_code=404, detail=f"声音 {voice_id!r} 不存在")

    file_path.unlink()
    return {"status": "ok", "deleted": voice_id}


# ─── 默认配置 ───

@router.get("/config/default", response_model=VoiceConfigResponse, summary="获取默认配置")
async def api_get_default_config():
    """获取默认配置（default.toml 的内容）"""
    cfg = load_default_config()
    return _voice_config_to_response(cfg)


@router.post("/config/reload", summary="重新加载配置")
async def api_reload_config():
    """重新加载默认配置缓存（修改 default.toml 后调用）"""
    reload_default_config()
    return {"status": "ok", "message": "默认配置已重新加载"}
