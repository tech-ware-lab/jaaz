from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple, List, Type
from models.config_model import ModelInfo


class ImageProviderBase(ABC):
    """Image generation provider base class"""

    # 类属性：提供商注册表
    _providers: Dict[str, Type['ImageProviderBase']] = {}

    def __init_subclass__(cls, provider_name: Optional[str] = None, **kwargs: Any):
        """自动注册提供商"""
        super().__init_subclass__(**kwargs)
        if provider_name:
            cls._providers[provider_name] = cls

    @classmethod
    def create_provider(cls, provider_name: str) -> 'ImageProviderBase':
        """工厂方法：创建提供商实例"""
        if provider_name not in cls._providers:
            raise ValueError(f"Unknown provider: {provider_name}")

        provider_class = cls._providers[provider_name]
        return provider_class()  # 让各提供商自己处理配置

    @classmethod
    def get_available_providers(cls) -> List[str]:
        """获取所有可用的提供商"""
        return list(cls._providers.keys())

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        **kwargs: Any
    ) -> Tuple[str, int, int, str]:
        """
        Generate image and return image details

        Args:
            prompt: Image generation prompt
            model: Model name to use for generation
            aspect_ratio: Image aspect ratio (1:1, 16:9, 4:3, 3:4, 9:16)
            input_images: Optional input images for reference or editing
            **kwargs: Additional provider-specific parameters

        Returns:
            Tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        pass


def get_default_provider(model_info_list: Optional[List[ModelInfo]] = None) -> str:
    """Get default provider for image generation

    Args:
        model_info_list: List of model info dictionaries. If provided,
                        will prioritize jaaz provider if available, otherwise use first one.
                        If not provided, returns 'jaaz' as default.

    Returns:
        str: Provider name
    """
    if model_info_list:
        # Prioritize Jaaz provider if available
        for model_info in model_info_list:
            if model_info.get('provider') == 'jaaz':
                return 'jaaz'

        # If no jaaz provider, use the first available one
        if model_info_list:
            return model_info_list[0].get('provider', 'jaaz')

    # Default fallback
    return "jaaz"
