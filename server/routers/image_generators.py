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

async def generate_image_replicate(prompt, model, aspect_ratio, input_image_b64: Optional[str] = None):
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
    if input_image_b64:
        data['input']['input_image'] = input_image_b64
        model = 'black-forest-labs/flux-kontext-pro'
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
    api_url = api_url.replace('http://', '').replace('https://', '')
    host = api_url.split(':')[0]
    port = api_url.split(':')[1]
    prompt = args_json.get('prompt', '')
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    if 'flux' in model:
        workflow = flux_comfy_workflow
        workflow['6']['inputs']['text'] = prompt
        workflow['30']['inputs']['ckpt_name'] = model
    else:
        workflow = basic_comfy_t2i_workflow
        workflow['6']['inputs']['text'] = prompt
        workflow['4']['inputs']['ckpt_name'] = model
    execution = await execute(workflow, host, port, ctx=ctx)
    print('🦄image execution outputs', execution.outputs)
    url = execution.outputs[0]
    # get image dimensions
    image_id = 'im_' + generate(size=8)
    mime_type, width, height, extension = await get_image_info_and_save(url, os.path.join(FILES_DIR, f'{image_id}'))
    filename = f'{image_id}.{extension}'
    return mime_type, width, height, filename