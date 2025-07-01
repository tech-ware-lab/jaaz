# server/routers/video_generators.py
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

async def generate_video_google(
    prompt: str,
    model: str,
    base_url: str,
    image_name: str | None = None,
    duration: int = 5,
    ar: str = "16:9",
    generate_audio: bool = True,
):
    try:
        api_key = config_service.app_config.get("google", {}).get("api_key", "")
        if not api_key:
            raise ValueError("Video generation failed: Google API key is not set")

        base_url = (
            config_service.app_config.get("google", {}).get("url", "").rstrip("/")
        )

        endpoint = f"/publishers/google/models/{model}:predictLongRunning"

        url = base_url + endpoint


        # Convert to base64 if image_path is provided
        if image_name:
            # Process image
            image_path = os.path.join(FILES_DIR, f"{image_name}")
            image = Image.open(image_path)

            # 可爱的豆包，鲁棒性太拉了，拉的想骂人(图片支支持0.4-2.5比例的)
            # Kawaii Doubao video model has a fxxking bad robustness,
            # it can only handle images with aspect ratio between 0.4 and 2.5.
            # 见到限制更多的了...
            # I've seen more limits...

            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format="PNG")

            b64 = base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")
            mime_type, _ = guess_type(image_path)
            if not mime_type:
                mime_type = "image/png"
            input_image_data = f"data:{mime_type};base64,{b64}"
        else:
            input_image_data = None

        payload = {
            "instances": [
                {
                    "prompt": prompt,
                }
            ],
            "parameters": {
                "aspectRatio": ar,
                "durationSeconds": duration,
                "enhancePrompt": True,
                "generateAudio": generate_audio
            }
        }

        if input_image_data:
            payload.get("instances", []).append(
                {"image": {"bytesBase64Encoded": input_image_data, "mimeType": mime_type}}
            )

        header = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with HttpClient.create() as client:
            response = await client.post(url, headers=header, json=payload)
            res = response.json()
            task_name = res.get("name", None)
            status = False

            if task_name:
                print(f"🎥 Veo video generation task created, task_name: {task_name}")
            else:
                print("🎥 Failed to create Veo video generation task:", res)
                raise Exception("Volces video generation task creation failed")

            polling_url = base_url + f"//publishers/google/models/{model}:fetchPredictOperation"
            polling_payload = {
                "operationName": task_name
            }

            while not status:
                print(f"🎥 Polling generation {task_name}, current status: {status} ...")
                await asyncio.sleep(3)  # Wait 3 seconds between polls
                poll_response = await client.post(polling_url, headers=header, json=polling_payload)

                poll_res = poll_response.json()
                status = poll_res.get("done", False)
                output = poll_res.get("response", {}).get("videos", [{}])[0].get("gcsUri", None)


            if status or not output or not isinstance(output, str):
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
