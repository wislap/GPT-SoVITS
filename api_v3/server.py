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

from api_v3.routers.config import router as config_router
from api_v3.routers.health import router as health_router

app = FastAPI(
    title="GPT-SoVITS API v3",
    description="文本转语音合成 API",
    version="3.0.0",
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


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="GPT-SoVITS API v3")
    parser.add_argument("-p", "--port", type=int, default=9881, help="监听端口 (默认: 9881)")
    parser.add_argument("-a", "--host", type=str, default="0.0.0.0", help="监听地址 (默认: 0.0.0.0)")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port)
