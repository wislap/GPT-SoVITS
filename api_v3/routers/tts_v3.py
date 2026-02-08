"""
GPT-SoVITS API v3 - TTS 推理路由 (v3)

基于推理引擎的双队列架构：
- POST /api/v3/tts          提交推理任务，返回 task_id
- GET  /api/v3/tts/{id}     查询任务状态
- GET  /api/v3/tts/{id}/audio  获取完整音频（等待完成）
- WS   /api/v3/tts/stream   WebSocket 流式：提交+实时获取
- GET  /api/v3/tts/queue     查看队列状态
"""

from typing import Optional

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from api_v3.config import load_voice, load_default_config, VoiceConfig


router = APIRouter(prefix="/api/v3", tags=["tts-v3"])


# ─── 请求模型 ───

class TTSSubmitRequest(BaseModel):
    """v3 TTS 提交请求"""
    text: str
    voice_id: str = "_default"
    # 可选覆盖参数
    text_lang: Optional[str] = None
    speed_factor: Optional[float] = None
    temperature: Optional[float] = None
    top_k: Optional[int] = None
    top_p: Optional[float] = None
    seed: Optional[int] = None
    batch_size: Optional[int] = None
    text_split_method: Optional[str] = None
    media_type: Optional[str] = None


def _get_engine(request: Request):
    """从 app.state 获取推理引擎"""
    return request.app.state.inference_engine


def _build_tts_params(voice_cfg: VoiceConfig, text: str, overrides: dict) -> dict:
    """从声音配置 + 覆盖参数构建 TTS 推理参数"""
    return voice_cfg.to_tts_inputs(text, **{k: v for k, v in overrides.items() if v is not None})


def _load_voice_config(voice_id: str) -> VoiceConfig:
    """加载声音配置"""
    if voice_id == "_default":
        return load_default_config()
    return load_voice(voice_id)


# ─── REST 端点 ───

@router.post("/tts", summary="提交 TTS 推理任务")
async def tts_submit(request: Request, body: TTSSubmitRequest):
    """提交推理任务到队列，立即返回 task_id"""
    engine = _get_engine(request)

    # 加载声音配置
    try:
        voice_cfg = _load_voice_config(body.voice_id)
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"message": f"voice_id '{body.voice_id}' not found"})

    # 构建推理参数
    overrides = {
        "text_lang": body.text_lang,
        "speed_factor": body.speed_factor,
        "temperature": body.temperature,
        "top_k": body.top_k,
        "top_p": body.top_p,
        "seed": body.seed,
        "batch_size": body.batch_size,
        "text_split_method": body.text_split_method,
    }
    tts_params = _build_tts_params(voice_cfg, body.text, overrides)
    media_type = body.media_type or voice_cfg.output.media_type

    # 校验参数
    err = engine.validate_params({**tts_params, "media_type": media_type})
    if err:
        return JSONResponse(status_code=400, content={"message": err})

    # 提交任务
    task = await engine.submit(
        voice_id=body.voice_id,
        gpt_weights=voice_cfg.model.gpt_weights,
        sovits_weights=voice_cfg.model.sovits_weights,
        tts_params=tts_params,
        media_type=media_type,
    )

    return {
        "task_id": task.task_id,
        "timestamp": task.timestamp,
        "status": task.status.value,
        "queue_position": engine._queue.qsize(),
    }


@router.get("/tts/queue", summary="查看队列状态")
async def tts_queue_info(request: Request):
    """获取推理队列状态"""
    return _get_engine(request).get_queue_info()


@router.get("/tts/{task_id}", summary="查询任务状态")
async def tts_task_status(request: Request, task_id: int):
    """查询指定任务的状态"""
    task = _get_engine(request).get_task(task_id)
    if task is None:
        return JSONResponse(status_code=404, content={"message": f"task {task_id} not found"})

    return {
        "task_id": task.task_id,
        "timestamp": task.timestamp,
        "status": task.status.value,
        "voice_id": task.voice_id,
        "chunks_ready": len(task.output.chunks),
        "done": task.output.done,
        "error": task.output.error,
    }


@router.get("/tts/{task_id}/audio", summary="获取完整音频")
async def tts_task_audio(request: Request, task_id: int):
    """等待任务完成后返回完整音频。如果任务未完成，会阻塞等待（最多 120 秒）。"""
    task = _get_engine(request).get_task(task_id)
    if task is None:
        return JSONResponse(status_code=404, content={"message": f"task {task_id} not found"})

    # 等待任务完成
    timeout = 120.0
    elapsed = 0.0
    while not task.output.done and elapsed < timeout:
        await task.output.wait_for_update(timeout=5.0)
        elapsed += 5.0

    if task.output.error:
        return JSONResponse(status_code=500, content={"message": task.output.error})

    if not task.output.done:
        return JSONResponse(status_code=408, content={"message": "task timeout"})

    # 拼接所有 chunk
    audio_data = b"".join(chunk.data for chunk in task.output.chunks)
    return Response(audio_data, media_type=f"audio/{task.media_type}")


# ─── WebSocket 端点 ───

@router.websocket("/tts/stream")
async def tts_ws_stream(websocket: WebSocket):
    """
    WebSocket 流式推理。

    客户端发送 JSON:
    {
        "text": "...",
        "voice_id": "_default",
        "text_lang": "all_zh",
        ...（同 TTSSubmitRequest 字段）
    }

    服务端响应：
    1. JSON: {"type": "accepted", "task_id": 123, "timestamp": ...}
    2. JSON: {"type": "status", "status": "loading_model"} （如果需要切换模型）
    3. JSON: {"type": "status", "status": "inferring"}
    4. Binary: 音频 chunk 数据（逐个发送）
    5. JSON: {"type": "done", "chunks_total": N}
    或
    5. JSON: {"type": "error", "message": "..."}
    """
    await websocket.accept()

    try:
        # 接收请求
        data = await websocket.receive_json()
        engine = websocket.app.state.inference_engine

        text = data.get("text", "")
        voice_id = data.get("voice_id", "_default")

        # 加载声音配置
        try:
            voice_cfg = _load_voice_config(voice_id)
        except FileNotFoundError:
            await websocket.send_json({"type": "error", "message": f"voice_id '{voice_id}' not found"})
            await websocket.close()
            return

        # 构建参数
        overrides = {k: data.get(k) for k in [
            "text_lang", "speed_factor", "temperature", "top_k", "top_p",
            "seed", "batch_size", "text_split_method",
        ]}
        tts_params = _build_tts_params(voice_cfg, text, overrides)
        media_type = data.get("media_type") or voice_cfg.output.media_type

        # 校验
        err = engine.validate_params({**tts_params, "media_type": media_type})
        if err:
            await websocket.send_json({"type": "error", "message": err})
            await websocket.close()
            return

        # 提交任务
        task = await engine.submit(
            voice_id=voice_id,
            gpt_weights=voice_cfg.model.gpt_weights,
            sovits_weights=voice_cfg.model.sovits_weights,
            tts_params=tts_params,
            media_type=media_type,
        )

        await websocket.send_json({
            "type": "accepted",
            "task_id": task.task_id,
            "timestamp": task.timestamp,
        })

        # 流式推送 chunk
        sent_index = 0
        last_status = None

        while not task.output.done or sent_index < len(task.output.chunks):
            # 推送状态变化
            if task.status.value != last_status:
                last_status = task.status.value
                await websocket.send_json({"type": "status", "status": last_status})

            # 推送新 chunk
            while sent_index < len(task.output.chunks):
                chunk = task.output.chunks[sent_index]
                await websocket.send_bytes(chunk.data)
                sent_index += 1

            # 如果还没完成，等待新数据
            if not task.output.done:
                await task.output.wait_for_update(timeout=5.0)

        # 发送完成或错误
        if task.output.error:
            await websocket.send_json({"type": "error", "message": task.output.error})
        else:
            await websocket.send_json({"type": "done", "chunks_total": len(task.output.chunks)})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
