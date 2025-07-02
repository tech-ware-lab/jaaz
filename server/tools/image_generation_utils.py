import random
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional, Union, cast
from services.db_service import db_service
from nanoid import generate
import time
import json
from common import DEFAULT_PORT
from services.websocket_service import broadcast_session_update # type: ignore


class CanvasLockManager:
    """画布锁管理器，防止并发操作导致的位置重叠"""

    def __init__(self) -> None:
        self._locks: Dict[str, asyncio.Lock] = {}

    @asynccontextmanager
    async def lock_canvas(self, canvas_id: str):
        if canvas_id not in self._locks:
            self._locks[canvas_id] = asyncio.Lock()

        async with self._locks[canvas_id]:
            yield


# 全局锁管理器实例
canvas_lock_manager = CanvasLockManager()


async def generate_new_image_element(canvas_id: str, fileid: str, image_data: Dict[str, Any]) -> Dict[str, Any]:
    canvas: Optional[Dict[str, Any]] = await db_service.get_canvas_data(canvas_id)
    if canvas is None:
        canvas = {'data': {}}
    canvas_data: Dict[str, Any] = canvas.get('data', {})
    elements: List[Dict[str, Any]] = canvas_data.get('elements', [])

    # find the last image element
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
        # last_height = last_image_element.get('height', 0)

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
    # 使用锁确保整个保存过程的原子性
    async with canvas_lock_manager.lock_canvas(canvas_id):
        # print(f"🔒 获取画布锁成功, canvas_id: {canvas_id}, session_id: {session_id}")

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

        # print(
        #     f"📐 生成图像元素: x={new_image_element['x']}, y={new_image_element['y']}, 文件ID: {file_id}")

        # update the canvas data, add the new image element
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

        # print(
        #     f"💾 画布元素总数: {len(canvas_data['data']['elements'])}, 文件总数: {len(canvas_data['data']['files'])}")

        image_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"

        # 保存画布数据到数据库
        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data['data']))

        # 广播图像生成消息到前端
        await broadcast_session_update(session_id, canvas_id, {
            'type': 'image_generated',
            'element': new_image_element,
            'file': file_data,
            'image_url': image_url,
        })

        return image_url


# 生成唯一文件 ID
def generate_file_id() -> str:
    return 'im_' + generate(size=8)
