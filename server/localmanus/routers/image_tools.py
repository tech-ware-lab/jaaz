import requests
from localmanus.services.config_service import app_config
import traceback
import time
async def generate_image(args_json: dict, model_info: dict):
    image_model = model_info.get('image', {})
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
    try:
        response = requests.post(url, headers=headers, json=data)
        res = response.json()
        print('🦄image generation response', res)
        output = res.get('output', '')
        image_id = time.time()
        if output == '':
            if res.get('detail', '') != '':
                raise Exception(f'Replicate image generation failed: {res.get("detail", "")}')
            else:
                raise Exception('Replicate image generation failed: no output url found')

        return [
            {
                'role': 'tool',
                'content': f'Image generation successful: ![image id: {image_id}]({output})',
            }
        ]
    except Exception as e:
        raise e
        traceback.print_exc()
