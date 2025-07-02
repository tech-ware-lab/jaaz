
import base64

# from engineio import payload
from nanoid import generate
from utils.http_client import HttpClient
import traceback

# import httpx
import os
import io
from PIL import Image
from mimetypes import guess_type
from tools.video_generation_utils import get_video_info_and_save

# services
from services.config_service import config_service
from services.config_service import FILES_DIR

import asyncio

async def generate_video_volces(
    prompt: str,
    model: str,
    resolution: str = "480p",
    duration: int = 5,
    camerafixed: bool = True,
    image_name: str | None = None,
    aspect_ratio: str = "16:9",
):
    try:
        api_key = config_service.app_config.get("volces", {}).get("api_key", "")
        if not api_key:
            raise ValueError("Video generation failed: Volces API key is not set")

        base_url = (
            config_service.app_config.get("volces", {}).get("url", "").rstrip("/")
        )

        endpoint = "/contents/generations/tasks"

        url = base_url + endpoint

        command = (
            "--resolution "
            + resolution
            + " --dur "
            + str(duration)
            + " --camerafixed "
            + str(camerafixed)
            + " --wm false"
        )

        # Convert to base64 if image_path is provided
        if image_name:
            # Process image
            image_path = os.path.join(FILES_DIR, f"{image_name}")
            image = Image.open(image_path)

            # 可爱的豆包，鲁棒性太拉了，拉的想骂人(图片支支持0.4-2.5比例的)
            # Kawaii Doubao video model has a fxxking bad robustness,
            # it can only handle images with aspect ratio between 0.4 and 2.5.

            width, height = image.size
            ratio = width / height
            if ratio > 2.5 or ratio < 0.4:
                # 宽高比大于2.5或者小于0.4的图片，现在只能暴力裁掉
                if ratio < 1:
                    # 竖版图片
                    new_height = int(width * 2.4)
                    new_width = width
                    image = image.resize(  # type:ignore
                        (new_width, new_height), Image.Resampling.LANCZOS
                    )
                elif ratio > 1:
                    new_width = int(height * 2.4)
                    new_height = height
                    image = image.resize(
                        (new_width, new_height), Image.Resampling.LANCZOS
                    )
            else:
                new_width, new_height = image.size

            # 计算缩放因子，确保类型为float
            scale_factor: float = float(
                (float(1048576) / float(new_width * new_height)) ** 0.5
            )

            preview_image_width = int(new_width * scale_factor)
            preview_image_height = int(new_height * scale_factor)

            img = image.resize(
                (preview_image_width, preview_image_height), Image.Resampling.LANCZOS
            )
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format="PNG")

            b64 = base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")
            mime_type, _ = guess_type(image_path)
            if not mime_type:
                mime_type = "image/png"
            input_image_data = f"data:{mime_type};base64,{b64}"
        else:
            command += " --rt " + aspect_ratio
            input_image_data = None

        payload = {
            "model": str(model.split("by")[0]).rstrip("_"),

            "content": [
                {"type": "text", "text": prompt + command},
            ],
        }
        if input_image_data:
            payload.get("content", []).append(
                {"type": "image_url", "image_url": {"url": input_image_data}}
            )

        header = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with HttpClient.create() as client:
            response = await client.post(url, headers=header, json=payload)
            res = response.json()
            task_id = res.get("id", None)
            status = "submitted"

            if task_id:
                print(f"🎥 Volces video generation task created, task_id: {task_id}")
            else:
                print("🎥 Failed to create Volces video generation task:", res)
                raise Exception("Volces video generation task creation failed")

            polling_url = base_url + f"/contents/generations/tasks/{task_id}"

            while status not in ("succeeded", "failed", "cancelled"):
                print(f"🎥 Polling generation {task_id}, current status: {status} ...")
                await asyncio.sleep(3)  # Wait 3 seconds between polls
                poll_response = await client.get(polling_url, headers=header)

                poll_res = poll_response.json()
                status = poll_res.get("status", None)
                output = poll_res.get("content", {}).get("video_url", None)

            if status != "succeeded" or not output or not isinstance(output, str):
                detail_error = poll_res.get(
                    "detail", f"Task failed with status: {status}"
                )
                raise Exception(f"Volces video generation failed: {detail_error}")

            video_id = "vi_" + generate(size=8)
            mime_type, width, height, extension = await get_video_info_and_save(
                output, os.path.join(FILES_DIR, f"{video_id}")
            )
            filename = f"{video_id}.{extension}"
            return mime_type, width, height, filename

    except Exception as e:
        print("Error generating video with volces", e)
        traceback.print_exc()
        raise e

