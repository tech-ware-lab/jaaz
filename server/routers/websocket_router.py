# routers/websocket_router.py
from fastapi import APIRouter, WebSocket, Query
from starlette.websockets import WebSocketDisconnect
from services.websocket_state import active_websockets  # Import active_websockets

wsrouter = APIRouter()

@wsrouter.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = Query(...)):
    await websocket.accept()
    active_websockets[session_id] = websocket
    try:
        while True:
            data = await websocket.receive_text()
            # 可以处理 data
    except WebSocketDisconnect as e:
        print(f"WebSocket disconnected: {e.code}, {e.reason}")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_websockets.pop(session_id, None)
