import traceback
from typing import Optional, Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
from .base import get_default_provider, create_seedance_v1_provider
from ..video_utils import send_video_start_notification, process_video_result, send_video_error_notification


class SeedanceV1VideoInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    resolution: Optional[str] = Field(
        default="480p",
        description="Optional. The resolution of the video. Allowed values: 480p, 1080p."
    )
    duration: Optional[int] = Field(
        default=5,
        description="Optional. The duration of the video in seconds. Allowed values: 5, 10."
    )
    aspect_ratio: Optional[str] = Field(
        default="16:9",
        description="Optional. The aspect ratio of the video. Allowed values: 1:1, 16:9, 4:3, 21:9"
    )
    input_images: Optional[list[str]] = Field(
        default=None,
        description="Optional. Images to use as reference or first frame. Pass a list of image_id here, e.g. ['im_jurheut7.png']."
    )
    camera_fixed: Optional[bool] = Field(
        default=True,
        description="Optional. Whether to keep the camera fixed (no camera movement)."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_video_doubao_seedance_1_0_pro",
      description="Generate high-quality videos using Seedance V1 model. Supports multiple providers and text-to-video/image-to-video generation.",
      args_schema=SeedanceV1VideoInputSchema)
async def generate_video_doubao_seedance_1_0_pro(
    prompt: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    resolution: Optional[str] = "480p",
    duration: Optional[int] = 5,
    aspect_ratio: Optional[str] = "16:9",
    input_images: Optional[list[str]] = None,
    camera_fixed: Optional[bool] = True
) -> str:
    """
    Generate a video using Seedance V1 model via configured provider.
    """
    print('🛠️ Seedance V1 Video tool_call_id', tool_call_id)
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print('🛠️ canvas_id', canvas_id, 'session_id', session_id)

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    try:
        # 判断选择 Provider
        # TODO 如果有多个 Provider 选择，需要修改，优先选择 Jaaz
        media_model = ctx.get('model_info', {}).get('image', {})
        if media_model is None:
            raise ValueError("Media model is not selected")

        context_provider = media_model.get('provider')

        print('🛠️ context_provider', context_provider)
        provider_name = context_provider or get_default_provider()

        print(
            f"🎥 Using provider: {provider_name} (from: {'context' if context_provider else 'default'})")

        # Create provider instance
        provider_instance = create_seedance_v1_provider(provider_name)

        # Send start notification
        await send_video_start_notification(
            session_id,
            f"Starting Seedance V1 video generation using {provider_name}..."
        )

        # Generate video using the selected provider
        video_url = await provider_instance.generate(
            prompt=prompt,
            resolution=resolution or "480p",
            duration=duration or 5,
            aspect_ratio=aspect_ratio or "16:9",
            input_images=input_images,
            camera_fixed=camera_fixed or True
        )

        # Process video result (save, update canvas, notify)
        return await process_video_result(
            video_url=video_url,
            session_id=session_id,
            canvas_id=canvas_id,
            provider_name=f"Seedance V1 ({provider_name})"
        )

    except Exception as e:
        error_message = str(e)
        print(f"🎥 Error generating video with Seedance V1: {error_message}")
        traceback.print_exc()

        # Send error notification
        await send_video_error_notification(session_id, error_message)

        # Re-raise the exception for proper error handling
        raise Exception(
            f"Seedance V1 video generation failed: {error_message}")


# Export the tool for easy import
__all__ = ["generate_video_doubao_seedance_1_0_pro"]
