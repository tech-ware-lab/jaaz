# routers/websocket_router.py
from services.websocket_state import sio, add_connection, remove_connection
from services.db_service import db_service

@sio.event
async def connect(sid, environ, auth):
    print(f"Client {sid} connected")
    
    user_info = auth or {}
    add_connection(sid, user_info)
    
    await sio.emit('connected', {'status': 'connected'}, room=sid)

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")
    remove_connection(sid)

@sio.event
async def get_canvas_data(sid, data):
    canvas_id = data.get('canvas_id')
    if canvas_id:
        try:
            canvas_data = await db_service.get_canvas_data(canvas_id)
            await sio.emit('canvas_data', {
                'canvas_id': canvas_id,
                'data': canvas_data.get('data') if canvas_data else None
            }, room=sid)
        except Exception as e:
            await sio.emit('error', {
                'message': f'Failed to get canvas data: {str(e)}'
            }, room=sid)

@sio.event
async def get_session_data(sid, data):
    session_id = data.get('session_id')
    if session_id:
        try:
            session_data = await db_service.get_chat_history(session_id)
            await sio.emit('session_data', {
                'session_id': session_id, 
                'data': session_data
            }, room=sid)
        except Exception as e:
            await sio.emit('error', {
                'message': f'Failed to get session data: {str(e)}'
            }, room=sid)

@sio.event
async def ping(sid, data):
    await sio.emit('pong', data, room=sid)
