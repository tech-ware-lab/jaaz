import os
from fastapi import APIRouter
import requests
import httpx
from services.config_service import config_service
from services.db_service import db_service
from utils.http_client import HttpClient
from tools.comfy_dynamic import register_comfy_tools
# services
from services.files_service import download_file
from services.websocket_service import broadcast_init_done
from models.config_model import ModelInfo
from typing import List

router = APIRouter(prefix="/api")

# @router.get("/workspace_list")
# async def workspace_list():
#     return [{"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)} for entry in Path(WORKSPACE_ROOT).iterdir()]


async def initialize():
    # await initialize_mcp()
    await broadcast_init_done()


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


async def get_comfyui_model_list(base_url: str):
    """Get ComfyUI model list from object_info API"""
    try:
        timeout = httpx.Timeout(10.0)
        async with HttpClient.create(timeout=timeout) as client:
            response = await client.get(f"{base_url}/api/object_info")
            if response.status_code == 200:
                data = response.json()
                # Extract models from CheckpointLoaderSimple node
                models = data.get('CheckpointLoaderSimple', {}).get(
                    'input', {}).get('required', {}).get('ckpt_name', [[]])[0]
                return models if isinstance(models, list) else []
            else:
                print(f"ComfyUI server returned status {response.status_code}")
                return []
    except Exception as e:
        print(f"Error querying ComfyUI: {e}")
        return []


@router.get("/list_models")
async def get_models():
    config = config_service.get_config()
    res: List[ModelInfo] = []

    # Handle Ollama models separately
    ollama_url = config.get('ollama', {}).get(
        'url', os.getenv('OLLAMA_HOST', 'http://localhost:11434'))
    # Add Ollama models if URL is available
    if ollama_url and ollama_url.strip():
        ollama_models = get_ollama_model_list()
        for ollama_model in ollama_models:
            res.append({
                'provider': 'ollama',
                'model': ollama_model,
                'url': ollama_url,
                'type': 'text'
            })

    # Handle ComfyUI models separately
    comfyui_config = config.get('comfyui', {})
    comfyui_url = comfyui_config.get('url', '').strip()
    comfyui_config_models = comfyui_config.get('models', {})
    if comfyui_url:
        comfyui_models = await get_comfyui_model_list(comfyui_url)
        for comfyui_model in comfyui_models:
            if comfyui_model in comfyui_config_models:            
                res.append({
                    'provider': 'comfyui',
                    'model': comfyui_model,
                    'url': comfyui_url,
                    'type': 'image'
                })
    # Handle ComfyUI workflows separately
    comfyui_workflows = await register_comfy_tools()
    print('🛠️ dynamic comfyui workflow tools', comfyui_workflows)
    for workflow in comfyui_workflows:
        res.append({
            'provider': 'comfyui',
            'model': workflow,
            'url': comfyui_url,
            'type': 'tool'
        })
    # Handle providers that are not ollama or comfyui
    for provider in config.keys():
        if provider in ['ollama', 'comfyui']:
            continue

        provider_config = config[provider]
        provider_url = provider_config.get('url', '').strip()
        provider_api_key = provider_config.get('api_key', '').strip()

        # Skip provider if URL is empty or API key is empty
        if not provider_url or not provider_api_key:
            continue

        models = provider_config.get('models', {})
        for model_name in models:
            model = models[model_name]
            model_type = model.get('type', 'text')
            
            # Handle video models with multiple types
            if isinstance(model_type, list):
                # For models like 'doubao-seedance-1-0-pro-250528': { type: ['video-i2v', 'video-t2v'] }
                # Keep the original list of types
                pass  # model_type remains as list
            elif isinstance(model_type, str) and model_type.startswith('video'):
                # Keep specific video types like 'video-i2v', 'video-t2v'
                pass  # model_type remains as original string
                
            res.append({
                'provider': provider,
                'model': model_name,
                'url': provider_url,
                'type': model_type
            })

    return res


@router.get("/list_chat_sessions")
async def list_chat_sessions():
    return await db_service.list_sessions()


@router.get("/chat_session/{session_id}")
async def get_chat_session(session_id: str):
    return await db_service.get_chat_history(session_id)
