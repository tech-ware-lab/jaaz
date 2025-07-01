import random
import base64
import json
import time
import traceback
import os
from mimetypes import guess_type
from typing import Optional, Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
import aiofiles
from common import DEFAULT_PORT
from services.config_service import FILES_DIR
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from tools.image_generation_utils import save_image_to_canvas

# Import all generators
from .img_generators import (
    ReplicateGenerator,
    ComfyUIGenerator,
    WavespeedGenerator,
    JaazGenerator,
    OpenAIGenerator,
    VolcesImageGenerator,
)


class GenerateImageInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt.")
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16 Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4")
    input_image: Optional[str] = Field(default=None, description="Optional; Image to use as reference. Pass image_id here, e.g. 'im_jurheut7.png'. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc.")
    tool_call_id: Annotated[str, InjectedToolCallId]


# Initialize provider instances
PROVIDERS = {
    'replicate': ReplicateGenerator(),
    'comfyui': ComfyUIGenerator(),
    'wavespeed': WavespeedGenerator(),
    'jaaz': JaazGenerator(),
    'openai': OpenAIGenerator(),
    'volces': VolcesImageGenerator(),
}


@tool("generate_image",
      description="Generate an image using text prompt or optionally pass an image for reference or for editing",
      args_schema=GenerateImageInputSchema)
async def generate_image(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    input_image: Optional[str] = None,
) -> str:
    print('🛠️ tool_call_id', tool_call_id)
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print('🛠️canvas_id', canvas_id, 'session_id', session_id)
    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    provider = image_model.get('provider', 'replicate')

    # Get provider instance
    generator = PROVIDERS.get(provider)
    if not generator:
        raise ValueError(f"Unsupported provider: {provider}")

    try:
        # Prepare input image if provided
        input_image_data = None
        if input_image:
            image_path = os.path.join(FILES_DIR, f'{input_image}')

            if provider == 'openai':
                # OpenAI needs file path
                input_image_data = image_path
            else:
                # Other providers need base64
                async with aiofiles.open(image_path, 'rb') as f:
                    image_data = await f.read()
                b64 = base64.b64encode(image_data).decode('utf-8')
                mime_type, _ = guess_type(image_path)
                if not mime_type:
                    mime_type = "image/png"
                input_image_data = f"data:{mime_type};base64,{b64}"

        # Generate image using the appropriate provider
        extra_kwargs = {}
        if provider == 'comfyui':
            extra_kwargs['ctx'] = ctx
        elif provider == 'wavespeed':
            extra_kwargs['aspect_ratio'] = aspect_ratio

        mime_type, width, height, filename = await generator.generate(
            prompt=prompt,
            model=model,
            aspect_ratio=aspect_ratio,
            input_image=input_image_data,
            **extra_kwargs
        )

        # 保存图像到画布
        image_url = await save_image_to_canvas(session_id, canvas_id, filename, mime_type, width, height)

        return f"image generated successfully ![image_id: {filename}]({image_url})"

    except Exception as e:
        print(f"Error generating image: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
        return f"image generation failed: {str(e)}"

print('🛠️', generate_image.args_schema.model_json_schema())
