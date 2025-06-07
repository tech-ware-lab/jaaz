import base64
import json
import sys
from fastapi.responses import FileResponse
import requests
from common import DEFAULT_PORT
from services.config_service import app_config
import traceback
import time
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
from typing import Optional

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

    # Determine the file extension
    mime_type, _ = guess_type(filename)
    extension = mime_type.split('/')[-1] if mime_type else ''  # default to 'bin' if unknown

    file_path = os.path.join(FILES_DIR, f'{file_id}.{extension}')
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()  # Read the file content
        await f.write(content)
    print('🦄upload_image file_path', file_path)
    return {
        'file_id': f'{file_id}.{extension}',
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
                # hardcode kontext model for image editing for now
                model = 'black-forest-labs/flux-kontext-pro'
                image_path = os.path.join(FILES_DIR, f'{input_image}')
                async with aiofiles.open(image_path, 'rb') as f:
                    image_data = await f.read()
                b64 = base64.b64encode(image_data).decode('utf-8')

                mime_type, _ = guess_type(image_path)
                if not mime_type:
                    mime_type = "image/png"  # default fallback
                input_image = f"data:{mime_type};base64,{b64}"
            # mime_type, width, height, filename = await generate_image_comfyui(args_json, ctx)
            mime_type, width, height, filename = await generate_image_replicate(prompt, model, aspect_ratio, input_image)
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
                'content': f'Image generation successful: ![image_id: {filename}](http://127.0.0.1:{DEFAULT_PORT}/api/file/{filename})',
            }]

    except Exception as e:
        print(f"Error generating image: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

async def generate_image_replicate(prompt, model, aspect_ratio, input_image):
    api_key = app_config.get('replicate', {}).get('api_key', '')
    if not api_key:
        raise ValueError("Image generation failed: Replicate API key is not set")
    url = f"https://api.replicate.com/v1/models/{model}/predictions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "wait"
    }
    data = {
        "input": {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }
    }
    if input_image:
        data['input']['input_image'] = input_image
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, headers=headers, json=data)
    res = response.json()
    print('🦄image generation response', res)
    output = res.get('output', '')
    image_id = 'im_' + generate(size=8)
    # image_id = int(time.time() * 1000)
    if output == '':
        if res.get('detail', '') != '':
            raise Exception(f'Replicate image generation failed: {res.get("detail", "")}')
        else:
            raise Exception('Replicate image generation failed: no output url found')
    print('🦄image generation image_id', image_id)
    # get image dimensions
    mime_type, width, height, extension = await get_image_info_and_save(output, os.path.join(FILES_DIR, f'{image_id}'))
    filename = f'{image_id}.{extension}'
    return mime_type, width, height, filename

def get_asset_path(filename):
    # To get the correct path for pyinstaller bundled application
    if getattr(sys, 'frozen', False):
        # If the application is run as a bundle, the path is relative to the executable
        base_path = sys._MEIPASS
    else:
        # If the application is run in a normal Python environment
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    return os.path.join(base_path, 'asset', filename)

asset_dir = get_asset_path('flux_comfy_workflow.json')
flux_comfy_workflow = None 
basic_comfy_t2i_workflow = get_asset_path('default_comfy_t2i_workflow.json')
try:
    flux_comfy_workflow = json.load(open(asset_dir, 'r'))
    basic_comfy_t2i_workflow = json.load(open(basic_comfy_t2i_workflow, 'r'))
except Exception as e:
    traceback.print_exc()

from routers.comfyui_execution import execute
async def generate_image_comfyui(args_json: dict, ctx: dict):
    if not flux_comfy_workflow:
        raise Exception('Flux workflow json not found')
    api_url = app_config.get('comfyui', {}).get('url', '')
    api_url = 'http://127.0.0.1:8188'
    prompt = args_json.get('prompt', '')
    # flux_comfy_workflow['6']['inputs']['text'] = prompt
    basic_comfy_t2i_workflow['6']['inputs']['text'] = prompt
    execution = await execute(basic_comfy_t2i_workflow, '127.0.0.1', 8188, ctx=ctx)
    print('🦄image execution outputs', execution.outputs)
    url = execution.outputs[0]
    # get image dimensions
    image_id = 'im_' + generate(size=8)
    mime_type, width, height, extension = await get_image_info_and_save(url, os.path.join(FILES_DIR, f'{image_id}'))
    filename = f'{image_id}.{extension}'
    return mime_type, width, height, filename

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


async def get_image_info_and_save(url, file_path_without_extension):
    # Fetch the image asynchronously
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            # Read the image content as bytes
            image_content = await response.read()
            # Open the image
            image = Image.open(BytesIO(image_content))

    # Get MIME type
    mime_type = Image.MIME.get(image.format if image.format else 'PNG')

    # Get dimensions
    width, height = image.size

    # Determine the file extension
    extension = image.format.lower() if image.format else 'png'
    file_path = f"{file_path_without_extension}.{extension}"

    # Save the image to a local file with the correct extension asynchronously
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(image_content)
    print('🦄image saved to file_path', file_path)

    return mime_type, width, height, extension

        
