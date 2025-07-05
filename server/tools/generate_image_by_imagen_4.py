from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig

from tools.image_generation.image_canvas_utils import save_image_to_canvas
from tools.image_providers.jaaz_provider import JaazImageProvider

class GenerateImageByImagen4InputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4"
    )
    tool_call_id: Annotated[str, InjectedToolCallId]



@tool("generate_image_by_imagen_4",
      description="Generate an image by Google Imagen-4 model using text prompt. This model does NOT support input images for reference or editing. Use this model for high-quality image generation with Google's advanced AI. Supports multiple providers with automatic fallback.",
      args_schema=GenerateImageByImagen4InputSchema)
async def generate_image_by_imagen_4(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> str:
    """
    Generate an image using Google Imagen-4 model via the provider framework
    """
    jaaz_image_provider = JaazImageProvider()
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print(f'🛠️ canvas_id {canvas_id} session_id {session_id}')

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    # Generate image using the selected provider
    mime_type, width, height, filename = await jaaz_image_provider.generate(
        prompt=prompt,
        model='google/imagen-4',
        aspect_ratio=aspect_ratio,
    )

    # Save image to canvas
    image_url = await save_image_to_canvas(
        session_id, canvas_id, filename, mime_type, width, height
    )

    return f"image generated successfully ![image_id: {filename}]({image_url})"


# Export the tool for easy import
__all__ = ["generate_image_by_imagen_4"]
