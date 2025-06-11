import asyncio
import base64
import subprocess
import json
import os
from pathlib import Path
import traceback
from typing import Optional
from fastapi import APIRouter, Request, WebSocket, Query, HTTPException
from fastapi.responses import FileResponse
import asyncio
import aiohttp
import requests
from utils.ssl_config import create_aiohttp_session, create_httpx_client
from services.agent_service import openai_client, anthropic_client, ollama_client
from services.mcp import MCPClient
from services.config_service import config_service, app_config, USER_DATA_DIR
from starlette.websockets import WebSocketDisconnect
from services.db_service import db_service
from routers.image_tools import generate_image, generate_image_tool
from routers.websocket import active_websockets, send_to_websocket
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.prebuilt.chat_agent_executor import AgentState
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

#services
from services.langgraph_service import langgraph_agent
from services.files_service import download_file
from services.mcp_service import initialize_mcp, get_mcp_servers

llm_config = config_service.get_config()

wsrouter = APIRouter()
stream_tasks = {}


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
    except WebSocketDisconnect as e:
        print(f"WebSocket disconnected: {e.code}, {e.reason}")
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

  stream_tasks[session_id] = task
    try:
        await task
    except asyncio.exceptions.CancelledError:
        print(f"🛑Session {session_id} cancelled during stream")
    finally:
        stream_tasks.pop(session_id, None)
        await send_to_websocket(session_id, {
            'type': 'done'
        })

    return {"status": "done"}

@router.post("/cancel/{session_id}")
async def cancel_chat(session_id: str):
    task = stream_tasks.get(session_id)
    if task and not task.done():
        task.cancel()
        return {"status": "cancelled"}
    return {"status": "not_found_or_done"}

# @router.get("/workspace_list")
# async def workspace_list():
#     return [{"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)} for entry in Path(WORKSPACE_ROOT).iterdir()]


@router.get("/workspace_download")
async def workspace_download(path: str):
    return download_file(path)

def get_ollama_model_list():
    base_url = config_service.get_config().get('ollama', {}).get(
        'url', os.getenv('OLLAMA_HOST', 'http://localhost:11434'))
    try:
        response = requests.get(f'{base_url}/api/tags', timeout=5)
        response.raise_for_status()
        data = response.json()
        return [model['name'] for model in data.get('models', [])]
    except requests.RequestException as e:
        print(f"Error querying Ollama: {e}")
        return []


@router.get("/list_models")
async def get_models():
    config = config_service.get_config()
    res = []
    ollama_models = get_ollama_model_list()
    ollama_url = config_service.get_config().get('ollama', {}).get(
        'url', os.getenv('OLLAMA_HOST', 'http://localhost:11434'))
    print('👇ollama_models', ollama_models)
    for ollama_model in ollama_models:
        res.append({
            'provider': 'ollama',
            'model': ollama_model,
            'url': ollama_url,
            'type': 'text'
        })
    for provider in config.keys():
        models = config[provider].get('models', {})
        for model_name in models:
            if provider == 'ollama':
                continue
            if provider != 'comfyui' and config[provider].get('api_key', '') == '':
                continue
            model = models[model_name]
            res.append({
                'provider': provider,
                'model': model_name,
                'url': config[provider].get('url', ''),
                'type': model.get('type', 'text')
            })
    return res



async def initialize():
    # await initialize_mcp()
    for session_id in active_websockets:
        await send_to_websocket(session_id, {
            'type': 'init_done'
        })

#not used yet!!
@router.get("/list_mcp_servers")
async def list_mcp_servers():
    get_mcp_servers()

@router.get("/list_chat_sessions")
async def list_chat_sessions():
    return await db_service.list_sessions()


@router.get("/chat_session/{session_id}")
async def get_chat_session(session_id: str):
    return await db_service.get_chat_history(session_id)
