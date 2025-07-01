
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

async def generate_video_replicate(prompt, model, aspect_ratio):
    try:
        api_key = config_service.app_config.get("replicate", {}).get("api_key", "")
        if not api_key:
            raise ValueError("Video generation failed: Replicate API key is not set")

        url = f"https://api.replicate.com/v1/models/{model}/predictions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Prepare input
        data = {
            "input": {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
            }
        }

        async with HttpClient.create() as client:
            # Step 1: Initial POST request
            response = await client.post(url, headers=headers, json=data)
            res = response.json()

            prediction_id = res.get("id")
            status = res.get("status")
            print(f"🎥 Initial prediction status: {status}, id: {prediction_id}")

            if not prediction_id:
                print("🎥 Full Replicate response:", res)
                raise Exception("Replicate API returned no prediction id")

            # Step 2: Polling loop
            polling_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"

            while status not in ("succeeded", "failed", "canceled"):
                print(
                    f"🎥 Polling prediction {prediction_id}, current status: {status} ..."
                )
                await asyncio.sleep(3)  # Wait 3 seconds between polls

                poll_response = await client.get(polling_url, headers=headers)
                poll_res = poll_response.json()

                status = poll_res.get("status")
                output = poll_res.get("output", None)

            # Step 3: Final check
            if status != "succeeded" or not output or not isinstance(output, str):
                detail_error = poll_res.get(
                    "detail", f"Prediction failed with status: {status}"
                )
                raise Exception(f"Replicate video generation failed: {detail_error}")

            print(f"🎥 Prediction succeeded, output url: {output}")

            video_id = "vi_" + generate(size=8)

            # Now download and get video info
            mime_type, width, height, extension = await get_video_info_and_save(
                output, os.path.join(FILES_DIR, f"{video_id}")
            )
            filename = f"{video_id}.{extension}"

            return mime_type, width, height, filename

    except Exception as e:
        print("Error generating video with replicate", e)
        traceback.print_exc()
        raise e
