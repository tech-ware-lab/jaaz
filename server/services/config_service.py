import copy
import os
import traceback
import aiofiles
import toml
from typing import Dict, TypedDict, Literal, Optional

# 定义配置文件的类型结构

class ModelConfig(TypedDict, total=False):
    type: Literal["text", "image", "video"]
    is_custom: Optional[bool]
    is_disabled: Optional[bool]


class ProviderConfig(TypedDict, total=False):
    url: str
    api_key: str
    max_tokens: int
    models: Dict[str, ModelConfig]
    is_custom: Optional[bool]


AppConfig = Dict[str, ProviderConfig]


DEFAULT_PROVIDERS_CONFIG: AppConfig = {
  'jaaz': {
    'models': {
      # text models
      'gpt-4o': { 'type': 'text' },
      'gpt-4o-mini': { 'type': 'text' },
      'deepseek/deepseek-chat-v3-0324:free': { 'type': 'text' },
      'deepseek/deepseek-chat-v3-0324': { 'type': 'text' },
      'anthropic/claude-sonnet-4': { 'type': 'text' },
      'anthropic/claude-3.7-sonnet': { 'type': 'text' },
      # image models
      'google/imagen-4': { 'type': 'image' },
      # 'google/imagen-4-ultra': { type: 'image' },
      # 'black-forest-labs/flux-1.1-pro': { type: 'image' },
      'black-forest-labs/flux-kontext-pro': { 'type': 'image' },
      'black-forest-labs/flux-kontext-max': { 'type': 'image' },
      'recraft-ai/recraft-v3': { 'type': 'image' },
      'doubao/doubao-seedream-3-0-t2i-250415': { 'type': 'image' },
      'doubao-seedance-1-0-pro-250528': { 'type': 'video' },
      # 'ideogram-ai/ideogram-v3-balanced': { 'type': 'image' },
      'openai/gpt-image-1': { 'type': 'image' },
    },
    'url': os.getenv('BASE_API_URL', 'https://www.jaaz.app').rstrip('/') + '/api/v1/',
    'api_key': '',
    'max_tokens': 8192,
  },
  'comfyui': {
    'models': {},
    'url': 'http://127.0.0.1:8188',
    'api_key': '',
  },
  'ollama': {
    'models': {},
    'url': 'http://localhost:11434',
    'api_key': '',
    'max_tokens': 8192,
  },
  'openai': {
    'models': {
      'gpt-4o': { 'type': 'text' },
      'gpt-4o-mini': { 'type': 'text' },
      'gpt-image-1': { 'type': 'image' },
    },
    'url': 'https://api.openai.com/v1/',
    'api_key': '',
    'max_tokens': 8192,
  },
  'wavespeed': {
    'models': {
      'wavespeed-ai/flux-dev': { 'type': 'image' },
    },
    'url': 'https://api.wavespeed.ai/api/v3/',
    'api_key': '',
  },
  'replicate': {
    'models': {
      'google/imagen-4': { 'type': 'image' },
      'black-forest-labs/flux-1.1-pro': { 'type': 'image' },
      'black-forest-labs/flux-kontext-pro': { 'type': 'image' },
      'black-forest-labs/flux-kontext-max': { 'type': 'image' },
      'recraft-ai/recraft-v3': { 'type': 'image' },
    },
    'url': 'https://api.replicate.com/v1/',
    'api_key': '',
    'max_tokens': 8192,
  },
}

SERVER_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DATA_DIR = os.getenv(
    "USER_DATA_DIR",
    os.path.join(SERVER_DIR, "user_data"),
)
FILES_DIR = os.path.join(USER_DATA_DIR, "files")


IMAGE_FORMATS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",  # 基础格式
    ".bmp",
    ".tiff",
    ".tif",  # 其他常见格式
    ".webp",
)
VIDEO_FORMATS = (
    ".mp4",
    ".avi",
    ".mkv",
    ".mov",
    ".wmv",
    ".flv",
)


class ConfigService:
    def __init__(self):
        self.app_config: AppConfig = copy.deepcopy(DEFAULT_PROVIDERS_CONFIG)
        self.config_file = os.getenv(
            "CONFIG_PATH", os.path.join(USER_DATA_DIR, "config.toml")
        )
        self.initialized = False

    async def initialize(self) -> None:
        try:
            async with aiofiles.open(self.config_file, "r") as f:
                content = await f.read()
                config: AppConfig = toml.loads(content)
            for provider, provider_config in config.items():
                if provider not in DEFAULT_PROVIDERS_CONFIG:
                    provider_config['is_custom'] = True
                self.app_config[provider] = provider_config
                # image/video models are hardcoded in the default provider config
                provider_models = DEFAULT_PROVIDERS_CONFIG.get(provider, {}).get('models', {})
                for model_name, model_config in provider_config.get('models', {}).items():
                    # Only text model can be self added
                    if model_config.get('type') == 'text' and model_name not in provider_models:
                        provider_models[model_name] = model_config
                        provider_models[model_name]['is_custom'] = True
                    if model_name in provider_models:
                        provider_models[model_name]['is_disabled'] = model_config.get('is_disabled', False)
                self.app_config[provider]['models'] = provider_models
        except Exception as e:
            print(f"Error loading config: {e}")
            traceback.print_exc()
        finally:
            self.initialized = True

    def get_config(self) -> AppConfig:
        # 直接返回内存中的配置
        return self.app_config

    async def update_config(self, data: AppConfig) -> Dict[str, str]:
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, "w") as f:
                toml.dump(data, f)
            self.app_config = data

            return {
                "status": "success",
                "message": "Configuration updated successfully",
            }
        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "message": str(e)}


config_service = ConfigService()
