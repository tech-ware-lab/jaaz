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
import requests
from utils.ssl_config import create_aiohttp_session, create_httpx_client
from services.mcp import MCPClient
from services.config_service import config_service, app_config, USER_DATA_DIR
from starlette.websockets import WebSocketDisconnect
from services.db_service import db_service
from routers.image_tools import generate_image, generate_image_tool

from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.prebuilt.chat_agent_executor import AgentState
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

#services
from services.langgraph_service import langgraph_agent
from services.files_service import download_file
from services.websocket_service import broadcast_init_done
from services.websocket_state import active_websockets
from services.websocket_service import send_to_websocket

llm_config = config_service.get_config()

router = APIRouter(prefix="/api")

# @router.get("/workspace_list")
# async def workspace_list():
#     return [{"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)} for entry in Path(WORKSPACE_ROOT).iterdir()]

async def initialize():
    # await initialize_mcp()
    for session_id in active_websockets:
        await send_to_websocket(session_id, {
            'type': 'init_done'
        })

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


@router.get("/list_chat_sessions")
async def list_chat_sessions():
    return await db_service.list_sessions()


@router.get("/chat_session/{session_id}")
async def get_chat_session(session_id: str):
    return await db_service.get_chat_history(session_id)
