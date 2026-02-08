"""
GPT-SoVITS API v3 - FastAPI 后端服务

提供声音配置管理和 TTS 推理接口。
路由拆分到 routers/ 目录下，通过 include_router 挂载。
"""

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 支持直接运行: python server.py
_api_v3_dir = Path(__file__).resolve().parent
_project_root = _api_v3_dir.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
_gpt_sovits_dir = _project_root / "GPT_SoVITS"
if str(_gpt_sovits_dir) not in sys.path:
    sys.path.insert(0, str(_gpt_sovits_dir))

from contextlib import asynccontextmanager

from api_v3.routers.config import router as config_router
from api_v3.routers.health import router as health_router
from api_v3.routers.tts import router as tts_router
from api_v3.routers.tts_v3 import router as tts_v3_router


# ─── TTS Pipeline 初始化 ───

_tts_config_path: str = "GPT_SoVITS/configs/tts_infer.yaml"


def _init_tts_pipeline(app_instance):
    """初始化 TTS pipeline 并挂到 app.state 上"""
    from GPT_SoVITS.TTS_infer_pack.TTS import TTS, TTS_Config
    from GPT_SoVITS.TTS_infer_pack.text_segmentation_method import get_method_names as get_cut_method_names

    tts_config = TTS_Config(_tts_config_path)
    print(tts_config)
    tts_pipeline = TTS(tts_config)

    app_instance.state.tts_pipeline = tts_pipeline
    app_instance.state.tts_config = tts_config
    app_instance.state.cut_method_names = get_cut_method_names()


def _auto_load_last_voice(tts_pipeline):
    """根据 settings.toml 中的 last_voice_id 自动加载上次使用的模型"""
    from api_v3.config import load_settings, load_voice
    try:
        settings = load_settings()
        voice_id = settings.get("last_voice_id", "_default")
        if voice_id and voice_id != "_default":
            cfg = load_voice(voice_id)
            if cfg.model.gpt_weights:
                print(f"[startup] 自动加载 GPT 权重: {cfg.model.gpt_weights}")
                tts_pipeline.init_t2s_weights(cfg.model.gpt_weights)
            if cfg.model.sovits_weights:
                print(f"[startup] 自动加载 SoVITS 权重: {cfg.model.sovits_weights}")
                tts_pipeline.init_vits_weights(cfg.model.sovits_weights)
            print(f"[startup] 已加载声音配置: {voice_id}")
    except Exception as e:
        print(f"[startup] 自动加载声音配置失败: {e}")


@asynccontextmanager
async def lifespan(app_instance):
    """FastAPI lifespan: 启动时初始化 TTS pipeline、推理引擎，并自动加载上次使用的模型"""
    _init_tts_pipeline(app_instance)
    _auto_load_last_voice(app_instance.state.tts_pipeline)

    # 创建并启动推理引擎
    from api_v3.inference import InferenceEngine
    engine = InferenceEngine(
        app_instance.state.tts_pipeline,
        app_instance.state.tts_config,
        app_instance.state.cut_method_names,
    )
    await engine.start()
    app_instance.state.inference_engine = engine

    yield

    await engine.stop()


app = FastAPI(
    title="GPT-SoVITS API v3",
    description="文本转语音合成 API",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 挂载路由 ───
app.include_router(config_router)
app.include_router(health_router)
app.include_router(tts_router)
app.include_router(tts_v3_router)


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="GPT-SoVITS API v3")
    parser.add_argument("-p", "--port", type=int, default=9881, help="监听端口 (默认: 9881)")
    parser.add_argument("-a", "--host", type=str, default="0.0.0.0", help="监听地址 (默认: 0.0.0.0)")
    parser.add_argument("-c", "--tts_config", type=str, default="GPT_SoVITS/configs/tts_infer.yaml", help="TTS 配置文件路径")
    args = parser.parse_args()

    _tts_config_path = args.tts_config
    uvicorn.run(app, host=args.host, port=args.port)
