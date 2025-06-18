from typing import Optional
import os
import traceback
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
from utils.http_client import HttpClient


class JaazGenerator(ImageGenerator):
    """Jaaz Cloud image generator implementation"""

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> tuple[str, int, int, str]:
        """
        使用 Jaaz API 服务生成图像
        与 Replicate 兼容但使用不同的 API 端点
        """
        try:
            # 从配置中获取 API 设置
            jaaz_config = config_service.app_config.get('jaaz', {})
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
            if input_image:
                data['input_image'] = input_image

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
                error_detail = res.get(
                    'detail', res.get('error', 'Unknown error'))
                raise Exception(
                    f'Jaaz image generation failed: {error_detail}')

            # 生成唯一图像 ID
            image_id = generate_image_id()
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
