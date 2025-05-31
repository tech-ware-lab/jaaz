from fastapi.responses import FileResponse
import requests
from localmanus.services.config_service import app_config
import traceback
import time
from localmanus.services.config_service import USER_DATA_DIR
from localmanus.routers.websocket import send_to_websocket
from PIL import Image
from io import BytesIO
import os
from nanoid import generate
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api")

files_dir = os.path.join(USER_DATA_DIR, 'files')
os.makedirs(files_dir, exist_ok=True)

@router.get("/file/{file_id}")
async def get_file(file_id: str):
    file_path = os.path.join(files_dir, f'{file_id}')
    print('🦄get_file file_path', file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

async def generate_image(args_json: dict, ctx: dict):
    session_id = ctx.get('session_id', '')
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    provider = image_model.get('provider', 'replicate')
    prompt: str = args_json.get('prompt', '')
    aspect_ratio: str = args_json.get('aspect_ratio', '1:1')
    api_key = app_config.get('replicate', {}).get('api_key', '')
    if prompt == '':
        raise ValueError("Image generation failed: text prompt is required")
    if model == '':
        raise ValueError("Image generation failed: model is not selected")
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

    response = requests.post(url, headers=headers, json=data)
    res = response.json()
    print('🦄image generation response', res)
    output = res.get('output', '')
    image_id = generate(size=10)
    # image_id = int(time.time() * 1000)
    if output == '':
        if res.get('detail', '') != '':
            raise Exception(f'Replicate image generation failed: {res.get("detail", "")}')
        else:
            raise Exception('Replicate image generation failed: no output url found')
    print('🦄image generation image_id', image_id)
    # get image dimensions
    mime_type, width, height, extension = get_image_info_and_save(output, os.path.join(files_dir, f'{image_id}'))
    await send_to_websocket(session_id, {
        'type': 'image_generated',
        'image_data': {
            'mime_type': mime_type,
            'url': f'/api/file/{image_id}.{extension}',
            'width': width,
            'height': height,
        }
    })
    return [
        {
            'role': 'tool',
            'content': f'Image generation successful: ![image id: {image_id}]({output})',
        }
    ]

def get_image_info_and_save(url, file_path_without_extension):
    # Fetch the image
    response = requests.get(url)
    response.raise_for_status()  # Raise an error for bad responses

    # Open the image
    image = Image.open(BytesIO(response.content))

    # Get MIME type
    mime_type = Image.MIME.get(image.format if image.format else 'PNG')

    # Get dimensions
    width, height = image.size

    # Determine the file extension
    extension = image.format.lower() if image.format else 'png'
    file_path = f"{file_path_without_extension}.{extension}"

    # Save the image to a local file with the correct extension
    image.save(file_path)
    print('🦄image saved to file_path', file_path)

    return mime_type, width, height, extension

        
