from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import json
import asyncio
from services.websocket_service import manager
router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = Query(...)):
    await manager.connect(websocket, session_id)
    try:
        while True:
            # 接收来自客户端的消息（保持连接活跃）
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                print(f"Received message from session {session_id}: {message}")
                # 这里可以处理客户端发送的消息
            except asyncio.TimeoutError:
                # 发送心跳保持连接
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
            except:
                break
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        print(f"WebSocket error for session {session_id}: {e}")
        manager.disconnect(session_id)

__all__ = ['router', 'manager'] 