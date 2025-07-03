import os
import random
import asyncio
import aiohttp
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
            # Handle base64 string
            image_data = base64.b64decode(url)
        else:
            # Download from URL
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        raise Exception(
                            f"Failed to download image: HTTP {response.status}")
                    image_data = await response.read()

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
