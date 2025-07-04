"""
Image generation core module
Contains the main orchestration logic for image generation across different providers
"""

import traceback
from typing import List, cast, Optional, Any
from models.config_model import ModelInfo
from ..image_providers.image_base_provider import get_default_provider, create_image_provider
from .image_canvas_utils import (
    save_image_to_canvas,
    send_image_start_notification,
    send_image_error_notification,
)


async def generate_image_with_provider(
    prompt: str,
    aspect_ratio: str,
    model_name: str,
    model: str,
    tool_call_id: str,
    config: Any,
    input_images: Optional[list[str]] = None,
) -> str:
    """
    通用图像生成函数，支持不同的模型和提供商

    Args:
        prompt: 图像生成提示词
        aspect_ratio: 图像长宽比
        model_name: 内部模型名称 (如 'gpt-image-1', 'imagen-4')
        model: 模型标识符 (如 'openai/gpt-image-1', 'google/imagen-4')
        tool_call_id: 工具调用ID
        config: 上下文运行配置，包含canvas_id，session_id，model_info，由langgraph注入
        input_images: 可选的输入参考图像列表

    Returns:
        str: 生成结果消息
    """
    print(f'🛠️ Image Generation {model_name} tool_call_id', tool_call_id)
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print(f'🛠️ canvas_id {canvas_id} session_id {session_id}')

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    try:
        # Determine provider selection
        model_info_list: List[ModelInfo] = cast(
            List[ModelInfo], ctx.get('model_info', {}).get(model_name, []))

        # Use get_default_provider which already handles Jaaz prioritization
        provider_name = get_default_provider(model_info_list)

        print(f"🎨 Using provider: {provider_name} for {model_name}")

        # Create provider instance
        provider_instance = create_image_provider(provider_name)

        # Send start notification
        await send_image_start_notification(
            session_id,
            f"Starting image generation using {model_name} via {provider_name}..."
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
            model=model,
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
        print(f"🎨 Error generating image with {model_name}: {error_message}")
        traceback.print_exc()

        # Send error notification
        await send_image_error_notification(session_id, error_message)

        # Re-raise the exception for proper error handling
        raise Exception(
            f"{model_name} image generation failed: {error_message}")
