from typing import Optional, List
import os
import traceback
import base64
from pydantic import BaseModel
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
from utils.http_client import HttpClient
from openai.types import Image


class JaazImagesResponse(BaseModel):
    """图像响应类， Jaaz API 返回格式，与 OpenAI 一致"""
    created: int
    """The Unix timestamp (in seconds) of when the image was created."""

    data: Optional[List[Image]] = None
    """The list of generated images."""


class JaazGenerator(ImageGenerator):
    """Jaaz Cloud image generator implementation"""

    def _get_api_config(self) -> tuple[str, str]:
        """获取 API 配置"""
        jaaz_config = config_service.app_config.get('jaaz', {})
        api_url = jaaz_config.get('url', '')
        api_token = jaaz_config.get('api_key', '')

        if not api_url or not api_token:
            raise ValueError("Jaaz API URL or token is not configured")

        return api_url, api_token

    def _build_url(self, api_url: str) -> str:
        """构建请求 URL"""
        if api_url.rstrip('/').endswith('/api/v1'):
            return f"{api_url.rstrip('/')}/image/generations"
        else:
            return f"{api_url.rstrip('/')}/api/v1/image/generations"

    def _build_headers(self, api_token: str) -> dict[str, str]:
        """构建请求头"""
        return {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    async def _make_request(self, url: str, headers: dict[str, str], data: dict) -> JaazImagesResponse:
        """
        发送 HTTP 请求并处理响应

        Returns:
            JaazImagesResponse: Jaaz 兼容的图像响应对象
        """
        async with HttpClient.create() as client:
            print(
                f'🦄 Jaaz API request: {url}, model: {data["model"]}, prompt: {data["prompt"]}')
            response = await client.post(url, headers=headers, json=data)

            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                print(f'🦄 Jaaz API error: {error_msg}')
                raise Exception(f'Image generation failed: {error_msg}')

            if not response.content:
                raise Exception(
                    'Image generation failed: Empty response from server')

                # 解析 JSON 数据
            json_data = response.json()
            print('🦄 Jaaz API response', json_data)

            return JaazImagesResponse(**json_data)

    async def _process_response(self, res: JaazImagesResponse, error_prefix: str = "Jaaz") -> tuple[str, int, int, str]:
        """
        处理 ImagesResponse 并保存图像

        Args:
            res: OpenAI ImagesResponse 对象
            error_prefix: 错误消息前缀

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        if res.data and len(res.data) > 0:
            image_data = res.data[0]
            if hasattr(image_data, 'url') and image_data.url:
                image_url = image_data.url
                image_id = generate_image_id()
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url,
                    os.path.join(FILES_DIR, f'{image_id}')
                )

                # 确保 mime_type 不为 None
                if mime_type is None:
                    raise Exception('Failed to determine image MIME type')

                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename

        # 如果没有找到有效的图像数据
        raise Exception(
            f'{error_prefix} image generation failed: No valid image data in response')

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        input_images: Optional[list[str]] = None,
        **kwargs
    ) -> tuple[str, int, int, str]:
        """
        使用 Jaaz API 服务生成图像
        支持 Replicate 格式和 OpenAI 格式的模型

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        # 检查是否是 OpenAI 模型
        if model.startswith('openai/'):
            return await self._generate_openai_image(
                prompt=prompt,
                model=model,
                input_images=input_images,
                aspect_ratio=aspect_ratio,
                **kwargs
            )

        # Replicate 兼容逻辑
        return await self._generate_replicate_image(
            prompt=prompt,
            model=model,
            aspect_ratio=aspect_ratio,
            input_image=input_image,
            **kwargs
        )

    async def _generate_replicate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> tuple[str, int, int, str]:
        """生成 Replicate 格式的图像"""
        try:
            api_url, api_token = self._get_api_config()
            url = self._build_url(api_url)
            headers = self._build_headers(api_token)

            # 构建请求数据，与 Replicate 格式一致
            data = {
                "prompt": prompt,
                "model": model,
                "aspect_ratio": aspect_ratio,
            }

            # 如果有输入图像，添加到请求中
            if input_image:
                data['input_image'] = input_image

            res = await self._make_request(url, headers, data)

            return await self._process_response(res, "Jaaz")

        except Exception as e:
            print('Error generating image with Jaaz:', e)
            traceback.print_exc()
            raise e

    async def _generate_openai_image(
        self,
        prompt: str,
        model: str,
        input_images: Optional[list[str]] = None,
        aspect_ratio: str = "1:1",
        **kwargs
    ) -> tuple[str, int, int, str]:
        """
        使用 Jaaz API 服务调用 OpenAI 模型生成图像
        兼容 OpenAI 图像生成 API

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        try:
            api_url, api_token = self._get_api_config()
            url = self._build_url(api_url)
            headers = self._build_headers(api_token)

            # 构建请求数据
            enhanced_prompt = f"{prompt} Aspect ratio: {aspect_ratio}"

            data = {
                "model": model,
                "prompt": enhanced_prompt,
                "n": kwargs.get("num_images", 1),
                "size": 'auto',
                "input_images": input_images,
                "mask": None,  # 如果需要遮罩，可以在这里添加
            }

            res = await self._make_request(url, headers, data)

            return await self._process_response(res, "Jaaz OpenAI")

        except Exception as e:
            print('Error generating image with Jaaz OpenAI:', e)
            traceback.print_exc()
            raise e
