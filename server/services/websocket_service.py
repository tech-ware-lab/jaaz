# services/websocket_service.py - 使用原生WebSocket
import traceback
from typing import Any, Dict
import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # 每个session_id只对应一个WebSocket连接
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        # 如果已经有连接，先关闭旧的
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].close()
            except:
                pass
        
        self.active_connections[session_id] = websocket
        print(f"WebSocket connected for session: {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        print(f"WebSocket disconnected for session: {session_id}")

    async def send_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(json.dumps(message))
                return True
            except:
                # 连接已断开，清理
                self.disconnect(session_id)
                return False
        return False

    async def broadcast_to_all(self, message: dict):
        disconnected_sessions = []
        for session_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(json.dumps(message))
            except:
                disconnected_sessions.append(session_id)
        
        # 清理断开的连接
        for session_id in disconnected_sessions:
            self.disconnect(session_id)

# 全局连接管理器
manager = ConnectionManager()

async def broadcast_session_update(session_id: str, canvas_id: str | None, event: Dict[str, Any]):
    """广播会话更新 - 使用原生WebSocket"""
    try:
        # 准备消息数据
        message_data = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            **event
        }
        
        # 发送到原生WebSocket连接
        success = await manager.send_to_session(session_id, message_data)
        if success:
            print(f"Sent session update for {session_id} to native WebSocket")
        else:
            print(f"Failed to send session update for {session_id} - no active connection")
            
    except Exception as e:
        print(f"Error broadcasting session update for {session_id}: {e}")
        traceback.print_exc()

async def send_to_websocket(session_id: str, event: Dict[str, Any]):
    """发送到websocket - 使用原生WebSocket"""
    await broadcast_session_update(session_id, None, event)

async def broadcast_init_done():
    """广播初始化完成事件"""
    try:
        await manager.broadcast_to_all({"type": "init_done"})
        print("Init done - WebSocket ready")
    except Exception as e:
        print(f"Error broadcasting init_done: {e}")
        traceback.print_exc()
