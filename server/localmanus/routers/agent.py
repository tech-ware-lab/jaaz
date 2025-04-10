import asyncio
import os
from pathlib import Path
from fastapi import APIRouter, Request, WebSocket
from fastapi.responses import FileResponse
import asyncio
from localmanus.services.agent_service import llm

wsrouter = APIRouter()
active_websockets = []

@wsrouter.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        while True:
            # state_data = await agent_service.get_state_data()
            # await websocket.send_text(json.dumps(state_data))
            await asyncio.sleep(1)
    except Exception as e:
        active_websockets.remove(websocket)
        try:
            await websocket.close()
        except:
            pass 

router = APIRouter(prefix="/api")
@router.post("/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get('messages')
    async with llm.client.messages.stream(
        max_tokens=1024,
        messages=messages,
        model="claude-3-5-sonnet-latest",
    ) as stream:
        async for text in stream.text_stream:
            print(text, end="", flush=True)
            # Send text to all active WebSocket connections
            for ws in active_websockets:
                await ws.send_text(text)
        print()

    message = await stream.get_final_message()
    print('final message', message.to_json())

# @router.get("/cancel")
# async def cancel():
#     agent_service.cancel_event.set()
#     return "Cancel event set"

# @router.get("/workspace_list")
# async def workspace_list():
#     return [{"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)} for entry in Path(WORKSPACE_ROOT).iterdir()]

@router.get("/workspace_download")
async def workspace_download(path: str):
    file_path = Path(path)
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return {"error": "File not found"}
