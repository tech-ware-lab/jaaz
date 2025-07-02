
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
from tools.video_generation_utils import get_video_info_and_save, get_image_base64

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
    first_frame_image_name: str | None = None,
    last_frame_image_name: str | None = None,
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
        if first_frame_image_name:
            # i2v
            first_frame_image_base64 = get_image_base64(first_frame_image_name)
            if last_frame_image_name is not None:
                # flf2v
                last_frame_image_base64 = get_image_base64(last_frame_image_name)
            else:
                last_frame_image_base64 = None
        else:
            # t2v
            command += " --rt " + aspect_ratio

        payload = {
            "model": str(model.split("by")[0]).rstrip("_"),

            "content": [
                {"type": "text", "text": prompt + command},
            ],
        }
        if first_frame_image_base64:
            image_input = {"type": "image_url", "image_url": {"url": first_frame_image_base64}}
            if last_frame_image_base64 is not None:
                image_input["role"] = "first_frame"
                last_image_input = {"type": "image_url", "image_url": {"url": last_frame_image_base64}}
                last_image_input["role"] = "last_frame"
            payload.get("content", []).append(image_input)
            if last_frame_image_base64 is not None:
                payload.get("content", []).append(last_image_input)

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

