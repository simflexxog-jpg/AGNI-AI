import asyncio
import json
import os
import sys
from contextlib import suppress
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="AGNI AI Voice Backend")


class SessionState:
    def __init__(self) -> None:
        self.connected = False


state = SessionState()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "voice-backend"}


@app.post("/offer")
async def offer(payload: dict[str, Any]) -> dict[str, Any]:
    state.connected = True
    return {"type": "answer", "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\nt=0 0\r\nm=audio 9 RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\n"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    state.connected = True
    try:
        while True:
            message = await websocket.receive_text()
            payload = json.loads(message)
            if payload.get("type") == "audio":
                await websocket.send_text(json.dumps({"type": "transcript", "text": "Voice session ready."}))
            elif payload.get("type") == "stop":
                await websocket.close()
                break
    except Exception:
        await websocket.close()


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return Path("voice_client.html").read_text(encoding="utf-8")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=7860)
