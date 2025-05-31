import requests
from localmanus.services.config_service import app_config
import traceback

async def generate_image(args_json: dict):
    model: str = args_json.get('model', 'black-forest-labs/flux-1.1-pro')
    prompt: str = args_json.get('prompt', '')
    aspect_ratio: str = args_json.get('aspect_ratio', '1:1')
    api_key = app_config.get('replicate', {}).get('api_key', '')
    if prompt == '':
        raise ValueError("Image generation failed: text prompt is required")
    if not api_key:
        raise ValueError("Replicate API key is not set")
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
        print('🎨image gen response status: ', response.status_code)
        print('🎨image gen response: ', response)
        print('🎨image gen response: ', response.json())
    
        res = response.json()
        print('🎨image gen result: ', res)
        output = res.get('output', '')
        print('🎨image gen output: ', output)

        return [
            {
                'role': 'tool',
                'content': f'Image generation successful: {output}',
            }
        ]
    except Exception as e:
        raise e
        traceback.print_exc()
