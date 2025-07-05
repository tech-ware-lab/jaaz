from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.image_generation.image_canvas_utils import save_image_to_canvas
from tools.image_providers.jaaz_provider import JaazImageProvider
from tools.utils.image_utils import process_input_image



class GenerateImageByFluxKontextProInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4"
    )
    input_image: str | None = Field(
        default=None,
        description="Optional; Image to use as reference. Pass an image_id here, e.g. 'im_jurheut7.png'. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_flux_kontext_pro",
      description="Generate an image by Flux Kontext Pro model using text prompt or optionally pass an image for reference or editing. Good for object removal, image editing, etc. Only one input image is allowed.",
      args_schema=GenerateImageByFluxKontextProInputSchema)
async def generate_image_by_flux_kontext_pro_jaaz(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    input_image: str | None = None,
) -> str:
    jaaz_image_provider = JaazImageProvider()
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print(f'🛠️ canvas_id {canvas_id} session_id {session_id}')

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id
    processed_input_image = None
    if input_image:
        processed_input_image = await process_input_image(input_image)
        if processed_input_image:
            print("Using input image for generation")
        else:
            print("Warning: No valid input image found")


    # Generate image using the selected provider
    mime_type, width, height, filename = await jaaz_image_provider.generate(
        prompt=prompt,
        model='black-forest-labs/flux-kontext-pro',
        aspect_ratio=aspect_ratio,
        input_images=[processed_input_image] if processed_input_image else None,
    )

    # Save image to canvas
    image_url = await save_image_to_canvas(
        session_id, canvas_id, filename, mime_type, width, height
    )

    return f"image generated successfully ![image_id: {filename}]({image_url})"

# Export the tool for easy import
__all__ = ["generate_image_by_flux_kontext_pro_jaaz"]
