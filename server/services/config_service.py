import os
import traceback
import toml
from typing import Dict, TypedDict, Literal, Union

# 定义配置文件的类型结构
class ProviderConfig(TypedDict, total=False):
    url: str
    api_key: str
    max_tokens: int


class ModelConfig(TypedDict):
    type: Literal["text", "image", "video"]


class ProviderModelsConfig(TypedDict):
    models: Dict[str, ModelConfig]

AppConfig = Dict[str, Union[ProviderConfig, Dict[str, ModelConfig]]]


DEFAULT_PROVIDERS_CONFIG: AppConfig = {}
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
        self.app_config: AppConfig = DEFAULT_PROVIDERS_CONFIG
        self.root_dir = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__)))
        self.config_file = os.getenv(
            "CONFIG_PATH", os.path.join(USER_DATA_DIR, "config.toml")
        )
        # 初次加载配置，赋值给 app_config
        self._load_config_from_file()

    def _load_config_from_file(self) -> None:
        try:
            with open(self.config_file, "r") as f:
                config = toml.load(f)
            self.app_config = config
        except Exception:
            pass

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
