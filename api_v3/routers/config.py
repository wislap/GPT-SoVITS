"""
GPT-SoVITS API v3 - 配置管理路由

提供声音配置的 CRUD 接口。
"""

import asyncio
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from api_v3.config import (
    VoiceConfig,
    aload_voice,
    aload_default_config,
    alist_voices,
    asave_voice,
    reload_default_config,
    _dict_to_voice_config,
    afind_voice_file,
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

# VoiceConfigResponse 同时作为请求体（创建/更新）
VoiceConfigRequest = VoiceConfigResponse

class BatchDeleteRequest(BaseModel):
    ids: list[str]


# ─── 工具函数 ───

def _voice_config_to_response(cfg: VoiceConfig) -> dict:
    """将 VoiceConfig dataclass 转为可序列化的 dict"""
    return asdict(cfg)


# ─── 声音列表 ───

@router.get("/voices", response_model=list[VoiceListItem], summary="列出所有声音")
async def api_list_voices():
    """返回所有可用声音的摘要列表"""
    voices = await alist_voices()
    return [
        VoiceListItem(
            id=v.voice.id,
            name=v.voice.name,
            description=v.voice.description,
            version=v.model.version,
        )
        for v in voices
    ]


@router.get("/voices/full", response_model=list[VoiceConfigResponse], summary="列出所有声音（完整配置）")
async def api_list_voices_full():
    """返回所有声音的完整配置，避免前端逐个请求"""
    voices = await alist_voices()
    return [_voice_config_to_response(v) for v in voices]


# ─── 声音 CRUD ───

@router.post("/voices", response_model=VoiceConfigResponse, status_code=201, summary="创建声音配置")
async def api_create_voice(body: VoiceConfigRequest):
    """创建新的声音配置文件"""
    voice_id = body.voice.id
    if not voice_id:
        raise HTTPException(status_code=400, detail="voice.id 不能为空")

    # 检查是否已存在
    existing = await afind_voice_file(voice_id)
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"声音 {voice_id!r} 已存在")

    cfg = _dict_to_voice_config(body.model_dump())
    try:
        await asave_voice(cfg)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return _voice_config_to_response(cfg)


@router.post("/voices/batch-delete", summary="批量删除声音配置")
async def api_batch_delete_voices(body: BatchDeleteRequest):
    """批量删除多个声音配置"""
    deleted = []
    not_found = []
    for vid in body.ids:
        file_path = await afind_voice_file(vid)
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
        cfg = await aload_voice(voice_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"声音 {voice_id!r} 不存在")
    return _voice_config_to_response(cfg)


@router.put("/voices/{voice_id}", response_model=VoiceConfigResponse, summary="更新声音配置")
async def api_update_voice(voice_id: str, body: VoiceConfigRequest):
    """更新已有的声音配置"""
    existing = await afind_voice_file(voice_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"声音 {voice_id!r} 不存在")

    cfg = _dict_to_voice_config(body.model_dump())
    # 确保 voice.id 与路径参数一致
    cfg.voice.id = voice_id
    try:
        await asave_voice(cfg, path=existing)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return _voice_config_to_response(cfg)


@router.delete("/voices/{voice_id}", summary="删除声音配置")
async def api_delete_voice(voice_id: str):
    """删除指定声音的配置文件"""
    file_path = await afind_voice_file(voice_id)
    if file_path is None:
        raise HTTPException(status_code=404, detail=f"声音 {voice_id!r} 不存在")

    file_path.unlink()
    return {"status": "ok", "deleted": voice_id}


# ─── 默认配置 ───

@router.get("/config/default", response_model=VoiceConfigResponse, summary="获取默认配置")
async def api_get_default_config():
    """获取默认配置（default.toml 的内容）"""
    cfg = await aload_default_config()
    return _voice_config_to_response(cfg)


@router.post("/config/reload", summary="重新加载配置")
async def api_reload_config():
    """重新加载默认配置缓存（修改 default.toml 后调用）"""
    reload_default_config()
    return {"status": "ok", "message": "默认配置已重新加载"}


# ─── 文件扫描 ───

# 项目根目录（GPT-SoVITS/）
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# 权重文件夹映射（version → 文件夹名）
_GPT_WEIGHT_ROOTS = {
    "v1": "GPT_weights", "v2": "GPT_weights_v2", "v3": "GPT_weights_v3",
    "v4": "GPT_weights_v4", "v2Pro": "GPT_weights_v2Pro", "v2ProPlus": "GPT_weights_v2ProPlus",
}
_SOVITS_WEIGHT_ROOTS = {
    "v1": "SoVITS_weights", "v2": "SoVITS_weights_v2", "v3": "SoVITS_weights_v3",
    "v4": "SoVITS_weights_v4", "v2Pro": "SoVITS_weights_v2Pro", "v2ProPlus": "SoVITS_weights_v2ProPlus",
}

_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}


def _scan_weights(root_map: dict, extensions: set, version: Optional[str] = None) -> list[str]:
    """扫描权重文件，返回相对于项目根目录的路径列表"""
    results = []
    dirs = {version: root_map[version]} if version and version in root_map else root_map
    for ver, dirname in dirs.items():
        folder = _PROJECT_ROOT / dirname
        if not folder.is_dir():
            continue
        for f in sorted(folder.rglob("*")):
            if f.is_file() and f.suffix.lower() in extensions:
                results.append(str(f.relative_to(_PROJECT_ROOT)))
    return results


@router.get("/scan/gpt-weights", summary="扫描 GPT 权重文件")
async def api_scan_gpt_weights(version: Optional[str] = Query(None, description="按版本过滤")):
    """扫描 GPT_weights* 目录下的 .ckpt 文件"""
    files = await asyncio.to_thread(_scan_weights, _GPT_WEIGHT_ROOTS, {".ckpt"}, version)
    return {"files": files}


@router.get("/scan/sovits-weights", summary="扫描 SoVITS 权重文件")
async def api_scan_sovits_weights(version: Optional[str] = Query(None, description="按版本过滤")):
    """扫描 SoVITS_weights* 目录下的 .pth 文件"""
    files = await asyncio.to_thread(_scan_weights, _SOVITS_WEIGHT_ROOTS, {".pth"}, version)
    return {"files": files}


@router.get("/scan/audio", summary="扫描音频文件")
async def api_scan_audio(dir: str = Query("voices", description="扫描目录（相对于项目根）")):
    """扫描指定目录下的音频文件"""
    target = (_PROJECT_ROOT / dir).resolve()
    # 安全检查：不允许跳出项目根目录
    if not str(target).startswith(str(_PROJECT_ROOT)):
        raise HTTPException(status_code=400, detail="路径不合法")
    if not target.is_dir():
        return {"files": []}

    def _scan():
        results = []
        for f in sorted(target.rglob("*")):
            if f.is_file() and f.suffix.lower() in _AUDIO_EXTENSIONS:
                results.append(str(f.relative_to(_PROJECT_ROOT)))
        return results

    files = await asyncio.to_thread(_scan)
    return {"files": files}
