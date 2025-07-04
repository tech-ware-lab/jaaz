from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from .image_generation import generate_image_with_provider


class GenerateImageByFluxKontextProInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4"
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_flux_kontext_pro",
      description="Generate an image by Flux Kontext Pro model using text prompt. This model does NOT support input images for reference or editing. Use this model for high-quality image generation with Flux's advanced AI. Supports multiple providers with automatic fallback.",
      args_schema=GenerateImageByFluxKontextProInputSchema)
async def generate_image_by_flux_kontext_pro(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> str:
    """
    Generate an image using Flux Kontext Pro model via the provider framework
    """
    return await generate_image_with_provider(
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        model="black-forest-labs/flux-kontext-pro",
        tool_call_id=tool_call_id,
        config=config,
        input_images=None,
    )


# Export the tool for easy import
__all__ = ["generate_image_by_flux_kontext_pro"]
