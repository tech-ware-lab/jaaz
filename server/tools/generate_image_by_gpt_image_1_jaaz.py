from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.image_generation.image_canvas_utils import save_image_to_canvas
from tools.image_providers.jaaz_provider import JaazImageProvider
from .utils.image_utils import process_input_image


class GenerateImageByGptImage1InputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4"
    )
    input_images: list[str] | None = Field(
        default=None,
        description="Optional; One or multiple images to use as reference. Pass a list of image_id here, e.g. ['im_jurheut7.png', 'im_hfuiut78.png']. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_gpt_image_1_jaaz",
      description="Generate an image by gpt image model using text prompt or optionally pass images for reference or for editing. Use this model if you need to use multiple input images as reference. Supports multiple providers with automatic fallback.",
      args_schema=GenerateImageByGptImage1InputSchema)
async def generate_image_by_gpt_image_1_jaaz(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    input_images: list[str] | None = None,
) -> str:
    """
    Generate an image using the new provider framework
    """
    # Process input images if provided
    processed_input_images: list[str] | None = None
    if input_images:
        processed_input_images = []
        for image_path in input_images:
            processed_image = await process_input_image(image_path)
            if processed_image:
                processed_input_images.append(processed_image)

        if processed_input_images:
            print(
                f"Using {len(processed_input_images)} input images for generation")
        else:
            print("Warning: No valid input images found")
    jaaz_image_provider = JaazImageProvider()
    # Generate image using the selected provider
    mime_type, width, height, filename = await jaaz_image_provider.generate(
        prompt=prompt,
        model='openai/gpt-image-1',
        aspect_ratio=aspect_ratio,
        input_images=processed_input_images,
    )
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')

    # Save image to canvas
    image_url = await save_image_to_canvas(
        session_id, canvas_id, filename, mime_type, width, height
    )

    return f"image generated successfully ![image_id: {filename}]({image_url})"


# Export the tool for easy import
__all__ = ["generate_image_by_gpt_image_1_jaaz"]
