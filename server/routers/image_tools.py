import base64
from fastapi.responses import FileResponse
from common import DEFAULT_PORT
from routers.image_generators import generate_image_comfyui, generate_image_replicate
from services.config_service import app_config
import traceback
from services.config_service import USER_DATA_DIR, FILES_DIR
from routers.websocket import send_to_websocket
from PIL import Image
from io import BytesIO
import os
from nanoid import generate
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
import httpx
import aiofiles
from mimetypes import guess_type
import aiohttp
import asyncio
from typing import Optional, Annotated, List
from langchain_core.tools import tool
router = APIRouter(prefix="/api")

os.makedirs(FILES_DIR, exist_ok=True)

def generate_file_id():
    return 'im_' + generate(size=8)

@router.post("/upload_image")
async def upload_image(session_id: str = Form(...), file: UploadFile = File(...)):
    print('🦄upload_image session_id', session_id)
    print('🦄upload_image file', file.filename)
    file_id = generate_file_id()
    filename = file.filename or ''

    # Read the file content
    content = await file.read()

    # Open the image from bytes to get its dimensions
    with Image.open(BytesIO(content)) as img:
        width, height = img.size

    # Determine the file extension
    mime_type, _ = guess_type(filename)
    extension = mime_type.split('/')[-1] if mime_type else ''  # default to 'bin' if unknown

    file_path = os.path.join(FILES_DIR, f'{file_id}.{extension}')
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    print('🦄upload_image file_path', file_path)
    return {
        'file_id': f'{file_id}.{extension}',
        'width': width,
        'height': height,
    }

@router.get("/file/{file_id}")
async def get_file(file_id: str):
    file_path = os.path.join(FILES_DIR, f'{file_id}')
    print('🦄get_file file_path', file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@router.post("/comfyui/object_info")
async def get_object_info(data: dict):
    url = data.get('url', '')
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{url}/api/object_info") as response:
            return await response.json()

from pydantic import BaseModel, Field
from langchain_core.runnables import RunnableConfig

@tool("generate_image", parse_docstring=True)
def generate_image_tool(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
) -> str:
    """Generate an image using text prompt or optionally pass an image for reference or for editing

    Args:
        prompt: Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt.
        aspect_ratio: Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16 Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4
    """
    print('🛠️',prompt, aspect_ratio)
    return "image generated successfully ![image_id: abc.png](/api/file/abc.png)"

print('🛠️',generate_image_tool.args_schema.model_json_schema())


async def generate_image(args_json: dict, ctx: dict):
    session_id = ctx.get('session_id', '')
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    provider = image_model.get('provider', 'replicate')
    prompt: str = args_json.get('prompt', '')
    aspect_ratio: str = args_json.get('aspect_ratio', '1:1')
    input_image: str = args_json.get('input_image', '')
    
    if prompt == '':
        raise ValueError("Image generation failed: text prompt is required")
    if model == '':
        raise ValueError("Image generation failed: model is not selected")

    try:
        if provider == "wavespeed":
            if input_image:
                image_path = os.path.join(FILES_DIR, f'{input_image}')
                model = 'wavespeed-ai/flux-kontext-max/multi'
                async with aiofiles.open(image_path, 'rb') as f:
                    image_data = await f.read()
                mime_type, _ = guess_type(image_path)
                if not mime_type:
                    mime_type = "image/png"
                b64 = base64.b64encode(image_data).decode('utf-8')
                input_image = f"data:{mime_type};base64,{b64}"
            else:
                input_image = None

            result = await generate_wavespeed_image(
                prompt, model,
                app_config.get('wavespeed', {}).get('api_key', ''),
                app_config.get('wavespeed', {}).get('url', ''),
                input_image=input_image
            )
            image_url = result.get("image_url")
            image_bytes = result.get("image_bytes")
            if not image_url or not image_bytes:
                raise Exception("WaveSpeed did not return a valid image result.")
            # 保存图片到本地
            file_id = generate_file_id()
            file_path = os.path.join(FILES_DIR, f"{file_id}.jpg")
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_bytes)
            # 获取图片尺寸
            with Image.open(file_path) as img:
                width, height = img.size
            await send_to_websocket(session_id, {
                'type': 'image_generated',
                'image_data': {
                    'mime_type': 'image/jpeg',
                    'url': f'/api/file/{file_id}.jpg',
                    'width': width,
                    'height': height,
                    'origin_url': image_url
                }
            })
            return [{
                'role': 'tool',
                'content': f'Image generation successful: ![image_id: {file_id}](http://127.0.0.1:{DEFAULT_PORT}/api/file/{file_id}.jpg)',
            }]
        else:
            # 处理其他提供商的图像生成
            if input_image:
                image_path = os.path.join(FILES_DIR, f'{input_image}')
                async with aiofiles.open(image_path, 'rb') as f:
                    image_data = await f.read()
                b64 = base64.b64encode(image_data).decode('utf-8')

                mime_type, _ = guess_type(image_path)
                if not mime_type:
                    mime_type = "image/png"  # default fallback
                input_image = f"data:{mime_type};base64,{b64}"
                if provider == 'replicate':
                    mime_type, width, height, filename = await generate_image_replicate(prompt, model, aspect_ratio, input_image)
                elif provider == 'comfyui':
                    mime_type, width, height, filename = await generate_image_comfyui(args_json, ctx)
            else:
                if provider == 'replicate':
                    mime_type, width, height, filename = await generate_image_replicate(prompt, model, aspect_ratio)
                elif provider == 'comfyui':
                    mime_type, width, height, filename = await generate_image_comfyui(args_json, ctx)
            
            await send_to_websocket(session_id, {
                'type': 'image_generated',
                'image_data': {
                    'mime_type': mime_type,
                    'url': f'/api/file/{filename}',
                    'width': width,
                    'height': height,
                }
            })
            return [{
                'role': 'tool',
                'content': f'Image generation successful: ![image width: {width} height: {height} image_id: {filename}](http://127.0.0.1:{DEFAULT_PORT}/api/file/{filename})',
            }]

    except Exception as e:
        print(f"Error generating image: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

async def generate_wavespeed_image(prompt: str, model: str, api_key: str, url: str, input_image: Optional[str] = None, **kwargs):
    async with aiohttp.ClientSession() as session:
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        if input_image:
            payload = {
                "prompt": prompt,
                "images": [input_image],
                "guidance_scale": kwargs.get("guidance_scale", 3.5),
                "num_images": kwargs.get("num_images", 1),
                "safety_tolerance": str(kwargs.get("safety_tolerance", "2"))
            }
        else:
            payload = {
                "enable_base64_output": False,
                "enable_safety_checker": False,
                "guidance_scale": kwargs.get("guidance_scale", 3.5),
                "num_images": kwargs.get("num_images", 1),
                "num_inference_steps": kwargs.get("num_inference_steps", 28),
                "prompt": prompt,
                "seed": -1,
                "size": kwargs.get("size", "1024*1024"),
                "strength": kwargs.get("strength", 0.8),
            }
        endpoint = f"{url.rstrip('/')}/{model}"
        async with session.post(endpoint, json=payload, headers=headers) as response:
            response_json = await response.json()
            if response.status != 200 or response_json.get("code") != 200:
                raise Exception(f"WaveSpeed API error: {response_json}")
            result_url = response_json["data"]["urls"]["get"]
            # 轮询获取图片结果
            for _ in range(60):  # 最多等60秒
                await asyncio.sleep(1)
                async with session.get(result_url, headers=headers) as result_resp:
                    result_data = await result_resp.json()
                    print("WaveSpeed polling result:", result_data)
                    data = result_data.get("data", {})
                    outputs = data.get("outputs", [])
                    status = data.get("status")
                    if status in ("succeeded", "completed") and outputs:
                        image_url = outputs[0]
                        # 下载图片内容
                        async with session.get(image_url) as img_resp:
                            img_bytes = await img_resp.read()
                        return {
                            "image_url": image_url,
                            "image_bytes": img_bytes
                        }
                    if status == "failed":
                        raise Exception(f"WaveSpeed generation failed: {result_data}")
            raise Exception("WaveSpeed image generation timeout")