from routers.comfyui_execution import execute
import asyncio
import base64
import json
import sys
from services.config_service import app_config
import traceback
from services.config_service import USER_DATA_DIR, FILES_DIR
from PIL import Image
from io import BytesIO
import os
from nanoid import generate
import httpx
import aiofiles
from typing import Optional
from utils.http_client import HttpClient
import copy

async def get_image_info_and_save(url, file_path_without_extension):
    # Fetch the image asynchronously
    async with HttpClient.create() as client:
        response = await client.get(url)
        # Read the image content as bytes
        image_content = response.content
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
    try:
        api_key = app_config.get('replicate', {}).get('api_key', '')
        if not api_key:
            raise ValueError(
                "Image generation failed: Replicate API key is not set")
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
        async with HttpClient.create() as client:
            response = await client.post(url, headers=headers, json=data)
            res = response.json()
        print('🦄image generation response', res)
        output = res.get('output', '')
        image_id = 'im_' + generate(size=8)
        # image_id = int(time.time() * 1000)
        if output == '':
            if res.get('detail', '') != '':
                raise Exception(
                    f'Replicate image generation failed: {res.get("detail", "")}')
            else:
                raise Exception(
                    'Replicate image generation failed: no output url found')
        print('🦄image generation image_id', image_id)
        # get image dimensions
        mime_type, width, height, extension = await get_image_info_and_save(output, os.path.join(FILES_DIR, f'{image_id}'))
        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename
    except Exception as e:
        print('Error generating image with replicate', e)
        traceback.print_exc()
        raise e


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
        workflow = copy.deepcopy(flux_comfy_workflow)
        workflow['6']['inputs']['text'] = prompt
        workflow['30']['inputs']['ckpt_name'] = model
    else:
        workflow = copy.deepcopy(basic_comfy_t2i_workflow)
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


async def generate_image_wavespeed(prompt: str, model, input_image: Optional[str] = None, **kwargs):
    api_key = app_config.get('wavespeed', {}).get('api_key', '')
    url = app_config.get('wavespeed', {}).get('url', '')

    async with HttpClient.create() as client:
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        if input_image:
            model = 'wavespeed-ai/flux-kontext-pro/multi'
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
        response = await client.post(endpoint, json=payload, headers=headers)
        response_json = response.json()
        if response.status_code != 200 or response_json.get("code") != 200:
            raise Exception(f"WaveSpeed API error: {response_json}")
        result_url = response_json["data"]["urls"]["get"]
        # 轮询获取图片结果
        for _ in range(60):  # 最多等60秒
            await asyncio.sleep(1)
            result_resp = await client.get(result_url, headers=headers)
            result_data = result_resp.json()
            print("WaveSpeed polling result:", result_data)
            data = result_data.get("data", {})
            outputs = data.get("outputs", [])
            status = data.get("status")
            if status in ("succeeded", "completed") and outputs:
                image_url = outputs[0]
                image_id = 'im_' + generate(size=8)
                mime_type, width, height, extension = await get_image_info_and_save(image_url, os.path.join(FILES_DIR, f'{image_id}'))
                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename

            if status == "failed":
                raise Exception(
                    f"WaveSpeed generation failed: {result_data}")
        raise Exception("WaveSpeed image generation timeout")


async def generate_image_jaaz_cloud(prompt: str, model: str, aspect_ratio: str = "1:1", input_image_b64: Optional[str] = None):
    """
    使用 Jaaz API 服务生成图像
    与 Replicate 兼容但使用不同的 API 端点
    """
    try:
        # 从配置中获取 API 设置
        jaaz_config = app_config.get('jaaz', {})
        api_url = jaaz_config.get('url', '')
        api_token = jaaz_config.get('api_key', '')

        if not api_url or not api_token:
            raise ValueError("Jaaz API URL or token is not configured")

        # 构建请求 URL
        if api_url.rstrip('/').endswith('/api/v1'):
            url = f"{api_url.rstrip('/')}/image/generations"
        else:
            url = f"{api_url.rstrip('/')}/api/v1/image/generations"

        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

        # 构建请求数据，与 Replicate 格式一致
        data = {
            "prompt": prompt,
            "model": model,
            "aspect_ratio": aspect_ratio,
        }

        # 如果有输入图像，添加到请求中
        if input_image_b64:
            data['input_image'] = input_image_b64

        print(
            f'🦄 Jaaz image generation request: {prompt[:50]}... with model: {model}')

        async with HttpClient.create() as client:
            response = await client.post(url, headers=headers, json=data)
            res = response.json()

        print('🦄 Jaaz image generation response', res)

        # 从响应中获取图像 URL
        output = res.get('output', '')
        if isinstance(output, list) and len(output) > 0:
            output = output[0]  # 取第一张图片

        if not output:
            error_detail = res.get('detail', res.get('error', 'Unknown error'))
            raise Exception(
                f'Jaaz image generation failed: {error_detail}')

        # 生成唯一图像 ID
        image_id = 'im_' + generate(size=8)

        print(f'🦄 Jaaz image generation image_id: {image_id}')

        # 下载并保存图像
        mime_type, width, height, extension = await get_image_info_and_save(
            output,
            os.path.join(FILES_DIR, f'{image_id}')
        )

        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename

    except Exception as e:
        print('Error generating image with Jaaz:', e)
        traceback.print_exc()
        raise e
