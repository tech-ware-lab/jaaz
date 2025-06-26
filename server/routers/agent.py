import os
from fastapi import APIRouter
import requests
from services.config_service import config_service
from services.db_service import db_service

# services
from services.files_service import download_file
from services.websocket_service import broadcast_init_done

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


@router.get("/list_models")
async def get_models():
    config = config_service.get_config()
    res = []

    # Handle Ollama models separately
    ollama_url = config_service.get_config().get('ollama', {}).get(
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

    # Handle providers that are not ollama
    for provider in config.keys():
        if provider == 'ollama':
            continue

        provider_config = config[provider]
        provider_url = provider_config.get('url', '').strip()
        provider_api_key = provider_config.get('api_key', '').strip()

        # Skip provider if URL is empty
        if not provider_url:
            continue

        # Skip provider if API key is required and empty (ollama and comfyui don't need API key)
        if provider not in ['ollama', 'comfyui'] and not provider_api_key:
            continue

        models = provider_config.get('models', {})
        for model_name in models:
            model = models[model_name]
            res.append({
                'provider': provider,
                'model': model_name,
                'url': provider_url,
                'type': model.get('type', 'text')
            })

    return res


@router.get("/list_chat_sessions")
async def list_chat_sessions():
    return await db_service.list_sessions()


@router.get("/chat_session/{session_id}")
async def get_chat_session(session_id: str):
    return await db_service.get_chat_history(session_id)
