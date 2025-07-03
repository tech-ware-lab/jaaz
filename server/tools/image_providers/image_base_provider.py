from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple
from services.config_service import config_service


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


def get_default_provider() -> str:
    """Get default provider for image generation"""
    app_config = config_service.app_config

    # Check if jaaz is configured first (preferred)
    jaaz_config = app_config.get("jaaz", {})
    if jaaz_config.get("url") and jaaz_config.get("api_key"):
        return "jaaz"

    # Then check openai
    openai_config = app_config.get("openai", {})
    if openai_config.get("url") and openai_config.get("api_key"):
        return "openai"

    # Then check volces
    volces_config = app_config.get("volces", {})
    if volces_config.get("url") and volces_config.get("api_key"):
        return "volces"

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
