import traceback
from typing import Optional, Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId # type: ignore
from langchain_core.runnables import RunnableConfig
from .image_providers.image_base_provider import get_default_provider, create_image_provider
from .utils.image_utils import save_image_to_canvas, send_image_start_notification, send_image_error_notification


class GenerateImageV2InputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4"
    )
    model: Optional[str] = Field(
        default="openai/gpt-image-1",
        description="Optional. The model to use for image generation. Default is openai/gpt-image-1"
    )
    input_images: Optional[list[str]] = Field(
        default=None,
        description="Optional; Images to use as reference. Pass a list of image_id here, e.g. ['im_jurheut7.png', 'im_hfuiut78.png']. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_gpt_v2",
      description="Generate an image by gpt image model using text prompt or optionally pass images for reference or for editing. Use this model if you need to use multiple input images as reference. Supports multiple providers with automatic fallback.",
      args_schema=GenerateImageV2InputSchema)
async def generate_image_by_gpt_v2(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    model: Optional[str] = "openai/gpt-image-1",
    input_images: Optional[list[str]] = None,
) -> str:
    """
    Generate an image using the new provider framework
    """
    print('🛠️ Image Generation V2 tool_call_id', tool_call_id)
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print('🛠️ canvas_id', canvas_id, 'session_id', session_id)

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    try:
        # Determine provider selection
        # TODO: If there are multiple provider selections, need to modify, prioritize Jaaz
        tool_list = ctx.get('model_info', {}).get('tool_list', [])
        if tool_list is None or len(tool_list) == 0:
            # If no tool_list, use model to determine provider
            if model and model.startswith('openai/'):
                context_provider = 'openai'
            else:
                context_provider = None
        else:
            context_provider = tool_list[0].get('provider')

        print('🛠️ context_provider', context_provider)
        provider_name = context_provider or get_default_provider()

        print(
            f"🎨 Using provider: {provider_name} (from: {'context' if context_provider else 'default'})")

        # Create provider instance
        provider_instance = create_image_provider(provider_name)

        # Send start notification
        await send_image_start_notification(
            session_id,
            f"Starting image generation using {provider_name}..."
        )

        # Process input images for the provider
        processed_input_images = None
        if input_images:
            # For some providers, we might need to process input images differently
            # For now, just pass them as is
            processed_input_images = input_images

        # Generate image using the selected provider
        mime_type, width, height, filename = await provider_instance.generate(
            prompt=prompt,
            model=model or "openai/gpt-image-1",
            aspect_ratio=aspect_ratio,
            input_images=processed_input_images
        )

        # Save image to canvas
        image_url = await save_image_to_canvas(
            session_id, canvas_id, filename, mime_type, width, height
        )

        return f"image generated successfully ![image_id: {filename}]({image_url})"

    except Exception as e:
        error_message = str(e)
        print(f"🎨 Error generating image: {error_message}")
        traceback.print_exc()

        # Send error notification
        await send_image_error_notification(session_id, error_message)

        # Re-raise the exception for proper error handling
        raise Exception(f"Image generation failed: {error_message}")


# Export the tool for easy import
__all__ = ["generate_image_by_gpt_v2"]
