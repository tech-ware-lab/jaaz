# services/websocket_service.py
from services.websocket_state import active_websockets
import json  # Add this import for JSON processing
import traceback  # Add this import for exception traceback printing

# Sends a given event to the WebSocket associated with the given session_id
async def send_to_websocket(session_id: str, event:dict):
    ws = active_websockets.get(session_id)
    if ws:
        try:
            await ws.send_text(json.dumps(event))
        except Exception as e:
            print(f"Error sending to websocket: {e}")
            traceback.print_exc()

# Broadcast an 'init_done' event to all active WebSocket connections
async def broadcast_init_done():
    for session_id in active_websockets:
        websocket = active_websockets[session_id]
        await websocket.send_json({
            'type': 'init_done'
        })
