import os
import random
import asyncio
import aiofiles
from PIL import Image
from io import BytesIO
import base64
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional, Union, cast, Tuple
from nanoid import generate
import time
import json
from common import DEFAULT_PORT
from services.config_service import FILES_DIR
from services.db_service import db_service
from services.websocket_service import broadcast_session_update
from utils.http_client import HttpClient


def generate_image_id() -> str:
    """Generate unique image ID"""
    return generate(size=10)


def generate_file_id() -> str:
    """Generate unique file ID"""
    return 'im_' + generate(size=8)


async def get_image_info_and_save(
    url: str,
    file_path_without_extension: str,
    is_b64: bool = False
) -> Tuple[str, int, int, str]:
    """
    Download image from URL or decode base64, get image info and save to file

    Args:
        url: Image URL or base64 string
        file_path_without_extension: File path without extension
        is_b64: Whether the url is a base64 string

    Returns:
        tuple[str, int, int, str]: (mime_type, width, height, extension)
    """
    try:
        if is_b64:
            image_data = base64.b64decode(url)
        else:
            # Fetch the image asynchronously
            async with HttpClient.create() as client:
                response = await client.get(url)
                # Read the image content as bytes
                image_data = response.content

        # Open image to get info
        image = Image.open(BytesIO(image_data))
        width, height = image.size

        # Determine format and extension
        format_name = image.format or 'PNG'
        extension = format_name.lower()
        if extension == 'jpeg':
            extension = 'jpg'

        # Determine MIME type
        mime_type = f"image/{extension}"
        if extension == 'jpg':
            mime_type = "image/jpeg"

        # Save file
        file_path = f"{file_path_without_extension}.{extension}"
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(image_data)

        return mime_type, width, height, extension

    except Exception as e:
        print(f"Error processing image: {e}")
        raise e


class CanvasLockManager:
    """Canvas lock manager to prevent concurrent operations causing position overlap"""

    def __init__(self) -> None:
        self._locks: Dict[str, asyncio.Lock] = {}

    @asynccontextmanager
    async def lock_canvas(self, canvas_id: str):
        if canvas_id not in self._locks:
            self._locks[canvas_id] = asyncio.Lock()

        async with self._locks[canvas_id]:
            yield


# Global lock manager instance
canvas_lock_manager = CanvasLockManager()


async def generate_new_image_element(canvas_id: str, fileid: str, image_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate new image element for canvas"""
    canvas: Optional[Dict[str, Any]] = await db_service.get_canvas_data(canvas_id)
    if canvas is None:
        canvas = {'data': {}}
    canvas_data: Dict[str, Any] = canvas.get('data', {})
    elements: List[Dict[str, Any]] = canvas_data.get('elements', [])

    # Find the last image element
    last_x: Union[int, float] = 0
    last_y: Union[int, float] = 0
    last_width: Union[int, float] = 0
    image_elements: List[Dict[str, Any]] = [
        element for element in elements if element.get('type') == 'image']
    last_image_element: Optional[Dict[str, Any]] = image_elements[-1] if len(
        image_elements) > 0 else None
    if last_image_element is not None:
        last_x = last_image_element.get('x', 0)
        last_y = last_image_element.get('y', 0)
        last_width = last_image_element.get('width', 0)

    new_x = last_x + last_width + 20

    return {
        "type": "image",
        "id": fileid,
        "x": new_x,
        "y": last_y,
        "width": image_data.get("width", 0),
        "height": image_data.get("height", 0),
        "angle": 0,
        "fileId": fileid,
        "strokeColor": "#000000",
        "fillStyle": "solid",
        "strokeStyle": "solid",
        "boundElements": None,
        "roundness": None,
        "frameId": None,
        "backgroundColor": "transparent",
        "strokeWidth": 1,
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "seed": int(random.random() * 1000000),
        "version": 1,
        "versionNonce": int(random.random() * 1000000),
        "isDeleted": False,
        "index": None,
        "updated": 0,
        "link": None,
        "locked": False,
        "status": "saved",
        "scale": [1, 1],
        "crop": None,
    }


async def save_image_to_canvas(session_id: str, canvas_id: str, filename: str, mime_type: str, width: int, height: int) -> str:
    """Save image to canvas with proper locking and positioning"""
    # Use lock to ensure atomicity of the save process
    async with canvas_lock_manager.lock_canvas(canvas_id):
        file_id = generate_file_id()
        url = f'/api/file/{filename}'

        file_data: Dict[str, Any] = {
            'mimeType': mime_type,
            'id': file_id,
            'dataURL': url,
            'created': int(time.time() * 1000),
        }

        new_image_element: Dict[str, Any] = await generate_new_image_element(
            canvas_id,
            file_id,
            {
                'width': width,
                'height': height,
            })

        # Update the canvas data, add the new image element
        canvas_data: Optional[Dict[str, Any]] = await db_service.get_canvas_data(canvas_id)
        if canvas_data is None:
            canvas_data = {'data': {}}
        if 'data' not in canvas_data:
            canvas_data['data'] = {}
        if 'elements' not in canvas_data['data']:
            canvas_data['data']['elements'] = []
        if 'files' not in canvas_data['data']:
            canvas_data['data']['files'] = {}

        elements_list = cast(List[Dict[str, Any]],
                             canvas_data['data']['elements'])
        elements_list.append(new_image_element)
        canvas_data['data']['files'][file_id] = file_data

        image_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"

        # Save canvas data to database
        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data['data']))

        # Broadcast image generation message to frontend
        await broadcast_session_update(session_id, canvas_id, {
            'type': 'image_generated',
            'element': new_image_element,
            'file': file_data,
            'image_url': image_url,
        })

        return image_url


async def send_image_start_notification(session_id: str, message: str) -> None:
    """Send image generation start notification"""
    from services.websocket_service import send_to_websocket
    await send_to_websocket(session_id, {
        'type': 'image_generation_start',
        'message': message
    })


async def send_image_error_notification(session_id: str, error_message: str) -> None:
    """Send image generation error notification"""
    from services.websocket_service import send_to_websocket
    await send_to_websocket(session_id, {
        'type': 'error',
        'error': error_message
    })


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
    import traceback
    from typing import List, cast
    from models.config_model import ModelInfo
    from ..image_providers.image_base_provider import get_default_provider, create_image_provider

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
