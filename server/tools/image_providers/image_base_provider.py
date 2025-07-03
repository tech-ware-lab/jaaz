from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple, List
from services.config_service import config_service
from models.config_model import ModelInfo


class ImageProviderBase(ABC):
    """Image generation provider base class"""

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


def get_provider_config(provider_name: str) -> Dict[str, Any]:
    """Get configuration for specific image provider"""
    app_config = config_service.app_config
    provider_config = app_config.get(provider_name, {})

    if not provider_config.get("url") or not provider_config.get("api_key"):
        raise ValueError(
            f"Provider '{provider_name}' is not properly configured")

    return {
        "url": provider_config.get("url", ""),
        "api_key": provider_config.get("api_key", ""),
    }


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


def create_image_provider(provider_name: str) -> ImageProviderBase:
    """Factory function to create image provider instance"""
    from .jaaz_provider import JaazImageProvider
    from .openai_provider import OpenAIImageProvider
    from .volces_provider import VolcesImageProvider

    providers = {
        "jaaz": JaazImageProvider,
        "openai": OpenAIImageProvider,
        "volces": VolcesImageProvider,
    }

    if provider_name not in providers:
        raise ValueError(f"Unsupported image provider: {provider_name}")

    provider_class = providers[provider_name]
    provider_config = get_provider_config(provider_name)

    return provider_class(provider_config)
