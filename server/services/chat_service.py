# services/chat_service.py
import asyncio
import json
from services.db_service import db_service
from services.langgraph_service import langgraph_agent
from services.config_service import app_config
from services.websocket_service import send_to_websocket
from services.stream_service import add_stream_task, remove_stream_task

async def handle_chat(data):
    messages = data.get('messages')
    session_id = data.get('session_id')
    canvas_id = data.get('canvas_id')
    text_model = data.get('text_model')
    image_model = data.get('image_model')
    print('👇app_config.get("system_prompt", "")',
          app_config.get('system_prompt', ''))
    if app_config.get('system_prompt', ''):
        messages.append({
            'role': 'system',
            'content': app_config.get('system_prompt', '')
        })

    if len(messages) == 1:
        # create new session
        prompt = messages[0].get('content', '')
        # TODO: Better way to determin when to create new chat session.
        await db_service.create_chat_session(session_id, text_model.get('model'), text_model.get('provider'), canvas_id, (prompt[:200] if isinstance(prompt, str) else ''))

    await db_service.create_message(session_id, messages[-1].get('role', 'user'), json.dumps(messages[-1])) if len(messages) > 0 else None

    task = asyncio.create_task(langgraph_agent(
        messages, session_id, text_model, image_model))
    add_stream_task(session_id, task)
    try:
        await task
    except asyncio.exceptions.CancelledError:
        print(f"🛑Session {session_id} cancelled during stream") 
    finally:
        remove_stream_task(session_id)
        await send_to_websocket(session_id, {
            'type': 'done'
        })
