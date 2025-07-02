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


def get_seedance_v1_config() -> Dict[str, Any]:
    """Get Seedance V1 model configuration"""
    app_config = config_service.app_config

    # Get video configuration
    video_config = app_config.get("video", {})
    models_config = video_config.get("models", {})
    seedance_config = models_config.get("seedance_v1", {})

    # If no specific config, fall back to jaaz config for backward compatibility
    if not seedance_config:
        jaaz_config = app_config.get("jaaz", {})
        return {
            "default_provider": "jaaz_cloud",
            "providers": {
                "jaaz_cloud": {
                    "url": jaaz_config.get("url", ""),
                    "api_key": jaaz_config.get("api_key", ""),
                    "model_name": "doubao-seedance-1-0-pro"
                }
            }
        }

    return seedance_config


def get_default_provider() -> str:
    """Get default provider for Seedance V1"""
    config = get_seedance_v1_config()
    return config.get("default_provider", "jaaz_cloud")


def get_provider_config(provider_name: str) -> Dict[str, Any]:
    """Get configuration for specific provider"""
    config = get_seedance_v1_config()
    providers = config.get("providers", {})

    if provider_name not in providers:
        raise ValueError(
            f"Provider '{provider_name}' not configured for Seedance V1")

    return providers[provider_name]


def create_seedance_v1_provider(provider_name: str) -> SeedanceV1ProviderBase:
    """Factory function to create provider instance"""
    from .jaaz_provider import SeedanceV1JaazProvider
    # from .bytedance_provider import SeedanceV1ByteDanceProvider  # Future
    # from .local_provider import SeedanceV1LocalProvider  # Future

    providers = {
        "jaaz_cloud": SeedanceV1JaazProvider,
        # "bytedance_direct": SeedanceV1ByteDanceProvider,  # Future
        # "local": SeedanceV1LocalProvider,  # Future
    }

    if provider_name not in providers:
        raise ValueError(f"Unsupported Seedance V1 provider: {provider_name}")

    provider_class = providers[provider_name]
    provider_config = get_provider_config(provider_name)

    return provider_class(provider_config)
