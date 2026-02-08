"""
GPT-SoVITS API v3 - 健康检查路由
"""

from fastapi import APIRouter

from api_v3.config import list_voices


router = APIRouter(prefix="/api/v3", tags=["health"])


@router.get("/health", summary="健康检查")
async def health_check():
    voices = list_voices()
    return {
        "status": "ok",
        "version": "3.0.0",
        "voices_count": len(voices),
    }
