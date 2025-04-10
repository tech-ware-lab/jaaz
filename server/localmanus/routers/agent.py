import asyncio
import os
from pathlib import Path
import traceback
from fastapi import APIRouter, Request, WebSocket, Query, HTTPException
from fastapi.responses import FileResponse
import asyncio
from localmanus.services.agent_service import llm

wsrouter = APIRouter()
active_websockets = {}  # Changed to dictionary to store session_id -> websocket mapping

@wsrouter.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = Query(...)):
    await websocket.accept()
    active_websockets[session_id] = websocket
    try:
        # Keep the connection alive
        while True:
            # Wait for messages (optional, if you need to receive from client)
            data = await websocket.receive_text()
            # Process the message if needed
    except Exception as e:
        print(f"WebSocket error: {e}")
        traceback.print_exc()
    finally:
        if session_id in active_websockets:
            del active_websockets[session_id]


router = APIRouter(prefix="/api")
@router.post("/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get('messages')
    session_id = data.get('session_id')
    if session_id is None:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail="session_id is required"
        )
    
    # Create a copy of the list to avoid modification during iteration
    websockets_to_remove = []
    
    async with llm.client.messages.stream(
        max_tokens=1024,
        messages=messages,
        model="claude-3-5-sonnet-latest",
    ) as stream:
        async for text in stream.text_stream:
            print(text, end="", flush=True)
            
            # Send text to all active WebSocket connections
            ws = active_websockets.get(session_id)
            if ws:
                try:
                    await ws.send_text(text)
                except Exception as e:
                    print(f"Error sending to websocket: {e}")
                    websockets_to_remove.append(ws)
        for ws in websockets_to_remove:
            del active_websockets[ws]
        print()

    message = await stream.get_final_message()
    print('final message', message.to_json())
    return {"status": "completed"}

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
