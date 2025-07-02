from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from services.config_service import config_service


class SeedanceV1ProviderBase(ABC):
    """Seedance V1 provider base class"""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        resolution: str = "720p",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        input_images: Optional[list[str]] = None,
        camera_fixed: bool = True,
        **kwargs: Any
    ) -> str:
        """
        Generate video and return video URL

        Args:
            prompt: Video generation prompt
            resolution: Video resolution (480p, 720p, 1080p)
            duration: Video duration in seconds (5, 10)
            aspect_ratio: Video aspect ratio (1:1, 16:9, 4:3, 3:4, 9:16)
            input_images: Optional input images for reference
            camera_fixed: Whether to keep camera fixed
            **kwargs: Additional provider-specific parameters

        Returns:
            str: Video URL for download
        """
        pass


def get_provider_config(provider_name: str) -> Dict[str, Any]:
    """Get configuration for specific provider"""
    app_config = config_service.app_config
    provider_config = app_config.get(provider_name, {})

    if not provider_config.get("url") or not provider_config.get("api_key"):
        raise ValueError(
            f"Provider '{provider_name}' is not properly configured")

    return {
        "url": provider_config.get("url", ""),
        "api_key": provider_config.get("api_key", ""),
        "model_name": "doubao-seedance-1-0-pro-250528"
    }


def get_default_provider() -> str:
    """Get default provider for Seedance V1"""
    app_config = config_service.app_config

    # Check if jaaz is configured first (preferred)
    jaaz_config = app_config.get("jaaz", {})
    if jaaz_config.get("url") and jaaz_config.get("api_key"):
        return "jaaz_cloud"

    # Then check volces
    volces_config = app_config.get("volces", {})
    if volces_config.get("url") and volces_config.get("api_key"):
        return "volces"

    # Default fallback
    return "jaaz_cloud"


def create_seedance_v1_provider(provider_name: str) -> SeedanceV1ProviderBase:
    """Factory function to create provider instance"""
    from .jaaz_provider import SeedanceV1JaazProvider
    from .volces_provider import SeedanceV1VolcesProvider

    providers = {
        "jaaz_cloud": SeedanceV1JaazProvider,
        "volces": SeedanceV1VolcesProvider,
    }

    if provider_name not in providers:
        raise ValueError(f"Unsupported Seedance V1 provider: {provider_name}")

    provider_class = providers[provider_name]
    provider_config = get_provider_config(provider_name)

    return provider_class(provider_config)
